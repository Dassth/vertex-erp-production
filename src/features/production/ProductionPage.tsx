import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { isSameDay, parseISO } from 'date-fns'
import {
  Activity,
  AlertTriangle,
  BellRing,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Factory,
  FileDown,
  GanttChartSquare,
  ListChecks,
  PackageCheck,
  Search,
  TriangleAlert,
} from 'lucide-react'
import { useStore } from '../../store/store'
import { allJobViews, stageUnitsLabel, todaysProcessWork, unitSummaries } from '../../lib/selectors'
import { watermarkOn } from '../../lib/brand'
import type { JobView } from '../../lib/selectors'
import { orderBalance } from '../../lib/billing'
import { isStageDone } from '../../lib/schedule'
import { isVisibleTo, notificationsFor } from '../../lib/notify'
import { markNotificationsRead } from '../../domain/system'
import { countdown, cx, fmtDate, fmtTime, fromNow, pieces, planWindow } from '../../lib/format'
import { Badge, Button, Card, CardHead, EmptyState, Pagination, ProgressBar, SearchInput, Segmented, Skeleton } from '../../components/ui'
import { LinkButton, PageHeader, StatStrip, StatTile, useDocumentTitle } from '../../components/page'
import { HEALTH_LABEL, HEALTH_TONE, HealthBadge, PriorityBadge, ProcessBadge } from '../../components/status'
import { JobDrawer } from '../../components/JobDrawer'

type Layout = 'board' | 'timeline' | 'list'

export function ProductionPage() {
  return <AdminProduction />
}

