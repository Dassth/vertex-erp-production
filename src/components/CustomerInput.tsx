import { useState } from 'react'
import { Building2 } from 'lucide-react'
import { useStore } from '../store/store'
import type { Customer } from '../lib/types'
import type { CustomerDraft } from '../domain/master'
import { blankCustomerDraft, saveCustomer, validateCustomerDraft } from '../domain/master'
import { cx } from '../lib/format'
import { Button, Field, Input, Modal, Textarea } from './ui'
import { focusFirstInvalid } from './page'
import { Picker } from './Picker'
import { StateSelect } from './StateSelect'
import { gstinState } from '../lib/billing'

/**
 * A customer, chosen the same way as a supplier or a material: click to see
 * all customers, type to search, or press "New customer" to add one here.
 *
 * `selectedId` set (Planning): only a customer from the list can be chosen.
 * `onText` set (money received): a typed name is kept as it is.
 */
export function CustomerInput({
  value,
  selectedId,
  onPick,
  onText,
  name,
  placeholder = 'Choose a customer…',
  invalid,
  disabled,
  'aria-label': ariaLabel,
}: {
  value?: string
  selectedId?: string
  onPick: (c: Customer) => void
  onText?: (text: string) => void
  name?: string
  placeholder?: string
  invalid?: boolean
  disabled?: boolean
  'aria-label'?: string
}) {
  const { db, can } = useStore()
  const [creating, setCreating] = useState<string | null>(null)
  const options = db.customers
    .filter((c) => c.active || c.id === selectedId)
    .sort((a, b) => a.company.localeCompare(b.company))
    .map((c) => ({ id: c.id, label: c.company, detail: [c.code, c.active ? '' : 'inactive'].filter(Boolean).join(' · '), keywords: `${c.contactPerson} ${c.phone} ${c.gstin}`, item: c }))
  const shown = value ?? options.find((o) => o.id === selectedId)?.label ?? ''
  return (
    <>
      <Picker
        noun="customer"
        name={name}
        value={shown}
        options={options}
        onText={onText}
        onPick={(o) => onPick(o.item)}
        onNew={can('master') ? (typed) => setCreating(typed) : undefined}
        placeholder={placeholder}
        invalid={invalid}
        disabled={disabled}
        aria-label={ariaLabel}
      />
      {creating !== null ? (
        <NewCustomerDialog
          company={creating}
          onClose={() => setCreating(null)}
          onSaved={(c) => {
            onText?.(c.company)
            onPick(c)
          }}
        />
      ) : null}
    </>
  )
}

/** The few details a customer needs to be used straight away; the rest is in Master → Customers. */
function NewCustomerDialog({ company, onClose, onSaved }: { company: string; onClose: () => void; onSaved: (c: Customer) => void }) {
  const { db, run, pushToast } = useStore()
  const [d, setD] = useState<CustomerDraft>(() => ({ ...blankCustomerDraft(), company }))
  const [touched, setTouched] = useState(false)
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const errors = touched ? { ...validateCustomerDraft(db.customers, d), ...serverErrors } : {}
  const set = (patch: Partial<CustomerDraft>) => setD((x) => ({ ...x, ...patch }))

  const save = async () => {
    setTouched(true)
    if (busy) return
    if (Object.keys(validateCustomerDraft(db.customers, d)).length) return focusFirstInvalid()
    setBusy(true)
    try {
      const r = await run(saveCustomer({ ...d, deliveryAddress: d.billingAddress }))
      if (!r.ok) {
        setServerErrors(r.fieldErrors ?? {})
        if (!r.fieldErrors) pushToast({ title: 'Customer not saved', message: r.error, level: 'danger' })
        return focusFirstInvalid()
      }
      pushToast({ title: `${r.value.company} added`, message: 'More details can be added in Master → Customers.', level: 'success' })
      onSaved(r.value)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New customer"
      subtitle="The name and billing address are enough — the rest can be added later in Master → Customers."
      icon={<Building2 className="h-5 w-5" />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void save()}>
            Save customer
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
        <Field label="Company name" required error={errors.company} className="sm:col-span-2">
          <Input name="organization" autoComplete="organization" value={d.company} onChange={(e) => set({ company: e.target.value })} aria-invalid={!!errors.company || undefined} />
        </Field>
        <Field label="Contact person">
          <Input name="name" autoComplete="name" value={d.contactPerson} onChange={(e) => set({ contactPerson: e.target.value })} />
        </Field>
        <Field label="Phone" error={errors.phone}>
          <Input type="tel" name="tel" inputMode="tel" autoComplete="tel" value={d.phone} onChange={(e) => set({ phone: e.target.value })} aria-invalid={!!errors.phone || undefined} placeholder="+91 …" />
        </Field>
        <Field label="Billing address" required error={errors.billingAddress} className="sm:col-span-2">
          <Textarea rows={2} name="billing-address" autoComplete="billing street-address" value={d.billingAddress} onChange={(e) => set({ billingAddress: e.target.value })} aria-invalid={!!errors.billingAddress || undefined} />
        </Field>
        <Field label="GST registration" as="div">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="GST registration">
            {[
              { v: false, label: 'Registered' },
              { v: true, label: 'Unregistered (URD)' },
            ].map((o) => (
              <label key={o.label} className={cx('flex min-h-9 cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm', !!d.unregistered === o.v ? 'border-accent bg-accent-wash' : 'border-rule-2 hover:bg-surface-2')}>
                <input type="radio" name="new-customer-gst" className="accent-[var(--color-accent)]" checked={!!d.unregistered === o.v} onChange={() => set({ unregistered: o.v })} />
                {o.label}
              </label>
            ))}
          </div>
        </Field>
        {d.unregistered ? (
          <p className="mb-4 self-center text-sm text-muted">No GSTIN needed.</p>
        ) : (
          <Field label="GSTIN" error={errors.gstin} hint="Can be added later.">
            <Input
              spellCheck={false}
              value={d.gstin}
              onChange={(e) => {
                const gstin = e.target.value.toUpperCase()
                const fromGstin = gstinState(gstin)
                set({ gstin, ...(fromGstin ? { placeOfSupply: fromGstin } : {}) })
              }}
              aria-invalid={!!errors.gstin || undefined}
              placeholder="15-character GSTIN…"
            />
          </Field>
        )}
        <Field label="Place of supply" as="div" className="sm:col-span-2" hint="Decides CGST + SGST (your state) or IGST (another state) on invoices.">
          <StateSelect aria-label="Place of supply" value={d.placeOfSupply} onChange={(v) => set({ placeOfSupply: v })} />
        </Field>
      </form>
    </Modal>
  )
}
