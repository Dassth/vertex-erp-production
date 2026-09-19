import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { CheckCircle2, Cog, Eye, Factory, Home, Hourglass, Pencil, Play, RotateCcw, Timer, Trash2, UserCog, Users } from 'lucide-react'
import { useStore } from '../../store/store'
import type { UnitId, UnitMachine, UnitPerson } from '../../lib/types'
import { unitWork } from '../../lib/selectors'
import type { ProcessWorkRow } from '../../lib/selectors'
import { fmtDate, fmtDateTime, pieces, planWindow } from '../../lib/format'
import { setMachineActive, setPersonActive } from '../../domain/resources'
import { Badge, Button, Card, CardHead, ConfirmDialog, EmptyState, Segmented } from '../../components/ui'
import { LinkButton, PageHeader, StatStrip, StatTile, useDocumentTitle } from '../../components/page'
import { PriorityBadge, ProcessBadge } from '../../components/status'
import { ResourceDialog } from '../production/UnitWorkPage'
import { ResourceAdd } from '../production/UnitResourceSetup'
import { ResourceDrawer, since } from './ResourceDrawer'

/* ---------------------------------------------------------------------------
 * The unit account's own area:
 *   Home        — today at a glance
 *   Allocations — choose the person and machine for every open process
 *   Production  — start and complete work (the existing shop-floor screen)
 *   Staff       — add and remove the unit's people
 *   Machines    — add and remove the unit's machines
 * Everything is scoped to the signed-in unit.
 * ------------------------------------------------------------------------- */

function useUnit(): { unitId: UnitId; unitName: string } | null {
  const { user, db } = useStore()
  if (user?.role !== 'unit' || !user.unitId) return null
  const unit = db.units.find((u) => u.id === user.unitId)
  return { unitId: user.unitId, unitName: unit?.name ?? user.unitId }
}

/** Open (not completed) processes that use this person or machine. */
function openUses(orders: ReturnType<typeof useStore>['db']['orders'], match: (p: ProcessWorkRow['process']) => boolean): number {
  return orders.reduce((n, o) => n + o.stages.reduce((m, s) => m + s.processes.filter((p) => p.status !== 'Completed' && match(p)).length, 0), 0)
}

/* ---------------------------------- Home ---------------------------------- */

