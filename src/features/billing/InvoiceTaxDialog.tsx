import { useRef, useState } from 'react'
import { Percent } from 'lucide-react'
import { useStore } from '../../store/store'
import type { Invoice, SupplyType } from '../../lib/types'
import { moneyPaise } from '../../lib/format'
import { SUPPLY_CHOICES, SUPPLY_LABEL, resolveSupply, retaxInvoice } from '../../lib/gst'
import { editInvoiceTax, validateInvoiceTax } from '../../domain/purchases'
import type { InvoiceTaxEdit } from '../../lib/gst'
import { Button, Field, Input, Modal, Select } from '../../components/ui'
import { NumberInput } from '../../components/page'
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
    cgstPct: invoice.cgstPct ?? invoice.taxPct / 2,
    sgstPct: invoice.sgstPct ?? invoice.taxPct / 2,
  })
  // What "Auto" works out to, from the two GSTIN state codes.
  const autoSupply = resolveSupply('auto', invoice.company.gstin, invoice.customer.gstin, invoice.customer.placeOfSupply)
  const local = edit.supplyType === 'intra' || edit.supplyType === 'none' || (edit.supplyType === 'auto' && autoSupply === 'intra')
  const split = local && edit.supplyType !== 'none'
  const half = (pct: number) => Math.round((pct / 2) * 1000) / 1000
  const setTotalPct = (v: number) => setEdit((e) => ({ ...e, taxPct: v, cgstPct: half(v), sgstPct: half(v) }))
  const setPart = (key: 'cgstPct' | 'sgstPct', v: number | null) =>
    setEdit((e) => {
      const next = { ...e, [key]: v ?? NaN }
      const sum = (next.cgstPct ?? NaN) + (next.sgstPct ?? NaN)
      return Number.isFinite(sum) ? { ...next, taxPct: Math.round(sum * 1000) / 1000 } : next
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
  const splitText = (i: Invoice) =>
    i.igst !== null
      ? `IGST ${moneyPaise(i.igst)}`
      : i.cgst !== null
        ? `CGST ${i.cgstPct ?? i.taxPct / 2}% ${moneyPaise(i.cgst)} + SGST ${i.sgstPct ?? i.taxPct / 2}% ${moneyPaise(i.sgst ?? 0)}`
        : 'Single line'

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
        <Field label="GST %" error={errors.taxPct} as="div" hint={split ? 'CGST % + SGST %' : undefined}>
          <GstPctInput label="GST %" value={edit.taxPct} invalid={!!errors.taxPct} onChange={setTotalPct} />
        </Field>
        <Field label="GST type" className="sm:col-span-2" hint={edit.supplyType === 'auto' ? (autoSupply === 'intra' ? 'Customer in Tamil Nadu → Local' : autoSupply === 'inter' ? 'Customer in another state → IGST' : 'GSTIN missing — choose Local or Other state') : undefined}>
          <Select
            value={edit.supplyType === 'none' ? 'intra' : edit.supplyType}
            onChange={(e) => setEdit((x) => ({ ...x, supplyType: e.target.value as SupplyType }))}
          >
            {SUPPLY_CHOICES.map((k) => (
              <option key={k} value={k}>
                {SUPPLY_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        {local ? (
          <div className="rounded-md border border-rule bg-surface-2 p-3 sm:col-span-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={split}
                onChange={(e) => setEdit((x) => ({ ...x, supplyType: e.target.checked ? 'intra' : 'none' }))}
              />
              Local sale — split into CGST + SGST
            </label>
            {split ? (
              <div className="mt-2 grid gap-x-4 sm:grid-cols-3">
                <Field label="CGST %" error={errors.cgstPct}>
                  <NumberInput className="text-right" invalid={!!errors.cgstPct} value={edit.cgstPct ?? null} onChange={(v) => setPart('cgstPct', v)} />
                </Field>
                <Field label="SGST %" error={errors.sgstPct}>
                  <NumberInput className="text-right" invalid={!!errors.sgstPct} value={edit.sgstPct ?? null} onChange={(v) => setPart('sgstPct', v)} />
                </Field>
                <div className="self-center text-xs text-muted">Usually half each: 9% + 9% for 18%, 2.5% + 2.5% for 5%.</div>
              </div>
            ) : (
              <p className="mt-1 text-xs text-muted">The invoice will show one line: {edit.taxLabel || 'GST'} @ {edit.taxPct}%.</p>
            )}
          </div>
        ) : null}
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
          {line('Split', splitText(invoice), preview ? splitText(preview) : null)}
          {line('Invoice total', moneyPaise(invoice.total), preview ? moneyPaise(preview.total) : null)}
        </tbody>
      </table>
      {invoice.editedAt ? <p className="mt-2 text-xs text-muted">Last GST edit by {invoice.editedBy}.</p> : null}
    </Modal>
  )
}
