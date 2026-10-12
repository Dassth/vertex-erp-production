import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Factory, Plus, UserCog, Wrench } from 'lucide-react'
import { useStore } from '../../store/store'
import type { ProductionUnit, UnitMachine, UnitPerson } from '../../lib/types'
import { saveMachine, savePerson, setMachineActive, setPersonActive } from '../../domain/resources'
import { Badge, Button, Card, CardHead, EmptyState, Field, Input, Segmented, Select } from '../../components/ui'
import { PageHeader, StatStrip, StatTile, useDocumentTitle } from '../../components/page'
import { BackupPanel } from './BackupPanel'
import { UnitDialog } from '../units/UnitDialog'

/* Execution resources — units, the people who take responsibility for process
   work and the machines they run. Administration only (Administrator 1).
   Master deliberately stays Products, Costing and Customers. */

type Tab = 'people' | 'machines' | 'units' | 'backup'

export function SettingsPage() {
  useDocumentTitle('Settings')
  const { db } = useStore()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') ?? 'backup') as Tab
  const unitFilter = params.get('unit') ?? ''

  const setTab = (t: Tab) => {
    const next = new URLSearchParams(params)
    if (t === 'backup') next.delete('tab')
    else next.set('tab', t)
    setParams(next, { replace: true })
  }
  const setUnitFilter = (u: string) => {
    const next = new URLSearchParams(params)
    if (u) next.set('unit', u)
    else next.delete('unit')
    setParams(next, { replace: true })
  }

  const people = useMemo(() => db.people.filter((p) => !unitFilter || p.unitId === unitFilter), [db.people, unitFilter])
  const machines = useMemo(() => db.machines.filter((m) => !unitFilter || m.unitId === unitFilter), [db.machines, unitFilter])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Settings"
        subtitle="Download a backup or import one, and manage production units, people and machines."
        icon={<Wrench className="h-4 w-4" />}
      />

      <StatStrip className="sm:grid-cols-3">
        <StatTile label="Units" value={String(db.units.length)} icon={<Factory className="h-4 w-4" />} tone="indigo" hint="Allocated in Planning" />
        <StatTile label="People" value={String(db.people.filter((p) => p.active).length)} icon={<UserCog className="h-4 w-4" />} tone="green" hint="Active across all units" />
        <StatTile label="Machines" value={String(db.machines.filter((m) => m.active).length)} icon={<Wrench className="h-4 w-4" />} tone="violet" hint="Active across all units" />
      </StatStrip>

      <div className="vx-card flex flex-wrap items-center justify-between gap-3 px-3 py-3">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'backup', label: 'Backup & Import' },
            { value: 'people', label: 'People', count: db.people.length },
            { value: 'machines', label: 'Machines', count: db.machines.length },
            { value: 'units', label: 'Units', count: db.units.length },
          ]}
        />
        {tab !== 'units' && tab !== 'backup' ? (
          <label className="flex items-center gap-2">
            <span className="vx-mono-label !mb-0">Unit</span>
            <Select value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)} className="h-9 w-44 text-sm">
              <option value="">All units</option>
              {db.units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </label>
        ) : null}
      </div>

      {tab === 'people' ? <PeoplePanel people={people} defaultUnit={unitFilter} /> : null}
      {tab === 'machines' ? <MachinePanel machines={machines} defaultUnit={unitFilter} /> : null}
      {tab === 'units' ? <UnitPanel /> : null}
      {tab === 'backup' ? <BackupPanel /> : null}
    </div>
  )
}

/* --------------------------------- People --------------------------------- */