function AdminProduction() {
  useDocumentTitle('Production')
  const { db, ready } = useStore()
  const [params, setParams] = useSearchParams()
  const view = params.get('view') ?? 'all'
  const layout = (params.get('layout') ?? 'board') as Layout
  const q = params.get('q') ?? ''
  const jobId = params.get('job')
  const now = new Date()

  const set = (patch: Record<string, string | null>, push = false) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '' || (k === 'view' && v === 'all') || (k === 'layout' && v === 'board')) next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: !push })
  }

  const unitName = (id: string) => db.units.find((u) => u.id === id)?.shortName ?? id
  const views = useMemo(() => allJobViews(db), [db])
  const summaries = useMemo(() => unitSummaries(views, db.units), [views, db.units])
  const today = useMemo(() => todaysProcessWork(db.orders), [db.orders])

  const active = views.filter((v) => v.health !== 'Completed')
  const kpi = {
    active: active.length,
    onTime: active.filter((v) => v.health === 'On Time').length,
    atRisk: active.filter((v) => v.health === 'At Risk').length,
    delayed: active.filter((v) => v.health === 'Delayed').length,
    ready: views.filter((v) => v.health === 'Completed' && orderBalance(v.order, db.dispatches).remainingQty > 0).length,
    dueToday: active.filter((v) => isSameDay(parseISO(v.order.deliveryDate), now)).length,
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    let list = views
    if (view === 'today') list = list.filter((v) => v.health !== 'Completed' && isSameDay(parseISO(v.order.deliveryDate), now))
    else if (view === 'delayed') list = list.filter((v) => v.health === 'Delayed' || v.health === 'At Risk')
    else if (view === 'completed') list = list.filter((v) => v.health === 'Completed')
    else if (view === 'active') list = list.filter((v) => v.health !== 'Completed')
    else if (view !== 'all')
      list = list.filter((v) => v.order.stages.some((s) => s.processes.some((pr) => pr.unitId === view && pr.status !== 'Completed')))
    if (term) list = list.filter((v) => `${v.order.code} ${v.order.customer.company} ${v.order.productName}`.toLowerCase().includes(term))
    return [...list].sort((a, b) => a.order.deliveryDate.localeCompare(b.order.deliveryDate))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [views, view, q])

  const open = (id: string) => set({ job: id }, true)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations · Step 3"
        title="Production"
        subtitle="Every order released from costing, with its plan by unit. Open a job to download each unit’s sheet and send it. When the units say a job is done, mark it finished in Dispatch."
        icon={<Factory className="h-4 w-4" />}
      />

      <StatStrip className="sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Active jobs" value={String(kpi.active)} icon={<Factory className="h-4 w-4" />} tone="indigo" hint={`${db.orders.length} orders in total`} onClick={() => set({ view: 'active' })} active={view === 'active'} span />
        <StatTile label="On time" value={String(kpi.onTime)} icon={<CheckCircle2 className="h-4 w-4" />} tone="blue" hint="Running to plan" />
        <StatTile label="Approaching deadline" value={String(kpi.atRisk)} icon={<TriangleAlert className="h-4 w-4" />} tone="amber" hint="Remaining work is tight" onClick={() => set({ view: 'delayed' })} active={view === 'delayed'} />
        <StatTile label="Delayed" value={String(kpi.delayed)} icon={<AlertTriangle className="h-4 w-4" />} tone="red" hint="Planned time passed or problem open" onClick={() => set({ view: 'delayed' })} span />
        <StatTile label="Ready for dispatch" value={String(kpi.ready)} icon={<PackageCheck className="h-4 w-4" />} tone="green" hint="Production completed" onClick={() => set({ view: 'completed' })} active={view === 'completed'} />
        <StatTile label="Due today" value={String(kpi.dueToday)} icon={<CalendarDays className="h-4 w-4" />} tone="violet" hint="Delivery date today" onClick={() => set({ view: 'today' })} active={view === 'today'} />
      </StatStrip>

      {db.orders.length === 0 ? (
        <Card className="vx-anim-up">
          <EmptyState
            icon={<Factory className="h-6 w-6" />}
            title="No production orders yet"
            message="Orders appear here automatically when an order costing is finalized. Production orders are never created by hand."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <LinkButton to="/planning" variant="secondary">
                  Planning
                </LinkButton>
                <LinkButton to="/costing">Order costing</LinkButton>
              </div>
            }
          />
        </Card>
      ) : (
        <>
          <TodaysWork rows={today} unitName={unitName} onOpen={open} company={db.company.name} watermark={watermarkOn(db.company)} />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summaries.map((s) => (
              <button
                key={s.unit.id}
                type="button"
                onClick={() => set({ view: view === s.unit.id ? 'all' : s.unit.id })}
                aria-pressed={view === s.unit.id}
                className={cx('vx-press vx-card vx-card-interactive vx-focus relative overflow-hidden text-left', view === s.unit.id && 'border-accent-edge bg-accent-wash')}
              >
                <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-display text-md font-semibold text-ink">{s.unit.name}</p>
                    <p className="truncate text-xs text-muted">{s.unit.speciality}</p>
                  </div>
                  <Badge tone={s.delayedProcesses ? 'red' : 'green'} dot>
                    {s.delayedProcesses ? `${s.delayedProcesses} delayed` : 'On plan'}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 px-4 py-3 text-center">
                  {[
                    ['Jobs here', s.jobsHere],
                    ['Ready', s.readyProcesses],
                    ['Open processes', s.openProcesses],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="vx-code font-display text-xl font-semibold text-ink">{value}</p>
                      <p className="text-2xs text-muted">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="px-4 pb-3">
                  <ProgressBar value={s.loadPct} tone={s.loadPct > 90 ? 'red' : s.loadPct > 70 ? 'amber' : 'green'} />
                  <p className="mt-1.5 text-2xs text-muted">
                    Load {s.loadPct}% of daily capacity · {s.completedProcesses} processes closed
                  </p>
                </div>
              </button>
            ))}
          </div>

          <div className="vx-card flex flex-wrap items-center justify-between gap-3 px-3 py-3">
            <Segmented
              value={['all', 'active', 'today', 'delayed', 'completed'].includes(view) ? view : 'unit'}
              onChange={(v) => set({ view: v === 'unit' ? db.units[0]?.id ?? 'all' : v })}
              options={[
                { value: 'all', label: 'All', count: views.length },
                { value: 'active', label: 'Active', count: kpi.active },
                { value: 'today', label: 'Due today', count: kpi.dueToday },
                { value: 'delayed', label: 'Delayed / approaching', count: kpi.delayed + kpi.atRisk },
                { value: 'completed', label: 'Completed', count: views.length - kpi.active },
                ...(db.units.some((u) => u.id === view) ? [{ value: 'unit', label: `${unitName(view)} stages` }] : []),
              ]}
            />
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput value={q} onChange={(v) => set({ q: v })} placeholder="Search job, customer, product…" className="w-full sm:w-64" />
              <Segmented
                value={layout}
                onChange={(v) => set({ layout: v })}
                options={[
                  { value: 'board', label: 'Board' },
                  { value: 'timeline', label: 'Timeline' },
                  { value: 'list', label: 'List' },
                ]}
              />
            </div>
          </div>

          {!ready ? (
            <Skeleton className="h-64 w-full" />
          ) : filtered.length === 0 ? (
            <Card>
              <EmptyState icon={<Search className="h-6 w-6" />} title="No jobs in this view" message="Choose another filter or clear the search." action={<Button variant="secondary" onClick={() => set({ view: 'all', q: null })}>Show all</Button>} />
            </Card>
          ) : layout === 'board' ? (
            <UnitBoard views={filtered} units={db.units} onOpen={open} unitName={unitName} />
          ) : layout === 'timeline' ? (
            <Timeline views={filtered} onOpen={open} unitName={unitName} />
          ) : (
            <JobTable views={filtered} onOpen={open} unitName={unitName} />
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <RecentActivity />
            <NotificationList />
          </div>
        </>
      )}

      <JobDrawer orderId={jobId} onClose={() => set({ job: null })} />
    </div>
  )
}

