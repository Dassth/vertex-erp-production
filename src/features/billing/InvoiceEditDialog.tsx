import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { FilePenLine, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../../store/store'
import type { Invoice } from '../../lib/types'
import { moneyPaise } from '../../lib/format'
import { resolveSupply } from '../../lib/gst'
import type { InvoiceTaxEdit } from '../../lib/gst'
import { applyInvoiceDraft, editInvoice, invoiceToDraft, validateInvoiceDraft } from '../../domain/purchases'
import type { InvoiceDraft, InvoiceLineDraft } from '../../domain/purchases'
import { Button, Field, IconButton, Input, Modal, Textarea } from '../../components/ui'
import { NumberInput } from '../../components/page'
import { HSN_LIST_ID } from './PurchaseBills'
import { TaxFields } from './InvoiceTaxDialog'

/**
 * Full correction of an issued sales invoice: date, customer details, lines,
 * discount, GST and transport. The invoice number stays. Saving updates the one
 * invoice record, so Billing, Invoices, the PDF and the Sales report all follow.
 */
export function InvoiceEditDialog({ invoice, onClose }: { invoice: Invoice | null; onClose: () => void }) {
  if (!invoice) return null
  return <Editor key={invoice.id} invoice={invoice} onClose={onClose} />
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4 first:mt-0">
      <h3 className="vx-label mb-1">{title}</h3>
      {children}
    </section>
  )
}

