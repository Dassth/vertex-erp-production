import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Building2, CheckCircle2, Cog, Eye, Factory, TriangleAlert, Users } from 'lucide-react'
import { useStore } from '../../store/store'
import type { UnitId, UnitMachine, UnitPerson } from '../../lib/types'
import { allJobViews, unitSummaries } from '../../lib/selectors'
import { ResourceDrawer, since } from '../unit/ResourceDrawer'
import { Badge, Card, CardHead, EmptyState, ProgressBar } from '../../components/ui'
import { Detail, LinkButton, PageHeader, StatStrip, StatTile, useDocumentTitle } from '../../components/page'
import { UnitWorkPage } from '../production/UnitWorkPage'

/* ---------------------------------------------------------------------------
 * Units — where administrators run each unit's work. Units have no accounts:
 * open a unit to allocate people and machines, print a job's sheet for the
 * unit's in-charge (to hand over or send on WhatsApp), and record progress.
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
        subtitle="Open a unit to allocate its work, print each job’s sheet for the unit’s in-charge, and record progress as the unit reports back."
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
  const unit = db.units.find((u) => u.id === unitId)
  const [who, setWho] = useState<UnitPerson | UnitMachine | null>(null)

  if (!unit)
    return (
      <Card>
        <EmptyState icon={<Building2 className="h-6 w-6" />} title="Unit not found" message="This unit does not exist." action={<LinkButton to="/units">All units</LinkButton>} />
      </Card>
    )

  const staff = db.people.filter((p) => p.unitId === unit.id && p.active)
  const machines = db.machines.filter((m) => m.unitId === unit.id && m.active)
  const manage = can('administration') ? (
    <LinkButton to={`/settings?unit=${unit.id}`} size="sm" variant="secondary">
      Manage in Settings
    </LinkButton>
  ) : undefined

  return (
    <div className="space-y-6">
      <UnitWorkPage unitId={unit.id} />

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

      <ResourceDrawer
        item={who ? ('designation' in who ? { kind: 'person', value: who } : { kind: 'machine', value: who }) : null}
        readOnly
        onClose={() => setWho(null)}
      />
    </div>
  )
}
