import { useId, useRef, useState } from 'react'
import { useStore } from '../../store/store'
import { activeMachines, activePeople, saveMachine, savePerson } from '../../domain/resources'
import { Button, Field, Input } from '../../components/ui'
import type { UnitId } from '../../lib/types'

export function UnitResourceSetup({ unitId, onPersonAdded, onMachineAdded }: {
  unitId: UnitId; onPersonAdded?: (id: string) => void; onMachineAdded?: (id: string) => void
}) {
  const { db } = useStore()
  const people = activePeople(db, unitId)
  const machines = activeMachines(db, unitId)
  return <details className="rounded-lg border border-rule bg-surface p-4">
    <summary className="vx-focus cursor-pointer min-h-11 py-2 font-semibold text-ink">Unit settings · {people.length} staff · {machines.length} machines</summary>
    <p className="my-2 text-sm text-muted">Type a name to add it to this unit. New entries become available for allocation immediately.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <ResourceAdd unitId={unitId} kind="person" onAdded={onPersonAdded} />
      <ResourceAdd unitId={unitId} kind="machine" onAdded={onMachineAdded} />
    </div>
    <p className="mt-3 break-words text-sm text-muted">Staff: {people.map(p => p.name).join(', ') || 'No staff added yet'}</p>
    <p className="mt-1 break-words text-sm text-muted">Machines: {machines.map(m => m.name).join(', ') || 'No machines added yet'}</p>
  </details>
}

function ResourceAdd({ unitId, kind, onAdded }: { unitId: UnitId; kind: 'person' | 'machine'; onAdded?: (id: string) => void }) {
  const { run, pushToast } = useStore()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const pending = useRef(false)
  const id = useId()
  const label = kind === 'person' ? 'New staff name' : 'New machine name'
  return <form noValidate onSubmit={async e => {
    e.preventDefault()
    if (pending.current) return
    if (!name.trim()) { setError('Enter a name.'); inputRef.current?.focus(); return }
    pending.current = true
    setBusy(true)
    setError('')
    try {
      const result = kind === 'person'
        ? await run(savePerson({ unitId, name: name.trim(), designation: '' }))
        : await run(saveMachine({ unitId, name: name.trim(), code: '' }))
      if (!result.ok) { setError(result.fieldErrors?.name ?? result.error); inputRef.current?.focus(); return }
      setName('')
      onAdded?.(result.value.id)
      pushToast({ title: result.value.name + ' added to ' + unitId, level: 'success' })
    } catch { setError('Could not save. Please try again.'); inputRef.current?.focus() }
    finally { pending.current = false; setBusy(false) }
  }}>
    <Field label={label} required>
      <Input ref={inputRef} name={kind + '-name'} autoComplete="off" value={name} onChange={e => setName(e.target.value)} aria-invalid={!!error} aria-describedby={error ? id : undefined} placeholder={kind === 'person' ? 'e.g. Kumar…' : 'e.g. Machine 1…'} />
    </Field>
    <p id={id} role="status" aria-live="polite" className="mb-2 text-sm text-risk">{error}</p>
    <Button type="submit" loading={busy}>{kind === 'person' ? 'Add staff' : 'Add machine'}</Button>
  </form>
}
