import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, CalendarClock, CheckCircle2, Cog, Download, Eye, Factory, TriangleAlert, Users } from 'lucide-react'
import { useStore } from '../../store/store'
import type { UnitId, UnitMachine, UnitPerson } from '../../lib/types'
import { allJobViews, unitSummaries, unitWork } from '../../lib/selectors'
import type { ProcessWorkRow } from '../../lib/selectors'
import { fmtDate, pieces, planWindow } from '../../lib/format'
import { ResourceDrawer, since } from '../unit/ResourceDrawer'
import { Badge, Card, CardHead, EmptyState, ProgressBar } from '../../components/ui'
import { Detail, LinkButton, PageHeader, StatStrip, StatTile, useDocumentTitle } from '../../components/page'
import { DocumentPreview, DownloadButton, unitJobSheetDoc, unitTodayDoc, useLatestDb } from '../../components/DocumentPreview'
import type { PreviewDoc } from '../../components/DocumentPreview'
import { onDay } from '../../lib/unitDay'

/* ---------------------------------------------------------------------------
 * Units — a view of what each unit has been given. Units have no accounts and
 * report on paper: the office downloads a unit's work for today, or one job's
 * sheet, and sends it to the unit's in-charge. When the unit says a job is
 * done, the office marks it finished in Dispatch. Nothing here changes a record.
 * ------------------------------------------------------------------------- */