/* ------------------------------ Today's work ------------------------------ */

function TodaysWork({ rows, unitName, onOpen, company, watermark }: { rows: ReturnType<typeof todaysProcessWork>; unitName: (id: string) => string; onOpen: (id: string) => void; company: string; watermark: boolean }) {
  const { pushToast } = useStore()
  const [exportPhase, setExportPhase] = useState<'idle' | 'busy' | 'error'>('idle')

  /* PDF code and fonts load on demand, so this can fail (or simply take a moment)
     after the click: keep one export in flight and report a failure where the
     user clicked. */
  const exportWorkList = () => {
    if (exportPhase === 'busy') return
    setExportPhase('busy')
    ;(async () => {
      const [{ workListDefinition }, { renderPdf, saveBlob }] = await Promise.all([import('../../lib/pdfDocs'), import('../../lib/pdfRender')])
      const definition = workListDefinition(rows, { title: `${company} — Today's production work`, scope: fmtDate(new Date(), 'EEEE, dd MMM yyyy'), unitName }, new Date(), watermark)
      saveBlob(await renderPdf(definition), `work-list-${fmtDate(new Date(), 'yyyy-MM-dd')}.pdf`)
    })().then(
      () => setExportPhase('idle'),
      (error: unknown) => {
        console.error(error)
        setExportPhase('error')
        pushToast({ title: 'Work list could not be exported', message: 'The PDF could not be prepared. Check your connection and try the export again.', level: 'danger' })
      },
    )
  }

  return (
    <Card className="vx-anim-up overflow-hidden">
      <CardHead
        title="Today’s work"
        subtitle={`${rows.length} stage(s) running, planned today or overdue`}
        icon={<ListChecks className="h-4 w-4" />}
        actions={
          rows.length ? (
            <Button
              size="sm"
              variant="secondary"
              icon={<FileDown className="h-3.5 w-3.5" />}
              loading={exportPhase === 'busy'}
              state={exportPhase === 'error' ? 'error' : 'idle'}
              onClick={exportWorkList}
            >
              Export PDF
            </Button>
          ) : null
        }
      />
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-muted">No stage work is planned for today.</p>
      ) : (
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr>
                <th className="vx-th">Window</th>
                <th className="vx-th">Job</th>
                <th className="vx-th">Stage</th>
                <th className="vx-th">Unit</th>
                <th className="vx-th">Customer · product</th>
                <th className="vx-th text-right">Qty</th>
                <th className="vx-th">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="vx-row">
                  <td className={cx('vx-td whitespace-nowrap text-sm', r.overdue ? 'text-risk' : 'text-ink-2')}>
                    {fmtTime(r.process.plannedStart)} – {fmtTime(r.process.plannedEnd)}
                    <span className="block text-2xs text-faint">{fmtDate(r.process.plannedEnd, 'dd MMM')}</span>
                  </td>
                  <td className="vx-td">
                    <button type="button" onClick={() => onOpen(r.order.id)} className="vx-code vx-focus rounded-xs font-semibold text-accent-text hover:underline">
                      {r.order.code}
                    </button>
                  </td>
                  <td className="vx-td vx-td-wrap">
                    {r.stage.index + 1}.{r.process.index + 1} {r.process.name}
                    <span className="vx-code block text-2xs text-faint" translate="no">
                      {r.stage.name} · {r.stage.stageDefId}
                    </span>
                    {!r.ready ? <span className="block text-2xs text-warn">Waiting for {[...new Set(r.blockers.map((b) => unitName(b.unitId)))].join(', ')}</span> : null}
                  </td>
                  <td className="vx-td">
                    <Badge tone="indigo">{unitName(r.process.unitId)}</Badge>
                  </td>
                  <td className="vx-td vx-td-wrap text-sm">
                    {r.order.customer.company}
                    <span className="block text-2xs text-faint">{r.order.productName}</span>
                  </td>
                  <td className="vx-td text-right tabular-nums">{pieces(r.order.quantity)}</td>
                  <td className="vx-td">
                    <ProcessBadge status={r.process.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

/* --------------------------------- Board ---------------------------------- */

function JobCard({ view, onOpen, unitName }: { view: JobView; onOpen: (id: string) => void; unitName: (id: string) => string }) {
  const { order } = view
  const cd = countdown(`${order.deliveryDate}T18:00:00`)
  return (
    <button type="button" onClick={() => onOpen(order.id)} className="vx-press vx-card vx-card-interactive vx-focus w-full px-4 py-3.5 text-left">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="vx-code truncate text-base font-semibold text-ink">{order.code}</p>
          <p className="mt-0.5 truncate text-xs text-muted">{order.customer.company}</p>
        </div>
        <Badge tone={HEALTH_TONE[view.health]} dot>
          {HEALTH_LABEL[view.health]}
        </Badge>
      </div>
      <p className="mt-2 truncate text-sm text-ink-2">{order.productName}</p>
      <p className="vx-code mt-1 text-xs text-muted">{pieces(order.quantity)}</p>
      <div className="mt-3">
        <ProgressBar value={view.progress} showLabel tone={view.health === 'Completed' ? 'green' : view.health === 'Delayed' ? 'red' : view.health === 'At Risk' ? 'amber' : 'blue'} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-rule pt-2.5 text-2xs">
        <span className="min-w-0 truncate font-medium text-ink-2">
          {view.current ? `${view.current.index + 1}/${view.totalStages} ${view.current.name} · ${stageUnitsLabel(view.current, unitName)}` : 'All stages closed'}
        </span>
        {view.health !== 'Completed' ? <span className={cx('vx-code shrink-0 font-semibold', cd.overdue ? 'text-risk' : 'text-muted')}>{cd.text}</span> : null}
      </div>
    </button>
  )
}

function UnitBoard({ views, units, onOpen, unitName }: { views: JobView[]; units: Array<{ id: string; name: string }>; onOpen: (id: string) => void; unitName: (id: string) => string }) {
  const columns = [
    ...units.map((u) => ({
      key: u.id,
      label: `At ${u.name}`,
      jobs: views.filter((v) => v.health !== 'Completed' && !!v.current?.processes.some((pr) => pr.unitId === u.id && pr.status !== 'Completed')),
      done: false,
    })),
    { key: 'done', label: 'Completed', jobs: views.filter((v) => v.health === 'Completed'), done: true },
  ]
  return (
    <div className="vx-anim-up -mx-1 overflow-x-auto px-1 pb-2">
      <div className="flex min-w-[1040px] gap-4">
        {columns.map((c) => (
          <section key={c.key} aria-label={c.label} className={cx('flex min-w-[218px] flex-1 flex-col rounded-lg border p-3', c.done ? 'border-ok-edge bg-ok-wash/60' : 'border-rule bg-surface-2')}>
            <div className="mb-3 flex items-center gap-2 px-1">
              <span className={cx('h-2 w-2 shrink-0 rounded-full', c.done ? 'bg-ok' : 'bg-accent')} aria-hidden="true" />
              <h3 className={cx('min-w-0 flex-1 truncate text-sm font-semibold', c.done ? 'text-ok' : 'text-ink')}>{c.label}</h3>
              <span className="vx-code rounded-xs bg-surface px-1.5 py-0.5 text-2xs font-semibold text-ink-2 ring-1 ring-inset ring-rule-2">{c.jobs.length}</span>
            </div>
            <div className="space-y-3">
              {c.jobs.length === 0 ? (
                <p className="rounded-md border border-dashed border-rule-2 px-3 py-7 text-center text-xs text-faint">No jobs</p>
              ) : (
                c.jobs.map((v) => <JobCard key={v.order.id} view={v} onOpen={onOpen} unitName={unitName} />)
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

/* -------------------------------- Timeline -------------------------------- */

function Timeline({ views, onOpen, unitName }: { views: JobView[]; onOpen: (id: string) => void; unitName: (id: string) => string }) {
  const [now] = useState(() => Date.now())
  return (
    <Card className="vx-anim-up overflow-hidden">
      <CardHead
        title="Production timeline"
        subtitle="Each bar is a product stage placed inside working hours"
        icon={<GanttChartSquare className="h-4 w-4" />}
        actions={
          <div className="flex flex-wrap items-center gap-2.5 text-2xs text-muted">
            {[
              ['bg-ok', 'Completed'],
              ['bg-live', 'In progress'],
              ['bg-hairline-strong', 'Scheduled'],
              ['bg-risk', 'Delayed / blocked'],
            ].map(([c, l]) => (
              <span key={l} className="inline-flex items-center gap-1.5">
                <span className={cx('h-2.5 w-2.5 rounded-sm', c)} aria-hidden="true" />
                {l}
              </span>
            ))}
          </div>
        }
      />
      <div className="divide-y divide-rule">
        {views.map((v) => {
          const stages = v.order.stages
          const first = new Date(stages[0]?.actualStart ?? stages[0]?.plannedStart ?? v.order.createdAt).getTime()
          const last = Math.max(new Date(stages[stages.length - 1]?.plannedEnd ?? v.order.deliveryDate).getTime(), new Date(`${v.order.deliveryDate}T18:00:00`).getTime())
          const span = Math.max(1, last - first)
          const nowPct = ((now - first) / span) * 100
          return (
            <button key={v.order.id} type="button" onClick={() => onOpen(v.order.id)} className="vx-press vx-focus block w-full px-5 py-3.5 text-left hover:bg-surface-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="vx-code text-sm font-semibold text-ink">{v.order.code}</span>
                <span className="min-w-0 truncate text-sm text-muted">{v.order.customer.company}</span>
                <HealthBadge health={v.health} />
                <PriorityBadge priority={v.order.priority} />
                <span className="ml-auto text-xs text-muted">delivery {fmtDate(v.order.deliveryDate, 'dd MMM')}</span>
              </div>
              <div className="relative mt-2.5 h-7 overflow-hidden rounded-md bg-surface-3" role="img" aria-label={`${v.order.code}: ${v.doneCount} of ${v.totalStages} stages closed`}>
                {stages.map((s) => {
                  const start = new Date(s.plannedStart).getTime()
                  const end = new Date(s.plannedEnd).getTime()
                  const color = isStageDone(s) ? 'bg-ok' : s.status === 'In Progress' ? 'bg-live' : s.status === 'Delayed' || s.status === 'Blocked' ? 'bg-risk' : 'bg-hairline-strong'
                  return (
                    <span
                      key={s.id}
                      title={`${s.index + 1}. ${s.name} · ${stageUnitsLabel(s, unitName)} — ${s.status} · ${planWindow(s.plannedStart, s.plannedEnd)}`}
                      className={cx('absolute top-1 h-5 rounded-[2px] border-r border-surface', color)}
                      style={{ left: `${((start - first) / span) * 100}%`, width: `${Math.max(1.2, ((end - start) / span) * 100)}%` }}
                    />
                  )
                })}
                {nowPct >= 0 && nowPct <= 100 ? <span className="absolute inset-y-0 w-0.5 bg-accent-hover" style={{ left: `${nowPct}%` }} aria-hidden="true" /> : null}
              </div>
              <p className="mt-1.5 text-xs text-muted">
                {v.current ? `Current: ${v.current.name} (${stageUnitsLabel(v.current, unitName)})` : 'All stages closed'}
                {v.next ? ` · Next: ${v.next.name} (${stageUnitsLabel(v.next, unitName)})` : ''} · {v.progress}%
              </p>
            </button>
          )
        })}
      </div>
    </Card>
  )
}

/* ---------------------------------- List ---------------------------------- */

function JobTable({ views, onOpen, unitName }: { views: JobView[]; onOpen: (id: string) => void; unitName: (id: string) => string }) {
  const [params, setParams] = useSearchParams()
  const size = 15
  const pageCount = Math.max(1, Math.ceil(views.length / size))
  const page = Math.min(pageCount, Math.max(1, Number(params.get('page')) || 1))
  const rows = views.slice((page - 1) * size, page * size)
  return (
    <Card className="vx-anim-up overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px]">
          <thead>
            <tr>
              <th className="vx-th">Job</th>
              <th className="vx-th">Customer</th>
              <th className="vx-th">Product</th>
              <th className="vx-th text-right">Qty</th>
              <th className="vx-th">Current stage · unit</th>
              <th className="vx-th">Units</th>
              <th className="vx-th w-[150px]">Progress</th>
              <th className="vx-th">Delivery</th>
              <th className="vx-th">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => {
              const cd = countdown(`${v.order.deliveryDate}T18:00:00`)
              return (
                <tr key={v.order.id} className="vx-row">
                  <td className="vx-td">
                    <button type="button" onClick={() => onOpen(v.order.id)} className="vx-code vx-focus rounded-xs font-semibold text-accent-text hover:underline">
                      {v.order.code}
                    </button>
                  </td>
                  <td className="vx-td vx-td-wrap font-medium text-ink">{v.order.customer.company}</td>
                  <td className="vx-td vx-td-wrap">{v.order.productName}</td>
                  <td className="vx-td text-right tabular-nums">{pieces(v.order.quantity)}</td>
                  <td className="vx-td vx-td-wrap">{v.current ? `${v.current.index + 1}. ${v.current.name} · ${stageUnitsLabel(v.current, unitName)}` : '—'}</td>
                  <td className="vx-td vx-code text-xs">
                    {[...new Set(v.order.stages.flatMap((s) => s.processes.map((pr) => unitName(pr.unitId))))].join(', ')}
                  </td>
                  <td className="vx-td">
                    <ProgressBar value={v.progress} showLabel tone={v.health === 'Completed' ? 'green' : v.health === 'Delayed' ? 'red' : v.health === 'At Risk' ? 'amber' : 'blue'} />
                  </td>
                  <td className="vx-td">
                    {fmtDate(v.order.deliveryDate, 'dd MMM')}
                    {v.health !== 'Completed' ? <span className={cx('block text-2xs', cd.overdue ? 'text-risk' : 'text-faint')}>{cd.text}</span> : null}
                  </td>
                  <td className="vx-td">
                    <HealthBadge health={v.health} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        pageCount={pageCount}
        total={views.length}
        label="jobs"
        onChange={(p) => {
          const next = new URLSearchParams(params)
          next.set('page', String(p))
          setParams(next, { replace: true })
        }}
      />
    </Card>
  )
}

/* -------------------------- Activity & notifications ---------------------- */

function RecentActivity() {
  const { db } = useStore()
  const entries = db.audit.filter((a) => a.entity === 'Stage' || a.entity === 'Production Order').slice(0, 12)
  return (
    <Card className="vx-anim-up overflow-hidden">
      <CardHead title="Recent production activity" subtitle="Who updated what, and when" icon={<Activity className="h-4 w-4" />} />
      {entries.length === 0 ? (
        <EmptyState icon={<Activity className="h-6 w-6" />} title="No production updates yet" message="Stage starts, completions and problems appear here." />
      ) : (
        <ul className="divide-y divide-rule">
          {entries.map((a) => (
            <li key={a.id} className="flex items-start gap-3 px-5 py-3">
              <span
                className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', /auto-closed/.test(a.action) ? 'bg-warn' : /completed/i.test(a.action) ? 'bg-ok' : /Problem/.test(a.action) ? 'bg-risk' : 'bg-live')}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{a.action}</p>
                <p className="truncate text-xs text-muted">{a.entityLabel}</p>
                <p className="text-2xs text-faint">
                  {a.user} · {fromNow(a.at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function NotificationList() {
  const { db, run, user } = useStore()
  const list = notificationsFor(db.notifications, user).slice(0, 12)
  const visible = (n: { audience: string; unitId?: string; topic?: string }) => isVisibleTo(n as Parameters<typeof isVisibleTo>[0], user)
  return (
    <Card className="vx-anim-up overflow-hidden">
      <CardHead title="Notifications" subtitle="Schedule alerts are re-checked every minute" icon={<BellRing className="h-4 w-4" />} actions={<Badge tone={list.some((n) => !n.read) ? 'red' : 'slate'}>{list.filter((n) => !n.read).length} unread</Badge>} />
      {list.length === 0 ? (
        <EmptyState icon={<CheckCircle2 className="h-6 w-6" />} title="Nothing needs attention" message="No stage is overdue and no delivery is at risk." />
      ) : (
        <ul className="divide-y divide-rule">
          {list.map((n) => (
            <li key={n.id}>
              <button type="button" onClick={() => run(markNotificationsRead([n.id], visible))} className={cx('vx-press vx-focus flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-surface-2', !n.read && 'bg-accent-wash')}>
                <span className={cx('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md', n.level === 'danger' ? 'bg-risk-wash text-risk' : n.level === 'warn' ? 'bg-warn-wash text-warn' : n.level === 'success' ? 'bg-ok-wash text-ok' : 'bg-live-wash text-live')} aria-hidden="true">
                  {n.level === 'success' ? <CheckCircle2 className="h-4 w-4" /> : n.level === 'info' ? <Clock3 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{n.title}</span>
                  <span className="mt-0.5 block break-words text-xs leading-relaxed text-ink-2">{n.message}</span>
                  <span className="mt-1 block text-2xs text-faint">{fromNow(n.createdAt)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
