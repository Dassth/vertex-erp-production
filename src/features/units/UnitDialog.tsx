import { useState } from 'react'
import { Building2, Truck } from 'lucide-react'
import { useStore } from '../../store/store'
import type { ProductionUnit } from '../../lib/types'
import type { UnitDraft } from '../../domain/resources'
import { addUnit, saveUnit } from '../../domain/resources'
import { cx } from '../../lib/format'
import { Button, Field, Input, Modal, Textarea } from '../../components/ui'
import { NumberInput, focusFirstInvalid } from '../../components/page'

/**
 * Add a unit or change one. A unit is either one of our own, or an outside
 * unit — work given out (job work) to another firm. Both can be chosen for a
 * process in planning.
 */
export function UnitDialog({ unit, outside = false, onClose, onSaved }: { unit?: ProductionUnit; outside?: boolean; onClose: () => void; onSaved?: (u: ProductionUnit) => void }) {
  const { run, pushToast } = useStore()
  const [d, setD] = useState<UnitDraft>(() =>
    unit
      ? { id: unit.id, name: unit.name, shortName: unit.shortName, speciality: unit.speciality, dailyCapacityJobs: unit.dailyCapacityJobs, outside: !!unit.outside, contactPerson: unit.contactPerson ?? '', phone: unit.phone ?? '', address: unit.address ?? '' }
      : { id: '', name: '', shortName: '', speciality: '', dailyCapacityJobs: 5, outside, contactPerson: '', phone: '', address: '' },
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<UnitDraft>) => setD((x) => ({ ...x, ...patch }))

  const save = async () => {
    if (busy) return
    setBusy(true)
    try {
      const r = await run(unit ? saveUnit(d) : addUnit(d))
      if (!r.ok) {
        setErrors(r.fieldErrors ?? { name: r.error })
        return focusFirstInvalid()
      }
      pushToast({
        title: unit ? `${r.value.name} updated` : `${r.value.name} added`,
        message: unit ? 'Existing plans keep pointing at this unit.' : 'It can now be chosen for a process in Planning.',
        level: 'success',
      })
      onSaved?.(r.value)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={unit ? `Edit ${unit.name}` : 'Add unit'}
      subtitle={d.outside ? 'Work given out to another firm (job work). Choose it for a process in Planning like any unit.' : 'One of your own production units.'}
      icon={d.outside ? <Truck className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void save()}>
            {unit ? 'Save unit' : 'Add unit'}
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="grid gap-x-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Field label="Where is the work done?" as="div" className="sm:col-span-2">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Where is the work done?">
            {[
              { v: false, label: 'Our own unit', hint: 'Our people and machines' },
              { v: true, label: 'Outside (job work)', hint: 'Given out to another firm' },
            ].map((o) => (
              <label key={o.label} className={cx('flex min-w-[12rem] flex-1 cursor-pointer items-start gap-2 rounded-md border px-3 py-2.5', !!d.outside === o.v ? 'border-accent bg-accent-wash' : 'border-rule-2 hover:bg-surface-2')}>
                <input type="radio" name="unit-kind" className="mt-1 accent-[var(--color-accent)]" checked={!!d.outside === o.v} onChange={() => set({ outside: o.v })} />
                <span>
                  <span className="block font-medium text-ink">{o.label}</span>
                  <span className="block text-xs text-muted">{o.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </Field>
        <Field label={d.outside ? 'Firm / person name' : 'Unit name'} required error={errors.name}>
          <Input value={d.name} onChange={(e) => set({ name: e.target.value })} aria-invalid={!!errors.name || undefined} autoComplete="off" placeholder={d.outside ? 'e.g. Sri Lamination Works…' : 'e.g. Unit 5…'} />
        </Field>
        <Field label="Short name" hint="Shown in tight places. Blank = the name.">
          <Input value={d.shortName} onChange={(e) => set({ shortName: e.target.value })} autoComplete="off" />
        </Field>
        <Field label={d.outside ? 'What they do' : 'Speciality'} className="sm:col-span-2">
          <Input value={d.speciality} onChange={(e) => set({ speciality: e.target.value })} placeholder={d.outside ? 'e.g. Lamination, foil stamping…' : 'e.g. Cutting and pasting…'} />
        </Field>
        <Field label={d.outside ? 'Contact person' : 'In-charge'}>
          <Input value={d.contactPerson} onChange={(e) => set({ contactPerson: e.target.value })} autoComplete="off" />
        </Field>
        <Field label="Phone" error={errors.phone}>
          <Input type="tel" inputMode="tel" value={d.phone} onChange={(e) => set({ phone: e.target.value })} aria-invalid={!!errors.phone || undefined} autoComplete="off" placeholder="+91 …" />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <Textarea rows={2} value={d.address} onChange={(e) => set({ address: e.target.value })} placeholder="Street, town…" />
        </Field>
        <Field label="Jobs it can take a day" error={errors.dailyCapacityJobs} hint="Used for the load bar on the Units page.">
          <NumberInput value={d.dailyCapacityJobs} onChange={(v) => set({ dailyCapacityJobs: v ?? 0 })} invalid={!!errors.dailyCapacityJobs} />
        </Field>
      </form>
    </Modal>
  )
}
