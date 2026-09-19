import { useMemo, useState } from 'react'
import { Pencil } from 'lucide-react'
import { useStore } from '../../store/store'
import type { UnitMachine, UnitPerson, VertexDB } from '../../lib/types'
import { fmtDate, fmtDateTime } from '../../lib/format'
import { saveMachine, savePerson } from '../../domain/resources'
import { Badge, Button, Drawer, Field, Input, Textarea } from '../../components/ui'
import { NumberInput } from '../../components/page'

export type ResourceItem = Item
type Item = { kind: 'person'; value: UnitPerson } | { kind: 'machine'; value: UnitMachine }

/** Years between a date (or year) and today, e.g. "3 yrs 4 mths". */
export function since(from: string | number | null | undefined, now = new Date()): string {
  if (from === null || from === undefined || from === '') return '—'
  if (typeof from === 'number') {
    const y = now.getFullYear() - from
    return y <= 0 ? 'Less than a year' : `${y} yr${y === 1 ? '' : 's'}`
  }
  const d = new Date(`${from}T00:00:00`)
  if (Number.isNaN(d.getTime())) return '—'
  const months = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth()
  if (months < 1) return 'Less than a month'
  const y = Math.floor(months / 12)
  const m = months % 12
  return [y ? `${y} yr${y === 1 ? '' : 's'}` : '', m ? `${m} mth${m === 1 ? '' : 's'}` : ''].filter(Boolean).join(' ')
}

/** Processes this person or machine is on now, and the latest ones they finished. */
export function workOf(db: VertexDB, item: Item) {
  const rows = db.orders.flatMap((o) =>
    o.stages.flatMap((s) =>
      s.processes
        .filter((p) => (item.kind === 'person' ? p.responsiblePersonId === item.value.id : p.machineId === item.value.id))
        .map((p) => ({ order: o, process: p })),
    ),
  )
  return {
    open: rows.filter((r) => r.process.status !== 'Completed').sort((a, b) => a.process.plannedStart.localeCompare(b.process.plannedStart)),
    done: rows
      .filter((r) => r.process.status === 'Completed')
      .sort((a, b) => (b.process.actualEnd ?? '').localeCompare(a.process.actualEnd ?? ''))
      .slice(0, 8),
    total: rows.filter((r) => r.process.status === 'Completed').length,
  }
}

export function ResourceDrawer({ item, edit = false, onClose }: { item: Item | null; edit?: boolean; onClose: () => void }) {
  if (!item) return null
  return <Panel key={item.value.id} item={item} startEditing={edit} onClose={onClose} />
}

