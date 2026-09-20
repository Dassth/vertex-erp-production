import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, CheckCircle2, Cog, Eye, Factory, Timer, TriangleAlert, Users } from 'lucide-react'
import { useStore } from '../../store/store'
import type { UnitId } from '../../lib/types'
import { allJobViews, unitSummaries, unitWork } from '../../lib/selectors'
import { fmtDate, fmtDateTime, pieces, planWindow } from '../../lib/format'
import { since } from '../unit/ResourceDrawer'
import { Badge, Card, CardHead, EmptyState, ProgressBar } from '../../components/ui'
import { Detail, LinkButton, PageHeader, StatStrip, StatTile, useDocumentTitle } from '../../components/page'
import { PriorityBadge, ProcessBadge } from '../../components/status'

/* ---------------------------------------------------------------------------
 * Units — every administrator can watch what each unit is working on.
 *
 * Read-only by design: only the unit itself allocates people and machines and
 * records progress. Nothing here changes a record.
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
        subtitle="What every production unit is working on right now. Watching only — units allocate their own people and machines and record their own progress."
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
  const { db } = useStore()
  const unit = db.units.find((u) => u.id === unitId)
  useDocumentTitle(unit?.shortName ?? 'Unit')
  const work = useMemo(() => (unitId ? unitWork(db.orders, unitId, new Date()) : null), [db.orders, unitId])

  if (!unit || !work)
    return (
      <Card>
        <EmptyState icon={<Building2 className="h-6 w-6" />} title="Unit not found" message="This unit does not exist." action={<LinkButton to="/units">All units</LinkButton>} />
      </Card>
    )

  const staff = db.people.filter((p) => p.unitId === unit.id && p.active)
  const machines = db.machines.filter((m) => m.unitId === unit.id && m.active)
  const running = work.ready.filter((r) => r.process.status === 'In Progress')
  const person = (id: string | null) => db.people.find((p) => p.id === id)?.name
  const machine = (id: string | null) => db.machines.find((m) => m.id === id)?.name

  return (
    <div className="space-y-6">
      <LinkButton to="/units" variant="ghost" icon={<ArrowLeft className="h-4 w-4" />}>
        All units
      </LinkButton>

      <PageHeader
        eyebrow="Units · Watching"
        title={unit.name}
        subtitle={`${unit.speciality || 'Production unit'}. You are watching this unit — only ${unit.shortName} can allocate its people and machines or record progress.`}
        icon={<Factory className="h-4 w-4" />}
      />

      <StatStrip className="grid-cols-2 lg:grid-cols-4">
        <StatTile label="In progress" value={String(running.length)} icon={<Timer className="h-4 w-4" />} tone="blue" hint="Started by the unit" />
        <StatTile label="Ready now" value={String(work.ready.length - running.length)} icon={<Factory className="h-4 w-4" />} tone="indigo" hint="Can be started" />
        <StatTile label="Waiting" value={String(work.waiting.length)} icon={<Timer className="h-4 w-4" />} tone="slate" hint="An earlier process is open" />
        <StatTile label="Needs a person" value={String(work.needsResources.length)} icon={<Users className="h-4 w-4" />} tone="amber" hint="Not allocated yet" />
      </StatStrip>

      <Card className="vx-anim-up overflow-hidden">
        <CardHead title="Open work" subtitle={`${work.ready.length + work.waiting.length} process(es) allocated to ${unit.shortName}`} />
        {work.ready.length + work.waiting.length === 0 ? (
          <EmptyState icon={<CheckCircle2 className="h-6 w-6" />} title="Nothing open" message="This unit has no open processes right now." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px]">
              <thead>
                <tr>
                  <th className="vx-th">Job</th>
                  <th className="vx-th">Process</th>
                  <th className="vx-th">Person</th>
                  <th className="vx-th">Machine</th>
                  <th className="vx-th">Planned</th>
                  <th className="vx-th">Status</th>
                </tr>
              </thead>
              <tbody>
                {[...work.ready, ...work.waiting].map((r) => (
                  <tr key={r.key} className="border-t border-rule">
                    <td className="vx-td">
                      <span className="vx-code font-semibold text-ink">{r.order.code}</span>
                      <span className="block text-2xs text-faint">
                        {r.order.customer.company} · {pieces(r.order.quantity)}
                      </span>
                    </td>
                    <td className="vx-td">
                      {r.process.name}
                      <span className="block text-2xs text-faint">{r.process.stageName}</span>
                    </td>
                    <td className="vx-td">{person(r.process.responsiblePersonId) ?? <span className="text-warn">Not allocated</span>}</td>
                    <td className="vx-td">{r.process.noMachineRequired ? <span className="text-muted">No machine</span> : machine(r.process.machineId) ?? <span className="text-muted">—</span>}</td>
                    <td className="vx-td text-sm">{planWindow(r.process.plannedStart, r.process.plannedEnd)}</td>
                    <td className="vx-td">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <ProcessBadge status={r.process.status} />
                        {r.ready ? null : <Badge tone="slate">Waiting</Badge>}
                        <PriorityBadge priority={r.order.priority} />
                      </span>
                      {r.process.problem ? <span className="mt-0.5 block text-2xs text-risk">Problem: {r.process.problem}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="vx-anim-up overflow-hidden">
          <CardHead title="Staff" subtitle={`${staff.length} in this unit`} />
          {staff.length === 0 ? (
            <EmptyState icon={<Users className="h-6 w-6" />} title="No staff" message="The unit has not added anyone yet." />
          ) : (
            <ul className="divide-y divide-rule">
              {staff.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <span>
                    <span className="font-medium text-ink">{p.name}</span>
                    <span className="block text-2xs text-faint">{[p.designation, p.experienceYears != null ? `${p.experienceYears} yrs exp.` : '', p.joinedOn ? `with the unit ${since(p.joinedOn)}` : ''].filter(Boolean).join(' · ') || 'No details added'}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="vx-anim-up overflow-hidden">
          <CardHead title="Machines" subtitle={`${machines.length} in service`} />
          {machines.length === 0 ? (
            <EmptyState icon={<Cog className="h-6 w-6" />} title="No machines" message="The unit has not added any machine yet." />
          ) : (
            <ul className="divide-y divide-rule">
              {machines.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <span>
                    <span className="font-medium text-ink">{m.name}</span>
                    <span className="block text-2xs text-faint">{[m.code, [m.make, m.model].filter(Boolean).join(' '), m.installedYear ? `${since(m.installedYear)} old` : '', m.capacity].filter(Boolean).join(' · ') || 'No details added'}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="vx-anim-up overflow-hidden">
        <CardHead title="Recently completed" subtitle="Latest processes this unit finished" />
        {work.completed.length === 0 ? (
          <EmptyState icon={<CheckCircle2 className="h-6 w-6" />} title="Nothing completed yet" message="Completed work appears here." />
        ) : (
          <ul className="divide-y divide-rule">
            {work.completed.slice(0, 10).map((r) => (
              <li key={r.key} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm">
                <span>
                  <span className="vx-code font-semibold text-ink">{r.order.code}</span> · {r.process.name}
                  <span className="block text-2xs text-faint">
                    {person(r.process.responsiblePersonId) ?? 'Not recorded'} · {r.process.doneBy ? `closed by ${r.process.doneBy}` : ''}
                  </span>
                </span>
                <span className="text-xs text-muted">{r.process.actualEnd ? fmtDateTime(r.process.actualEnd) : fmtDate(r.order.deliveryDate)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