function Editor({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { run, pushToast } = useStore()
  const [d, setD] = useState<InvoiceDraft>(() => invoiceToDraft(invoice))
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  const allErrors = validateInvoiceDraft(d)
  const errors = touched ? allErrors : {}
  const valid = Object.keys(allErrors).length === 0
  const preview = valid ? applyInvoiceDraft(invoice, d) : null
  const autoSupply = resolveSupply('auto', invoice.company.gstin, d.customer.gstin, d.customer.placeOfSupply)

  const set = (patch: Partial<InvoiceDraft>) => setD((x) => ({ ...x, ...patch }))
  const setCustomer = (patch: Partial<InvoiceDraft['customer']>) => setD((x) => ({ ...x, customer: { ...x.customer, ...patch } }))
  const setLine = (i: number, patch: Partial<InvoiceLineDraft>) => setD((x) => ({ ...x, lines: x.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }))
  const setTax = (fn: (e: InvoiceTaxEdit) => InvoiceTaxEdit) => setD((x) => ({ ...x, tax: fn(x.tax) }))

  const save = async () => {
    setTouched(true)
    if (!valid || inFlight.current) return
    inFlight.current = true
    setSaving(true)
    setError(null)
    try {
      const r = await run(editInvoice(invoice.id, d))
      if (!r.ok) {
        setError(r.error)
        return
      }
      pushToast({ title: `${invoice.number} saved`, message: `New total ${moneyPaise(r.value.total)}. The invoice PDF and Sales report now show these details.`, level: 'success' })
      onClose()
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  const lineAmount = (l: InvoiceLineDraft) => (Number.isFinite(l.quantity) && Number.isFinite(l.rate) ? l.quantity * l.rate : 0)

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      pinnedFooter
      icon={<FilePenLine className="h-5 w-5" />}
      title={`Edit invoice — ${invoice.number}`}
      subtitle="Correct any detail. Totals and GST recalculate as you type. The invoice number stays the same."
      footer={
        <>
          {error ? (
            <p role="alert" className="mr-auto text-sm text-risk">
              {error}
            </p>
          ) : touched && !valid ? (
            <p role="alert" className="mr-auto text-sm text-risk">
              {Object.values(allErrors)[0]}
            </p>
          ) : null}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={save}>
            Save invoice
          </Button>
        </>
      }
    >
      <Section title="Invoice">
        <div className="grid gap-x-4 sm:grid-cols-3">
          <Field label="Invoice No.">
            <Input value={invoice.number} readOnly disabled />
          </Field>
          <Field label="Invoice date" required error={errors.issueDate}>
            <Input type="date" value={d.issueDate} onChange={(e) => set({ issueDate: e.target.value })} />
          </Field>
          <Field label="Customer ref. / PO">
            <Input value={d.customerRef} onChange={(e) => set({ customerRef: e.target.value })} />
          </Field>
        </div>
      </Section>

      <Section title="Customer">
        <div className="grid gap-x-4 sm:grid-cols-3">
          <Field label="Customer name" required error={errors.company}>
            <Input value={d.customer.company} onChange={(e) => setCustomer({ company: e.target.value })} />
          </Field>
          <Field label="GSTIN" error={errors.gstin} hint="First 2 digits decide CGST+SGST or IGST">
            <Input value={d.customer.gstin} spellCheck={false} onChange={(e) => setCustomer({ gstin: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Place of supply">
            <Input value={d.customer.placeOfSupply} onChange={(e) => setCustomer({ placeOfSupply: e.target.value })} />
          </Field>
          <Field label="Contact person">
            <Input value={d.customer.contactPerson} onChange={(e) => setCustomer({ contactPerson: e.target.value })} />
          </Field>
          <Field label="Phone">
            <Input type="tel" value={d.customer.phone} onChange={(e) => setCustomer({ phone: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input type="email" value={d.customer.email} onChange={(e) => setCustomer({ email: e.target.value })} />
          </Field>
          <Field label="Billing address" className="sm:col-span-3 lg:col-span-1">
            <Textarea rows={2} value={d.customer.billingAddress} onChange={(e) => setCustomer({ billingAddress: e.target.value })} />
          </Field>
          <Field label="Delivery address" className="sm:col-span-3 lg:col-span-2">
            <Textarea rows={2} value={d.deliveryAddress} onChange={(e) => set({ deliveryAddress: e.target.value })} />
          </Field>
        </div>
      </Section>

      <Section title="Items">
        <div className="overflow-x-auto rounded-md border border-rule">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr>
                <th className="vx-th w-8">#</th>
                <th className="vx-th">Description</th>
                <th className="vx-th w-32">HSN/SAC</th>
                <th className="vx-th w-24 text-right">Qty</th>
                <th className="vx-th w-20">Unit</th>
                <th className="vx-th w-28 text-right">Rate ₹</th>
                <th className="vx-th w-32 text-right">Amount</th>
                <th className="vx-th w-10" />
              </tr>
            </thead>
            <tbody>
              {d.lines.map((l, i) => (
                <tr key={i} className="border-t border-rule align-top">
                  <td className="vx-td text-muted">{i + 1}</td>
                  <td className="vx-td">
                    <Input aria-label={`Line ${i + 1} description`} aria-invalid={!!errors[`line.${i}.description`] || undefined} value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} />
                  </td>
                  <td className="vx-td">
                    <Input aria-label={`Line ${i + 1} HSN`} list={HSN_LIST_ID} spellCheck={false} value={l.hsn} onChange={(e) => setLine(i, { hsn: e.target.value })} />
                  </td>
                  <td className="vx-td">
                    <NumberInput aria-label={`Line ${i + 1} quantity`} invalid={!!errors[`line.${i}.quantity`]} className="text-right" value={l.quantity} onChange={(v) => setLine(i, { quantity: v ?? NaN })} />
                  </td>
                  <td className="vx-td">
                    <Input aria-label={`Line ${i + 1} unit`} value={l.uom} onChange={(e) => setLine(i, { uom: e.target.value })} />
                  </td>
                  <td className="vx-td">
                    <NumberInput aria-label={`Line ${i + 1} rate`} invalid={!!errors[`line.${i}.rate`]} className="text-right" value={l.rate} onChange={(v) => setLine(i, { rate: v ?? NaN })} />
                  </td>
                  <td className="vx-td vx-code text-right">{moneyPaise(lineAmount(l))}</td>
                  <td className="vx-td">
                    <IconButton label={`Remove line ${i + 1}`} disabled={d.lines.length === 1} onClick={() => set({ lines: d.lines.filter((_, j) => j !== i) })}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button
          className="mt-2"
          size="sm"
          variant="secondary"
          icon={<Plus className="h-3.5 w-3.5" />}
          onClick={() => set({ lines: [...d.lines, { description: '', hsn: d.lines[0]?.hsn ?? '', quantity: NaN, uom: d.lines[0]?.uom ?? 'pcs', rate: NaN }] })}
        >
          Add line
        </Button>
        <p className="mt-1 text-xs text-muted">Changing quantity here corrects the invoice only; dispatch quantities and order balances stay as recorded.</p>
      </Section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div>
          <Section title="GST">
            <div className="grid gap-x-4 sm:grid-cols-3">
              <TaxFields edit={d.tax} setEdit={setTax} errors={errors} autoSupply={autoSupply} />
              <Field label="Tax label">
                <Input value={d.tax.taxLabel} onChange={(e) => setTax((t) => ({ ...t, taxLabel: e.target.value }))} />
              </Field>
              <Field label="Discount ₹" error={errors.discount}>
                <NumberInput className="text-right" invalid={!!errors.discount} value={d.discount} onChange={(v) => set({ discount: v ?? 0 })} />
              </Field>
            </div>
          </Section>
          <Section title="Transport and terms">
            <div className="grid gap-x-4 sm:grid-cols-2">
              <Field label="Transporter">
                <Input value={d.transporter} onChange={(e) => set({ transporter: e.target.value })} />
              </Field>
              <Field label="Vehicle No.">
                <Input value={d.vehicleNo} onChange={(e) => set({ vehicleNo: e.target.value })} />
              </Field>
              <Field label="Payment terms">
                <Input value={d.paymentTerms} onChange={(e) => set({ paymentTerms: e.target.value })} />
              </Field>
              <Field label="Notes">
                <Input value={d.notes} onChange={(e) => set({ notes: e.target.value })} />
              </Field>
            </div>
          </Section>
        </div>

        <dl className="h-fit space-y-1 rounded-md border border-rule bg-surface-2 p-3 text-sm lg:sticky lg:top-0">
          <Row label="Subtotal" before={invoice.subtotal} after={preview?.subtotal} />
          <Row label="Discount" before={invoice.discount} after={preview?.discount} />
          <Row label="Taxable value" before={invoice.taxableValue} after={preview?.taxableValue} />
          {preview?.igst != null ? <Row label={`IGST @ ${preview.taxPct}%`} before={invoice.igst ?? invoice.taxAmount} after={preview.igst} /> : null}
          {preview?.cgst != null ? <Row label={`CGST @ ${preview.cgstPct}%`} before={invoice.cgst ?? 0} after={preview.cgst} /> : null}
          {preview?.sgst != null ? <Row label={`SGST @ ${preview.sgstPct}%`} before={invoice.sgst ?? 0} after={preview.sgst} /> : null}
          {preview && preview.igst === null && preview.cgst === null ? <Row label={`${preview.taxLabel} @ ${preview.taxPct}%`} before={invoice.taxAmount} after={preview.taxAmount} /> : null}
          <div className="flex items-baseline justify-between gap-2 border-t border-rule pt-2 text-base font-semibold text-ink">
            <dt>Invoice total</dt>
            <dd className="vx-code">{preview ? moneyPaise(preview.total) : '—'}</dd>
          </div>
          <p className="text-2xs text-faint">Was {moneyPaise(invoice.total)}</p>
        </dl>
      </div>
    </Modal>
  )
}

function Row({ label, before, after }: { label: string; before: number; after: number | undefined }) {
  const changed = after !== undefined && after !== before
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="vx-code">
        {changed ? <span className="mr-1.5 text-2xs text-faint line-through">{moneyPaise(before)}</span> : null}
        {after === undefined ? '—' : moneyPaise(after)}
      </dd>
    </div>
  )
}
