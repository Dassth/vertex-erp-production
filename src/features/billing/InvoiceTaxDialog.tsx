import { useRef, useState } from 'react'
import { Percent } from 'lucide-react'
import { useStore } from '../../store/store'
import type { Invoice, SupplyType } from '../../lib/types'
import { moneyPaise } from '../../lib/format'
import { SUPPLY_LABEL, retaxInvoice } from '../../lib/gst'
import { editInvoiceTax, validateInvoiceTax } from '../../domain/purchases'
import type { InvoiceTaxEdit } from '../../lib/gst'
import { Button, Field, Input, Modal, Select } from '../../components/ui'
import { GstPctInput, HSN_LIST_ID } from './PurchaseBills'

/**
 * Correct the GST on an issued sales invoice before it is downloaded: rate,
 * CGST + SGST or IGST, and HSN. The totals update as you change them; saving
 * records the old and new values in the audit trail.
 */
export function InvoiceTaxDialog({ invoice, onClose }: { invoice: Invoice | null; onClose: () => void }) {
  if (!invoice) return null
  return <Editor key={invoice.id} invoice={invoice} onClose={onClose} />
}

function Editor({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { run, pushToast } = useStore()
  const [edit, setEdit] = useState<InvoiceTaxEdit>({
    taxPct: invoice.taxPct,
    supplyType: invoice.supplyType ?? 'auto',
    hsn: invoice.lines.map((l) => l.hsn),
    taxLabel: invoice.taxLabel,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const errors = validateInvoiceTax(invoice, edit)
  const valid = Object.keys(errors).length === 0
  const preview = valid ? retaxInvoice(invoice, edit) : null

  const save = async () => {
    if (!valid || inFlight.current) return
    inFlight.current = true
    setSaving(true)
    setError(null)
    try {
      const r = await run(editInvoiceTax(invoice.id, edit))
      if (!r.ok) {
        setError(r.error)
        return
      }
      pushToast({ title: `${invoice.number} updated`, message: `New total ${moneyPaise(r.value.total)}. Downloads now print the corrected GST.`, level: 'success' })
      onClose()
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  const line = (label: string, before: string, after: string | null) => (
    <tr className="border-t border-rule">
      <td className="vx-td text-muted">{label}</td>
      <td className="vx-td vx-code text-right">{before}</td>
      <td className="vx-td vx-code text-right font-semibold">{after ?? '—'}</td>
    </tr>
  )
  const split = (i: Invoice) => (i.igst !== null ? `IGST ${moneyPaise(i.igst)}` : i.cgst !== null ? `CGST ${moneyPaise(i.cgst)} + SGST ${moneyPaise(i.sgst ?? 0)}` : 'Single line')

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      icon={<Percent className="h-5 w-5" />}
      title={`Edit GST — ${invoice.number}`}
      subtitle={`${invoice.customer.company}. Quantity, rate and taxable value stay as issued.`}
      footer={
        <>
          {error ? (
            <p role="alert" className="mr-auto text-sm text-risk">
              {error}
            </p>
          ) : null}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} disabled={!valid} onClick={save}>
            Save GST
          </Button>
        </>
      }
    >
      <div className="grid gap-x-4 sm:grid-cols-3">
        <Field label="GST %" error={errors.taxPct} as="div">
          <GstPctInput label="GST %" value={edit.taxPct} invalid={!!errors.taxPct} onChange={(v) => setEdit((e) => ({ ...e, taxPct: v }))} />
        </Field>
        <Field label="GST type" className="sm:col-span-2" hint="Customer outside Tamil Nadu → IGST">
          <Select value={edit.supplyType} onChange={(e) => setEdit((x) => ({ ...x, supplyType: e.target.value as SupplyType }))}>
            {(Object.keys(SUPPLY_LABEL) as SupplyType[]).map((k) => (
              <option key={k} value={k}>
                {SUPPLY_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tax label">
          <Input value={edit.taxLabel} onChange={(e) => setEdit((x) => ({ ...x, taxLabel: e.target.value }))} />
        </Field>
        {invoice.lines.map((l, i) => (
          <Field key={i} label={`HSN — ${l.description}`} className="sm:col-span-2">
            <Input
              value={edit.hsn[i] ?? ''}
              spellCheck={false}
              list={HSN_LIST_ID}
              onChange={(e) => setEdit((x) => ({ ...x, hsn: x.hsn.map((h, j) => (j === i ? e.target.value : h)) }))}
            />
          </Field>
        ))}
      </div>

      <table className="mt-2 w-full rounded-md border border-rule">
        <thead>
          <tr>
            <th className="vx-th" />
            <th className="vx-th text-right">As issued</th>
            <th className="vx-th text-right">After edit</th>
          </tr>
        </thead>
        <tbody>
          {line('Taxable value', moneyPaise(invoice.taxableValue), moneyPaise(invoice.taxableValue))}
          {line('GST', `${invoice.taxPct}% = ${moneyPaise(invoice.taxAmount)}`, preview ? `${preview.taxPct}% = ${moneyPaise(preview.taxAmount)}` : null)}
          {line('Split', split(invoice), preview ? split(preview) : null)}
          {line('Invoice total', moneyPaise(invoice.total), preview ? moneyPaise(preview.total) : null)}
        </tbody>
      </table>
      {invoice.editedAt ? <p className="mt-2 text-xs text-muted">Last GST edit by {invoice.editedBy}.</p> : null}
    </Modal>
  )
}