export function UnitHomePage() {
  const unit = useUnit()
  const { db } = useStore()
  useDocumentTitle('Home')
  const unitId = unit?.unitId
  const work = useMemo(() => (unitId ? unitWork(db.orders, unitId) : null), [db.orders, unitId])
  if (!unit || !work) return <Navigate to="/production" replace />
  const running = work.ready.filter((r) => r.process.status === 'In Progress')
  const staff = db.people.filter((p) => p.unitId === unit.unitId && p.active).length
  const machines = db.machines.filter((m) => m.unitId === unit.unitId && m.active).length
  const next = work.ready.slice(0, 6)

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Unit · Home" title={`${unit.unitName}`} subtitle="Your unit today: what is running, what is ready to start, and what still needs a person or machine." icon={<Home className="h-4 w-4" />} />

      <StatStrip className="grid-cols-2 lg:grid-cols-4">
        <StatTile label="Ready now" value={String(work.ready.length)} icon={<Timer className="h-4 w-4" />} tone="indigo" hint="Earlier processes are done" />
        <StatTile label="In progress" value={String(running.length)} icon={<Play className="h-4 w-4" />} tone="blue" hint="Started by your unit" />
        <StatTile label="Waiting" value={String(work.waiting.length)} icon={<Hourglass className="h-4 w-4" />} tone="slate" hint="An earlier process is still open" />
        <StatTile label="Needs a person" value={String(work.needsResources.length)} icon={<UserCog className="h-4 w-4" />} tone="amber" hint="Allocate before starting" />
      </StatStrip>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="vx-anim-up overflow-hidden">
          <CardHead title="Next up" subtitle="Processes ready for your unit, earliest planned first" actions={<LinkButton to="/production" size="sm" variant="secondary">Open production</LinkButton>} />
          {next.length === 0 ? (
            <EmptyState icon={<CheckCircle2 className="h-6 w-6" />} title="Nothing ready right now" message="Work appears here when an order is released or an earlier process is completed." />
          ) : (
            <ul className="divide-y divide-rule">
              {next.map((r) => (
                <li key={r.key} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="vx-code text-sm font-semibold text-ink">{r.order.code}</span>
                      <PriorityBadge priority={r.order.priority} />
                      <ProcessBadge status={r.process.status} />
                    </p>
                    <p className="text-sm text-ink-2">
                      {r.process.stageName} › {r.process.name} · {pieces(r.order.quantity)}
                    </p>
                    <p className="text-2xs text-faint">{planWindow(r.process.plannedStart, r.process.plannedEnd)}</p>
                  </div>
                  <span className="text-right text-xs text-muted">
                    {db.people.find((p) => p.id === r.process.responsiblePersonId)?.name ?? <span className="text-warn">No person yet</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="vx-anim-up p-5">
            <p className="vx-label">Your team</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Link to="/unit/staff" className="vx-focus rounded-md border border-rule p-3 hover:bg-surface-2">
                <Users className="h-4 w-4 text-faint" aria-hidden="true" />
                <span className="mt-1 block text-lg font-semibold text-ink">{staff}</span>
                <span className="text-xs text-muted">Staff</span>
              </Link>
              <Link to="/unit/machines" className="vx-focus rounded-md border border-rule p-3 hover:bg-surface-2">
                <Cog className="h-4 w-4 text-faint" aria-hidden="true" />
                <span className="mt-1 block text-lg font-semibold text-ink">{machines}</span>
                <span className="text-xs text-muted">Machines</span>
              </Link>
            </div>
          </Card>
          {work.needsResources.length ? (
            <Card className="vx-anim-up border-warn-edge p-5">
              <p className="text-sm font-semibold text-ink">{work.needsResources.length} process(es) need a person or machine</p>
              <p className="mt-1 text-xs text-muted">They cannot be started until someone is allocated.</p>
              <LinkButton to="/unit/allocations" size="sm" className="mt-3">
                Allocate now
              </LinkButton>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------- Allocations ------------------------------ */

type AllocFilter = 'needs' | 'open'

export function UnitAllocationsPage() {
  const unit = useUnit()
  const { db } = useStore()
  useDocumentTitle('Allocations')
  const [filter, setFilter] = useState<AllocFilter>('needs')
  const [editing, setEditing] = useState<ProcessWorkRow | null>(null)
  const unitId = unit?.unitId
  const work = useMemo(() => (unitId ? unitWork(db.orders, unitId) : null), [db.orders, unitId])
  if (!unit || !work) return <Navigate to="/production" replace />
  const open = [...work.ready, ...work.waiting].sort((a, b) => a.process.plannedStart.localeCompare(b.process.plannedStart))
  const rows = filter === 'needs' ? work.needsResources : open
  const person = (id: string | null) => db.people.find((p) => p.id === id)?.name
  const machine = (id: string | null) => db.machines.find((m) => m.id === id)?.name

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Unit · Allocations"
        title="Allocations"
        subtitle="Choose who is responsible and which machine runs each process allocated to your unit. A process can only be started once it has a person (and a machine, unless it is manual)."
        icon={<UserCog className="h-4 w-4" />}
      />
      <Segmented<AllocFilter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'needs', label: 'Needs a person or machine', count: work.needsResources.length },
          { value: 'open', label: 'All open processes', count: open.length },
        ]}
      />
      <Card className="vx-anim-up overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-6 w-6" />}
            title={filter === 'needs' ? 'Everything is allocated' : 'No open processes'}
            message={filter === 'needs' ? 'Every open process has its person and machine.' : 'New work appears here when an order is released to production.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px]">
              <thead>
                <tr>
                  <th className="vx-th">Job</th>
                  <th className="vx-th">Process</th>
                  <th className="vx-th">Planned</th>
                  <th className="vx-th">Person</th>
                  <th className="vx-th">Machine</th>
                  <th className="vx-th">State</th>
                  <th className="vx-th" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-t border-rule">
                    <td className="vx-td">
                      <span className="vx-code font-semibold text-ink">{r.order.code}</span>
                      <span className="block text-2xs text-faint">
                        {r.order.customer.company} · {r.order.productName}
                      </span>
                    </td>
                    <td className="vx-td">
                      {r.process.name}
                      <span className="block text-2xs text-faint">{r.process.stageName}</span>
                    </td>
                    <td className="vx-td text-sm">{planWindow(r.process.plannedStart, r.process.plannedEnd)}</td>
                    <td className="vx-td">{person(r.process.responsiblePersonId) ?? <span className="text-warn">Not assigned</span>}</td>
                    <td className="vx-td">
                      {r.process.noMachineRequired ? <span className="text-muted">No machine</span> : machine(r.process.machineId) ?? (r.process.requiresMachine ? <span className="text-warn">Not assigned</span> : <span className="text-muted">—</span>)}
                    </td>
                    <td className="vx-td">
                      {r.ready ? <Badge tone="indigo">Ready</Badge> : <Badge tone="slate">Waiting</Badge>}
                    </td>
                    <td className="vx-td text-right">
                      <Button size="sm" variant={r.process.responsiblePersonId ? 'secondary' : 'primary'} icon={<UserCog className="h-3.5 w-3.5" />} onClick={() => setEditing(r)}>
                        {r.process.responsiblePersonId ? 'Change' : 'Allocate'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {editing ? <ResourceDialog key={editing.key} open onClose={() => setEditing(null)} row={editing} /> : null}
    </div>
  )
}

/* ---------------------------- Staff and machines --------------------------- */

export function UnitStaffPage() {
  return <UnitResources kind="person" />
}

export function UnitMachinesPage() {
  return <UnitResources kind="machine" />
}

function UnitResources({ kind }: { kind: 'person' | 'machine' }) {
  const unit = useUnit()
  const { db, run, pushToast } = useStore()
  const isPerson = kind === 'person'
  useDocumentTitle(isPerson ? 'Staff' : 'Machines')
  const [removing, setRemoving] = useState<UnitPerson | UnitMachine | null>(null)
  const [viewing, setViewing] = useState<{ value: UnitPerson | UnitMachine; edit: boolean } | null>(null)
  if (!unit) return <Navigate to="/production" replace />
  const list: Array<UnitPerson | UnitMachine> = (isPerson ? db.people : db.machines).filter((x) => x.unitId === unit.unitId)
  const active = list.filter((x) => x.active).sort((a, b) => a.name.localeCompare(b.name))
  const removed = list.filter((x) => !x.active).sort((a, b) => a.name.localeCompare(b.name))
  const uses = (id: string) => openUses(db.orders, (p) => (isPerson ? p.responsiblePersonId === id : p.machineId === id))
  const noun = isPerson ? 'staff member' : 'machine'

  const setActive = async (item: UnitPerson | UnitMachine, value: boolean) => {
    const r = isPerson ? await run(setPersonActive(item.id, value)) : await run(setMachineActive(item.id, value))
    if (!r.ok) pushToast({ title: `${item.name} not ${value ? 'restored' : 'removed'}`, message: r.error, level: 'danger' })
    else pushToast({ title: `${item.name} ${value ? 'restored' : 'removed'}`, message: value ? 'Available for allocation again.' : 'No longer offered for allocation. Past work keeps the name.', level: 'success' })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Unit · ${isPerson ? 'Staff' : 'Machines'}`}
        title={isPerson ? 'Staff' : 'Machines'}
        subtitle={isPerson ? `People who work in ${unit.unitName}. Add someone to make them available for allocation; remove them when they leave.` : `Machines in ${unit.unitName}. Add a machine to use it in allocations; remove it when it is out of service.`}
        icon={isPerson ? <Users className="h-4 w-4" /> : <Cog className="h-4 w-4" />}
      />

      <Card className="vx-anim-up p-5">
        <div className="max-w-md">
          <ResourceAdd unitId={unit.unitId} kind={kind} />
        </div>
      </Card>

      <Card className="vx-anim-up overflow-hidden">
        <CardHead title={isPerson ? 'Current staff' : 'Machines in service'} subtitle={`${active.length} ${noun}(s)`} />
        {active.length === 0 ? (
          <EmptyState icon={isPerson ? <Users className="h-6 w-6" /> : <Factory className="h-6 w-6" />} title={isPerson ? 'No staff yet' : 'No machines yet'} message={`Add the first ${noun} above.`} />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="vx-th">Name</th>
                <th className="vx-th">{isPerson ? 'Role · experience' : 'Make / model · age'}</th>
                <th className="vx-th">Added</th>
                <th className="vx-th text-right">Open processes</th>
                <th className="vx-th" />
              </tr>
            </thead>
            <tbody>
              {active.map((x) => {
                const n = uses(x.id)
                return (
                  <tr key={x.id} onClick={() => setViewing({ value: x, edit: false })} className="cursor-pointer border-t border-rule transition-colors hover:bg-surface-2">
                    <td className="vx-td font-medium text-ink">
                      {x.name}
                      {'code' in x && x.code ? <span className="vx-code ml-2 text-2xs text-faint">{x.code}</span> : null}
                    </td>
                    <td className="vx-td text-sm text-ink-2">
                      {'designation' in x
                        ? [x.designation, x.experienceYears != null ? `${x.experienceYears} yrs exp.` : ''].filter(Boolean).join(' · ') || <span className="text-faint">Add details</span>
                        : [[x.make, x.model].filter(Boolean).join(' '), x.installedYear ? since(x.installedYear) + ' old' : ''].filter(Boolean).join(' · ') || <span className="text-faint">Add details</span>}
                    </td>
                    <td className="vx-td text-sm text-muted">
                      {fmtDate(x.createdAt)} · {x.createdBy}
                    </td>
                    <td className="vx-td vx-code text-right">{n}</td>
                    <td className="vx-td" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => setViewing({ value: x, edit: false })} aria-label={`View ${x.name}`}>
                          View
                        </Button>
                        <Button size="sm" variant="secondary" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setViewing({ value: x, edit: true })} aria-label={`Edit ${x.name}`}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setRemoving(x)} aria-label={`Remove ${x.name}`}>
                          Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>

      {removed.length ? (
        <Card className="vx-anim-up overflow-hidden">
          <CardHead title="Removed" subtitle="Kept so past work still shows who did it. Restore to allocate again." />
          <ul className="divide-y divide-rule">
            {removed.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <span className="text-sm text-muted">
                  {x.name} <span className="text-2xs text-faint">· removed {fmtDateTime(x.updatedAt)}</span>
                </span>
                <Button size="sm" variant="secondary" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => setActive(x, true)}>
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <ResourceDrawer
        item={viewing ? (isPerson ? { kind: 'person', value: viewing.value as UnitPerson } : { kind: 'machine', value: viewing.value as UnitMachine }) : null}
        edit={viewing?.edit}
        onClose={() => setViewing(null)}
      />
      <ConfirmDialog
        open={!!removing}
        tone="danger"
        title={`Remove ${removing?.name ?? ''}?`}
        confirmLabel="Remove"
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          const item = removing
          setRemoving(null)
          if (item) await setActive(item, false)
        }}
        body={
          removing && uses(removing.id) > 0
            ? `${removing.name} is still on ${uses(removing.id)} open process(es). Allocate someone else to them first, in Allocations.`
            : `${removing?.name ?? ''} will no longer be offered in allocations. Completed work keeps the name, and you can restore it later.`
        }
      />
    </div>
  )
}