function PeoplePanel({ people, defaultUnit }: { people: UnitPerson[]; defaultUnit: string }) {
  const { db, run, pushToast } = useStore()
  const [draft, setDraft] = useState({ unitId: defaultUnit || db.units[0]?.id || '', name: '', designation: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const add = async () => {
    setBusy(true)
    const r = await run(savePerson({ unitId: draft.unitId, name: draft.name, designation: draft.designation }))
    setBusy(false)
    if (!r.ok) {
      setErrors(r.fieldErrors ?? { name: r.error })
      return
    }
    setErrors({})
    setDraft({ unitId: draft.unitId, name: '', designation: '' })
    pushToast({ title: `${r.value.name} added to ${r.value.unitId}`, level: 'success' })
  }

  return (
    <Card className="vx-anim-up overflow-hidden">
      <CardHead title="Responsible people" subtitle="Selectable for process work in their own unit" icon={<UserCog className="h-4 w-4" />} />
      <form
        className="grid gap-x-4 border-b border-rule bg-surface-2 p-5 sm:grid-cols-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void add()
        }}
      >
        <Field label="Unit" required error={errors.unitId}>
          <Select value={draft.unitId} onChange={(e) => setDraft({ ...draft, unitId: e.target.value })}>
            {db.units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Name" required error={errors.name}>
          <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. R. Kumar…" autoComplete="off" />
        </Field>
        <Field label="Designation">
          <Input value={draft.designation} onChange={(e) => setDraft({ ...draft, designation: e.target.value })} placeholder="e.g. Machine operator…" autoComplete="off" />
        </Field>
        <div className="flex items-end pb-5">
          <Button type="submit" icon={<Plus className="h-4 w-4" />} loading={busy} block>
            Add person
          </Button>
        </div>
      </form>

      {people.length === 0 ? (
        <EmptyState icon={<UserCog className="h-6 w-6" />} title="No people yet" message="Add the people who take responsibility for process work in each unit." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr>
                <th className="vx-th">Name</th>
                <th className="vx-th">Unit</th>
                <th className="vx-th">Designation</th>
                <th className="vx-th">Status</th>
                <th className="vx-th text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id} className="vx-row">
                  <td className="vx-td font-medium text-ink">{p.name}</td>
                  <td className="vx-td">{db.units.find((u) => u.id === p.unitId)?.name ?? p.unitId}</td>
                  <td className="vx-td text-muted">{p.designation || '—'}</td>
                  <td className="vx-td">
                    <Badge tone={p.active ? 'green' : 'slate'} dot>
                      {p.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="vx-td text-right">
                    <Button size="sm" variant="secondary" onClick={() => void run(setPersonActive(p.id, !p.active))}>
                      {p.active ? 'Deactivate' : 'Activate'}
                    </Button>
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

/* -------------------------------- Machines -------------------------------- */

function MachinePanel({ machines, defaultUnit }: { machines: UnitMachine[]; defaultUnit: string }) {
  const { db, run, pushToast } = useStore()
  const [draft, setDraft] = useState({ unitId: defaultUnit || db.units[0]?.id || '', code: '', name: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const add = async () => {
    setBusy(true)
    const r = await run(saveMachine({ unitId: draft.unitId, code: draft.code, name: draft.name }))
    setBusy(false)
    if (!r.ok) {
      setErrors(r.fieldErrors ?? { name: r.error })
      return
    }
    setErrors({})
    setDraft({ unitId: draft.unitId, code: '', name: '' })
    pushToast({ title: `${r.value.name} added to ${r.value.unitId}`, level: 'success' })
  }

  return (
    <Card className="vx-anim-up overflow-hidden">
      <CardHead title="Machines" subtitle="Selectable for processes that need a machine" icon={<Wrench className="h-4 w-4" />} />
      <form
        className="grid gap-x-4 border-b border-rule bg-surface-2 p-5 sm:grid-cols-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void add()
        }}
      >
        <Field label="Unit" required error={errors.unitId}>
          <Select value={draft.unitId} onChange={(e) => setDraft({ ...draft, unitId: e.target.value })}>
            {db.units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Machine name" required error={errors.name}>
          <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Machine 1…" autoComplete="off" />
        </Field>
        <Field label="Code" hint="Blank numbers automatically.">
          <Input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder="e.g. MCH-01…" autoComplete="off" spellCheck={false} />
        </Field>
        <div className="flex items-end pb-5">
          <Button type="submit" icon={<Plus className="h-4 w-4" />} loading={busy} block>
            Add machine
          </Button>
        </div>
      </form>

      {machines.length === 0 ? (
        <EmptyState icon={<Wrench className="h-6 w-6" />} title="No machines yet" message="Add machines so units can record which one ran each process. Manual processes need none." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr>
                <th className="vx-th">Machine</th>
                <th className="vx-th">Code</th>
                <th className="vx-th">Unit</th>
                <th className="vx-th">Status</th>
                <th className="vx-th text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {machines.map((m) => (
                <tr key={m.id} className="vx-row">
                  <td className="vx-td font-medium text-ink">{m.name}</td>
                  <td className="vx-td vx-code">{m.code}</td>
                  <td className="vx-td">{db.units.find((u) => u.id === m.unitId)?.name ?? m.unitId}</td>
                  <td className="vx-td">
                    <Badge tone={m.active ? 'green' : 'slate'} dot>
                      {m.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="vx-td text-right">
                    <Button size="sm" variant="secondary" onClick={() => void run(setMachineActive(m.id, !m.active))}>
                      {m.active ? 'Deactivate' : 'Activate'}
                    </Button>
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

/* ---------------------------------- Units --------------------------------- */

function UnitPanel() {
  const { db } = useStore()
  // undefined = closed, null = new unit, a unit = edit it.
  const [editing, setEditing] = useState<ProductionUnit | null | undefined>(undefined)

  return (
    <Card className="vx-anim-up overflow-hidden">
      <CardHead
        title="Production units"
        subtitle="Our own units and outside units (job work). Renaming a unit never rewrites confirmed history."
        icon={<Factory className="h-4 w-4" />}
        actions={
          <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setEditing(null)}>
            Add unit…
          </Button>
        }
      />
      <div className="divide-y divide-rule">
        {db.units.map((unit) => {
          const people = db.people.filter((p) => p.unitId === unit.id && p.active).length
          const machines = db.machines.filter((m) => m.unitId === unit.id && m.active).length
          return (
            <div key={unit.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div className="min-w-0">
                <p className="font-semibold text-ink">
                  {unit.name} <span className="vx-code text-xs text-faint">{unit.id}</span>
                  {unit.outside ? (
                    <Badge tone="violet" dot className="ml-2 align-middle">
                      Outside
                    </Badge>
                  ) : null}
                </p>
                <p className="text-sm text-muted">
                  {[
                    unit.speciality || (unit.outside ? 'Job work' : 'No speciality recorded'),
                    unit.outside ? '' : `${people} person(s) · ${machines} machine(s)`,
                    `capacity ${unit.dailyCapacityJobs} jobs/day`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {unit.contactPerson || unit.phone || unit.address ? (
                  <p className="break-words text-xs text-faint">{[unit.contactPerson, unit.phone, unit.address].filter(Boolean).join(' · ')}</p>
                ) : null}
              </div>
              <Button size="sm" variant="secondary" onClick={() => setEditing(unit)}>
                Edit…
              </Button>
            </div>
          )
        })}
      </div>
      {editing !== undefined ? <UnitDialog unit={editing ?? undefined} onClose={() => setEditing(undefined)} /> : null}
    </Card>
  )
}