function Panel({ item, startEditing, onClose }: { item: Item; startEditing: boolean; onClose: () => void }) {
  const { db } = useStore()
  const [editing, setEditing] = useState(startEditing)
  // Always show the saved version, so the panel reflects an edit straight away.
  const latest = (item.kind === 'person' ? db.people.find((p) => p.id === item.value.id) : db.machines.find((m) => m.id === item.value.id)) ?? item.value
  const current = { kind: item.kind, value: latest } as Item
  const work = useMemo(() => workOf(db, current), [db, current.value.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const isPerson = current.kind === 'person'

  return (
    <Drawer
      open
      onClose={onClose}
      title={latest.name}
      subtitle={isPerson ? (current.value as UnitPerson).designation || 'Staff member' : [(current.value as UnitMachine).code, (current.value as UnitMachine).make, (current.value as UnitMachine).model].filter(Boolean).join(' · ') || 'Machine'}
    >
      {editing ? (
        <EditForm item={current} onDone={() => setEditing(false)} />
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-2">
            {latest.active ? <Badge tone="green" dot>In service</Badge> : <Badge tone="slate" dot>Removed</Badge>}
            <Button size="sm" variant="secondary" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(true)}>
              Edit details
            </Button>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {current.kind === 'person' ? (
              <>
                <Row label="Role">{current.value.designation || '—'}</Row>
                <Row label="Phone">{current.value.phone || '—'}</Row>
                <Row label="Work experience">{current.value.experienceYears != null ? `${current.value.experienceYears} yr${current.value.experienceYears === 1 ? '' : 's'}` : '—'}</Row>
                <Row label="With this unit">{current.value.joinedOn ? `${since(current.value.joinedOn)} (since ${fmtDate(current.value.joinedOn)})` : '—'}</Row>
                <Row label="Skills" wide>{current.value.skills || '—'}</Row>
              </>
            ) : (
              <>
                <Row label="Machine code">{current.value.code || '—'}</Row>
                <Row label="Make / model">{[current.value.make, current.value.model].filter(Boolean).join(' ') || '—'}</Row>
                <Row label="Installed">{current.value.installedYear ?? '—'}</Row>
                <Row label="Age">{since(current.value.installedYear)}</Row>
                <Row label="Capacity" wide>{current.value.capacity || '—'}</Row>
              </>
            )}
            <Row label="Notes" wide>
              <span className="whitespace-pre-line">{latest.notes || '—'}</span>
            </Row>
            <Row label="Added">
              {fmtDate(latest.createdAt)} · {latest.createdBy}
            </Row>
            <Row label="Processes completed">{work.total}</Row>
          </dl>

          <section>
            <h3 className="vx-label mb-1">On now ({work.open.length})</h3>
            {work.open.length === 0 ? (
              <p className="text-sm text-muted">Not on any open process.</p>
            ) : (
              <ul className="divide-y divide-rule rounded-md border border-rule">
                {work.open.map((r) => (
                  <li key={r.process.id} className="flex justify-between gap-2 px-3 py-2 text-sm">
                    <span>
                      <span className="vx-code font-semibold">{r.order.code}</span> · {r.process.name}
                    </span>
                    <span className="text-muted">{r.process.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="vx-label mb-1">Recently completed</h3>
            {work.done.length === 0 ? (
              <p className="text-sm text-muted">No completed work yet.</p>
            ) : (
              <ul className="divide-y divide-rule rounded-md border border-rule">
                {work.done.map((r) => (
                  <li key={r.process.id} className="flex justify-between gap-2 px-3 py-2 text-sm">
                    <span>
                      <span className="vx-code font-semibold">{r.order.code}</span> · {r.process.name}
                    </span>
                    <span className="text-muted">{r.process.actualEnd ? fmtDateTime(r.process.actualEnd) : 'Done'}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Drawer>
  )
}

function Row({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : undefined}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  )
}

function EditForm({ item, onDone }: { item: Item; onDone: () => void }) {
  const { run, pushToast } = useStore()
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const v = item.value
  const [name, setName] = useState(v.name)
  const [notes, setNotes] = useState(v.notes ?? '')
  // person
  const p = item.kind === 'person' ? item.value : null
  const [designation, setDesignation] = useState(p?.designation ?? '')
  const [phone, setPhone] = useState(p?.phone ?? '')
  const [experienceYears, setExperience] = useState<number | null>(p?.experienceYears ?? null)
  const [joinedOn, setJoinedOn] = useState(p?.joinedOn ?? '')
  const [skills, setSkills] = useState(p?.skills ?? '')
  // machine
  const m = item.kind === 'machine' ? item.value : null
  const [code, setCode] = useState(m?.code ?? '')
  const [make, setMake] = useState(m?.make ?? '')
  const [model, setModel] = useState(m?.model ?? '')
  const [installedYear, setInstalled] = useState<number | null>(m?.installedYear ?? null)
  const [capacity, setCapacity] = useState(m?.capacity ?? '')

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const r =
        item.kind === 'person'
          ? await run(savePerson({ id: v.id, unitId: v.unitId, name, designation, phone, experienceYears, joinedOn: joinedOn || null, skills, notes }))
          : await run(saveMachine({ id: v.id, unitId: v.unitId, code, name, make, model, installedYear, capacity, notes }))
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {})
        pushToast({ title: 'Not saved', message: r.error, level: 'danger' })
        return
      }
      pushToast({ title: `${r.value.name} saved`, level: 'success' })
      onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form noValidate onSubmit={save} className="space-y-1">
      <Field label="Name" required error={errors.name}>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      {item.kind === 'person' ? (
        <>
          <div className="grid gap-x-3 sm:grid-cols-2">
            <Field label="Role" hint="e.g. Machine operator, Supervisor">
              <Input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="Machine operator…" />
            </Field>
            <Field label="Phone">
              <Input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Field label="Work experience (years)" error={errors.experienceYears}>
              <NumberInput value={experienceYears} invalid={!!errors.experienceYears} onChange={setExperience} />
            </Field>
            <Field label="Joined this unit on" error={errors.joinedOn}>
              <Input type="date" value={joinedOn} onChange={(e) => setJoinedOn(e.target.value)} />
            </Field>
          </div>
          <Field label="Skills" hint="Machines they can run, special work">
            <Input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Offset printing, die cutting…" />
          </Field>
        </>
      ) : (
        <>
          <div className="grid gap-x-3 sm:grid-cols-2">
            <Field label="Machine code">
              <Input value={code} onChange={(e) => setCode(e.target.value)} />
            </Field>
            <Field label="Installed in (year)" error={errors.installedYear}>
              <NumberInput value={installedYear} invalid={!!errors.installedYear} onChange={(n) => setInstalled(n === null ? null : Math.trunc(n))} placeholder="2019…" />
            </Field>
            <Field label="Make">
              <Input value={make} onChange={(e) => setMake(e.target.value)} placeholder="Heidelberg…" />
            </Field>
            <Field label="Model">
              <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="SM 74…" />
            </Field>
          </div>
          <Field label="Capacity" hint="e.g. sheet size, speed">
            <Input value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="20×28 in, 8,000 sheets/hr…" />
          </Field>
        </>
      )}
      <Field label="Notes">
        <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Save details
        </Button>
      </div>
    </form>
  )
}