export function UnitsMonitorPage() {
  useDocumentTitle('Units')
  const { db } = useStore()
  const summaries = useMemo(() => unitSummaries(allJobViews(db), db.units), [db])
  const staffOf = (id: UnitId) => db.people.filter((p) => p.unitId === id && p.active).length
  const machinesOf = (id: UnitId) => db.machines.filter((m) => m.unitId === id && m.active).length
  const busiest = summaries.reduce((n, s) => n + s.openProcesses, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Production · Units"
        title="Units"
        subtitle="Open a unit to see the work it has been given and download today’s work or a job’s sheet to send to the unit’s in-charge."
        icon={<Building2 className="h-4 w-4" />}
      />

      <StatStrip className="grid-cols-2 lg:grid-cols-4">
        <StatTile label="Units" value={String(db.units.length)} icon={<Building2 className="h-4 w-4" />} tone="indigo" hint="Production units" />
        <StatTile label="Open processes" value={String(busiest)} icon={<Factory className="h-4 w-4" />} tone="blue" hint="Across all units" />
        <StatTile label="Running late" value={String(summaries.reduce((n, s) => n + s.delayedProcesses, 0))} icon={<TriangleAlert className="h-4 w-4" />} tone="amber" hint="Past planned time or blocked" />
        <StatTile label="Completed" value={String(summaries.reduce((n, s) => n + s.completedProcesses, 0))} icon={<CheckCircle2 className="h-4 w-4" />} tone="green" hint="Processes finished" />
      </StatStrip>

      <div className="grid gap-4 sm:grid-cols-2">
        {summaries.map((s) => (
          <Card key={s.unit.id} className="vx-anim-up p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link to={`/units/${s.unit.id}`} className="vx-focus rounded-xs text-lg font-semibold text-ink hover:text-accent-text hover:underline">
                  {s.unit.name}
                </Link>
                <p className="text-sm text-muted">{s.unit.speciality || 'Production unit'}</p>
              </div>
              <Badge tone={s.delayedProcesses ? 'amber' : s.openProcesses ? 'blue' : 'slate'} dot>
                {s.delayedProcesses ? `${s.delayedProcesses} late` : s.openProcesses ? 'Working' : 'Idle'}
              </Badge>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Detail label="Jobs here">{s.jobsHere}</Detail>
              <Detail label="Open">{s.openProcesses}</Detail>
              <Detail label="Ready">{s.readyProcesses}</Detail>
              <Detail label="Done">{s.completedProcesses}</Detail>
            </dl>
            <ProgressBar value={s.loadPct} tone={s.loadPct > 90 ? 'amber' : 'indigo'} className="mt-3" />
            <p className="mt-1 text-2xs text-faint">
              {s.loadPct}% of the unit’s daily capacity · {staffOf(s.unit.id)} staff · {machinesOf(s.unit.id)} machines
            </p>

            <LinkButton to={`/units/${s.unit.id}`} size="sm" variant="secondary" icon={<Eye className="h-3.5 w-3.5" />} className="mt-4">
              Watch this unit
            </LinkButton>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function UnitMonitorDetailPage() {
  const { unitId } = useParams()
  const { db, can } = useStore()
  const read = useLatestDb()
  const unit = db.units.find((u) => u.id === unitId)
  useDocumentTitle(`${unit?.shortName ?? 'Unit'} · Units`)
  const work = useMemo(() => (unitId ? unitWork(db.orders, unitId, new Date()) : null), [db.orders, unitId])
  const [preview, setPreview] = useState<PreviewDoc | null>(null)
  const [who, setWho] = useState<UnitPerson | UnitMachine | null>(null)

  if (!unit || !work)
    return (
      <Card>
        <EmptyState icon={<Building2 className="h-6 w-6" />} title="Unit not found" message="This unit does not exist." action={<LinkButton to="/units">All units</LinkButton>} />
      </Card>
    )

  const open = [...work.ready, ...work.waiting].sort((a, b) => a.process.plannedStart.localeCompare(b.process.plannedStart))
  const today = open.filter((r) => onDay(r.process.plannedStart, r.process.plannedEnd, new Date()))
  const jobs = new Set(open.map((r) => r.order.id)).size
  const staff = db.people.filter((p) => p.unitId === unit.id && p.active)
  const machines = db.machines.filter((m) => m.unitId === unit.id && m.active)
  const openSheet = (orderId: string) => setPreview(unitJobSheetDoc(read, orderId, unit.id))
  const manage = can('administration') ? (
    <LinkButton to={`/settings?unit=${unit.id}`} size="sm" variant="secondary">
      Manage in Settings
    </LinkButton>
  ) : undefined

  return (
    <div className="space-y-6">
      <LinkButton to="/units" variant="ghost" icon={<ArrowLeft className="h-4 w-4" />}>
        All units
      </LinkButton>

      <PageHeader
        eyebrow="Units · View"
        title={unit.name}
        subtitle={`The work ${unit.shortName} has been given in plans. Download today’s work, or open a job number for its sheet, and send it to the unit’s in-charge. When the unit says a job is done, mark it finished in Dispatch.`}
        icon={<Factory className="h-4 w-4" />}
        actions={
          <DownloadButton icon={<Download className="h-4 w-4" />} doc={() => unitTodayDoc(read, unit.id)} disabled={!today.length} title={today.length ? undefined : 'Nothing is planned for this unit today'}>
            Download today’s work
          </DownloadButton>
        }
      />

      <StatStrip className="grid-cols-1 sm:grid-cols-3">
        <StatTile label="Today" value={String(today.length)} icon={<CalendarClock className="h-4 w-4" />} tone="indigo" hint="Processes planned for today" />
        <StatTile label="Open jobs" value={String(jobs)} icon={<Factory className="h-4 w-4" />} tone="blue" hint="Jobs with work for this unit" />
        <StatTile label="Open processes" value={String(open.length)} icon={<CheckCircle2 className="h-4 w-4" />} tone="slate" hint="Not finished yet" />
      </StatStrip>

      <Card className="vx-anim-up overflow-hidden">
        <CardHead title="Today’s work" subtitle={fmtDate(new Date(), 'EEEE, dd MMM yyyy')} />
        <WorkTable rows={today} onOpen={openSheet} empty="Nothing is planned for this unit today." />
      </Card>

      <Card className="vx-anim-up overflow-hidden">
        <CardHead title="All open work" subtitle={`${open.length} process(es) across ${jobs} job(s)`} />
        <WorkTable rows={open} onOpen={openSheet} empty="This unit has no open work." />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="vx-anim-up overflow-hidden">
          <CardHead title="Staff" subtitle={`${staff.length} in this unit`} actions={manage} />
          {staff.length === 0 ? (
            <EmptyState icon={<Users className="h-6 w-6" />} title="No staff" message="Add the unit’s people in Settings → People." />
          ) : (
            <ul className="divide-y divide-rule">
              {staff.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => setWho(p)} className="vx-focus block w-full px-5 py-2.5 text-left text-sm hover:bg-surface-2">
                    <span className="block font-medium text-ink">{p.name}</span>
                    <span className="block text-2xs text-faint">{[p.designation, p.experienceYears != null ? `${p.experienceYears} yrs exp.` : '', p.joinedOn ? `with the unit ${since(p.joinedOn)}` : ''].filter(Boolean).join(' · ') || 'No details added'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="vx-anim-up overflow-hidden">
          <CardHead title="Machines" subtitle={`${machines.length} in service`} actions={manage} />
          {machines.length === 0 ? (
            <EmptyState icon={<Cog className="h-6 w-6" />} title="No machines" message="Add the unit’s machines in Settings → Machines." />
          ) : (
            <ul className="divide-y divide-rule">
              {machines.map((m) => (
                <li key={m.id}>
                  <button type="button" onClick={() => setWho(m)} className="vx-focus block w-full px-5 py-2.5 text-left text-sm hover:bg-surface-2">
                    <span className="block font-medium text-ink">{m.name}</span>
                    <span className="block text-2xs text-faint">{[m.code, [m.make, m.model].filter(Boolean).join(' '), m.installedYear ? `${since(m.installedYear)} old` : '', m.capacity].filter(Boolean).join(' · ') || 'No details added'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <DocumentPreview doc={preview} onClose={() => setPreview(null)} />
      <ResourceDrawer
        item={who ? ('designation' in who ? { kind: 'person', value: who } : { kind: 'machine', value: who }) : null}
        readOnly
        onClose={() => setWho(null)}
      />
    </div>
  )
}

/** A unit's processes, read-only. The job number opens that job's sheet for this unit. */
function WorkTable({ rows, onOpen, empty }: { rows: ProcessWorkRow[]; onOpen: (orderId: string) => void; empty: string }) {
  if (!rows.length) return <p className="px-5 py-6 text-sm text-muted">{empty}</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px]">
        <thead>
          <tr>
            <th className="vx-th">Job</th>
            <th className="vx-th">Process</th>
            <th className="vx-th">Planned</th>
            <th className="vx-th">Delivery</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-rule">
              <td className="vx-td">
                <button type="button" onClick={() => onOpen(r.order.id)} className="vx-focus vx-code rounded-xs font-semibold text-accent-text hover:underline" aria-label={`${r.order.code} — open this unit’s job sheet`}>
                  {r.order.code}
                </button>
                <span className="block text-2xs text-faint">
                  {r.order.productName} · {pieces(r.order.quantity)}
                </span>
              </td>
              <td className="vx-td">
                {r.process.name}
                <span className="block text-2xs text-faint">{r.process.stageName}</span>
              </td>
              <td className="vx-td text-sm">{planWindow(r.process.plannedStart, r.process.plannedEnd)}</td>
              <td className="vx-td text-sm">{fmtDate(r.order.deliveryDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
