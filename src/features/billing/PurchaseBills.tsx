import { useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { Download, Eye, IndianRupee, Pencil, Plus, ReceiptText, Search, ShoppingCart, Trash2 } from 'lucide-react'
import { useStore } from '../../store/store'
import type { PurchaseBill, PurchaseLine, SupplyType } from '../../lib/types'
import { fmtDate, moneyPaise, uid } from '../../lib/format'
import { GST_RATES, HSN_SUGGESTIONS, SUPPLY_CHOICES, SUPPLY_LABEL, purchaseTotals } from '../../lib/gst'
import { deletePurchaseBill, savePurchaseBill, validatePurchase } from '../../domain/purchases'
import type { PurchaseDraft } from '../../domain/purchases'
import { Button, Card, CardHead, ConfirmDialog, EmptyState, Field, IconButton, Input, Modal, SearchInput, Select, Textarea } from '../../components/ui'
import { NumberInput, StatStrip, StatTile } from '../../components/page'
import { DownloadButton, purchaseDoc, useLatestDb } from '../../components/DocumentPreview'
import type { PreviewDoc } from '../../components/DocumentPreview'

export const HSN_LIST_ID = 'vx-hsn-suggestions'
const MATERIAL_LIST_ID = 'vx-material-suggestions'

/** HSN suggestions shared by the purchase editor and the invoice GST editor. */
export function HsnDatalist() {
  return (
    <datalist id={HSN_LIST_ID}>
      {HSN_SUGGESTIONS.map((h) => (
        <option key={h.hsn} value={h.hsn}>{`${h.label} — ${h.gstPct}%`}</option>
      ))}
    </datalist>
  )
}

const blankLine = (): PurchaseLine => ({ id: uid('pl'), description: '', hsn: '', quantity: NaN, uom: 'Nos', rate: NaN, gstPct: 18 })

const toDraft = (b: PurchaseBill | null): PurchaseDraft =>
  b
    ? {
        id: b.id,
        supplierName: b.supplierName,
        supplierGstin: b.supplierGstin,
        supplierAddress: b.supplierAddress,
        supplierInvoiceNo: b.supplierInvoiceNo,
        date: b.date,
        lines: b.lines.map((l) => ({ ...l })),
        supplyType: b.supplyType,
        roundOff: b.roundOff,
        notes: b.notes,
        expectedUpdatedAt: b.updatedAt,
      }
    : {
        id: '',
        supplierName: '',
        supplierGstin: '',
        supplierAddress: '',
        supplierInvoiceNo: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        lines: [blankLine()],
        supplyType: 'auto',
        roundOff: true,
        notes: '',
      }

export function PurchaseBills({ q, onSearch, onPreview }: { q: string; onSearch: (v: string) => void; onPreview: (d: PreviewDoc) => void }) {
  const { db } = useStore()
  const read = useLatestDb()
  const [editing, setEditing] = useState<PurchaseBill | 'new' | null>(null)
  const [deleting, setDeleting] = useState<PurchaseBill | null>(null)
  const rows = useMemo(
    () =>
      (db.purchases ?? [])
        .map((b) => ({ bill: b, t: purchaseTotals(b, db.company.gstin) }))
        .sort((a, b) => b.bill.date.localeCompare(a.bill.date) || b.bill.code.localeCompare(a.bill.code)),
    [db.purchases, db.company.gstin],
  )
  const term = q.trim().toLowerCase()
  const filtered = rows.filter(
    ({ bill: b }) =>
      !term ||
      `${b.code} ${b.supplierName} ${b.supplierInvoiceNo} ${b.supplierGstin} ${b.lines.map((l) => `${l.description} ${l.hsn}`).join(' ')}`.toLowerCase().includes(term),
  )
  const sum = (pick: (t: (typeof rows)[number]['t']) => number) => rows.reduce((s, r) => s + pick(r.t), 0)

  return (
    <>
      <StatStrip className="grid-cols-2 lg:grid-cols-4">
        <StatTile label="Purchase bills" value={String(rows.length)} icon={<ShoppingCart className="h-4 w-4" />} tone="indigo" hint="Supplier bills recorded" />
        <StatTile label="Taxable value" value={moneyPaise(sum((t) => t.taxable))} icon={<ReceiptText className="h-4 w-4" />} tone="slate" hint="Before GST" />
        <StatTile label="GST paid" value={moneyPaise(sum((t) => t.tax))} icon={<IndianRupee className="h-4 w-4" />} tone="amber" hint="CGST + SGST + IGST" />
        <StatTile label="Net purchases" value={moneyPaise(sum((t) => t.net))} icon={<IndianRupee className="h-4 w-4" />} tone="green" hint="Payable to suppliers" />
      </StatStrip>

      <Card className="vx-anim-up overflow-hidden">
        <CardHead
          title="Purchase bills"
          subtitle={`${filtered.length} of ${rows.length} bills · edit, preview or download any time`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput value={q} onChange={onSearch} placeholder="Supplier, bill no., item, HSN…" className="w-full sm:w-64" />
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
                New purchase bill
              </Button>
            </div>
          }
        />
        {rows.length === 0 ? (
          <EmptyState
            icon={<ShoppingCart className="h-6 w-6" />}
            title="No purchase bills yet"
            message="Record what you bought — paper, board, lamination, transport — with the GST on each item."
            action={
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
                New purchase bill
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Search className="h-6 w-6" />} title="No bills match" message="Clear the search to see every purchase bill." action={<Button variant="secondary" onClick={() => onSearch('')}>Clear search</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr>
                  <th className="vx-th">Entry</th>
                  <th className="vx-th">Date</th>
                  <th className="vx-th">Supplier</th>
                  <th className="vx-th">Supplier bill no.</th>
                  <th className="vx-th">Items</th>
                  <th className="vx-th text-right">Taxable</th>
                  <th className="vx-th text-right">GST</th>
                  <th className="vx-th text-right">Net</th>
                  <th className="vx-th text-right">Documents</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ bill: b, t }) => (
                  <tr key={b.id} className="border-t border-rule">
                    <td className="vx-td vx-code font-semibold">{b.code}</td>
                    <td className="vx-td">{fmtDate(b.date)}</td>
                    <td className="vx-td">
                      {b.supplierName}
                      {b.supplierGstin ? <span className="vx-code block text-2xs text-faint">{b.supplierGstin}</span> : null}
                    </td>
                    <td className="vx-td vx-code">{b.supplierInvoiceNo || '—'}</td>
                    <td className="vx-td text-sm text-muted">{b.lines.map((l) => l.description).join(', ')}</td>
                    <td className="vx-td vx-code text-right">{moneyPaise(t.taxable)}</td>
                    <td className="vx-td text-right">
                      <span className="vx-code">{moneyPaise(t.tax)}</span>
                      <span className="block text-2xs text-faint">{t.supply === 'intra' ? 'CGST + SGST' : t.supply === 'inter' ? 'IGST' : 'Split not set'}</span>
                    </td>
                    <td className="vx-td vx-code text-right font-semibold">{moneyPaise(t.net)}</td>
                    <td className="vx-td">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button size="sm" variant="secondary" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(b)} aria-label={`Edit purchase bill ${b.code}`}>
                          Edit
                        </Button>
                        <Button size="sm" variant="secondary" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => onPreview(purchaseDoc(b, read))} aria-label={`Preview purchase bill ${b.code}`}>
                          Preview
                        </Button>
                        <DownloadButton size="sm" icon={<Download className="h-3.5 w-3.5" />} doc={() => purchaseDoc(b, read)} aria-label={`Download purchase bill ${b.code}`}>
                          Download
                        </DownloadButton>
                        <IconButton label={`Delete purchase bill ${b.code}`} onClick={() => setDeleting(b)}>
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing ? <PurchaseEditor bill={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onPreview={onPreview} /> : null}
      <DeletePurchase bill={deleting} onClose={() => setDeleting(null)} />
    </>
  )
}

function DeletePurchase({ bill, onClose }: { bill: PurchaseBill | null; onClose: () => void }) {
  const { run, pushToast } = useStore()
  return (
    <ConfirmDialog
      open={!!bill}
      tone="danger"
      title="Delete purchase bill?"
      confirmLabel="Delete bill"
      onCancel={onClose}
      onConfirm={async () => {
        if (!bill) return
        const r = await run(deletePurchaseBill(bill.id))
        pushToast(r.ok ? { title: `${bill.code} deleted`, message: 'The deletion is recorded in the audit trail.', level: 'success' } : { title: 'Not deleted', message: r.error, level: 'danger' })
        onClose()
      }}
      body={bill ? `${bill.code} from ${bill.supplierName}${bill.supplierInvoiceNo ? ` (bill ${bill.supplierInvoiceNo})` : ''} will be removed. This cannot be undone.` : ''}
    />
  )
}

/* --------------------------------- Editor --------------------------------- */

export function PurchaseEditor({ bill, onClose, onPreview }: { bill: PurchaseBill | null; onClose: () => void; onPreview: (d: PreviewDoc) => void }) {
  const { db, run, pushToast } = useStore()
  const read = useLatestDb()
  const [d, setD] = useState<PurchaseDraft>(() => toDraft(bill))
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const inFlight = useRef(false)

  const errors = touched ? validatePurchase(d) : {}
  const t = purchaseTotals(d, db.company.gstin)
  const set = (patch: Partial<PurchaseDraft>) => setD((x) => ({ ...x, ...patch }))
  const setLine = (i: number, patch: Partial<PurchaseLine>) => setD((x) => ({ ...x, lines: x.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }))

  const save = async (then?: 'preview') => {
    setTouched(true)
    if (Object.keys(validatePurchase(d)).length || inFlight.current) return
    inFlight.current = true
    setSaving(true)
    setServerError(null)
    try {
      const r = await run(savePurchaseBill(d))
      if (!r.ok) {
        setServerError(r.error)
        return
      }
      pushToast({ title: `${r.value.code} saved`, message: `Net amount ${moneyPaise(purchaseTotals(r.value, db.company.gstin).net)}.`, level: 'success' })
      onClose()
      if (then === 'preview') onPreview(purchaseDoc(r.value, read))
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      pinnedFooter
      icon={<ShoppingCart className="h-5 w-5" />}
      title={bill ? `Edit ${bill.code}` : 'New purchase bill'}
      subtitle="Enter the supplier's bill as printed. GST is worked out per item and updates the totals below as you type."
      footer={
        <>
          {serverError ? (
            <p role="alert" className="mr-auto text-sm text-risk">
              {serverError}
            </p>
          ) : null}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="secondary" icon={<Eye className="h-4 w-4" />} loading={saving} onClick={() => save('preview')}>
            Save and preview
          </Button>
          <Button loading={saving} onClick={() => save()}>
            Save bill
          </Button>
        </>
      }
    >
      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Supplier name" required error={errors.supplierName} className="lg:col-span-2">
          <Input name="supplierName" value={d.supplierName} onChange={(e) => set({ supplierName: e.target.value })} placeholder="e.g. Paper Corporation…" />
        </Field>
        <Field label="Supplier GSTIN" error={errors.supplierGstin} hint="First 2 digits = state (33 = Tamil Nadu)">
          <Input name="supplierGstin" value={d.supplierGstin} spellCheck={false} autoComplete="off" onChange={(e) => set({ supplierGstin: e.target.value.toUpperCase() })} placeholder="33ACCPS0708D1Z5…" />
        </Field>
        <Field label="Supplier bill no.">
          <Input name="supplierInvoiceNo" value={d.supplierInvoiceNo} onChange={(e) => set({ supplierInvoiceNo: e.target.value })} placeholder="e.g. G/4147/26-27…" />
        </Field>
        <Field label="Supplier address" className="lg:col-span-2">
          <Input name="supplierAddress" value={d.supplierAddress} onChange={(e) => set({ supplierAddress: e.target.value })} placeholder="Street, town…" />
        </Field>
        <Field label="Bill date" required error={errors.date}>
          <Input type="date" name="date" value={d.date} onChange={(e) => set({ date: e.target.value })} />
        </Field>
        <Field label="GST type" error={errors.supplyType} hint={d.supplyType === 'auto' ? (t.supply === 'intra' ? 'Same state → CGST + SGST' : t.supply === 'inter' ? 'Other state → IGST' : 'Add GSTIN or choose a type') : undefined}>
          <Select value={d.supplyType} onChange={(e) => set({ supplyType: e.target.value as SupplyType })}>
            {[...SUPPLY_CHOICES, ...(d.supplyType === 'none' ? (['none'] as SupplyType[]) : [])].map((k) => (
              <option key={k} value={k}>
                {SUPPLY_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <datalist id={MATERIAL_LIST_ID}>
        {db.materials
          .filter((m) => m.active)
          .map((m) => (
            <option key={m.id} value={m.name} />
          ))}
      </datalist>
      <div className="mt-3 overflow-x-auto rounded-md border border-rule">
        <table className="w-full min-w-[960px]">
          <thead>
            <tr>
              <th className="vx-th w-8">#</th>
              <th className="vx-th">Item / description</th>
              <th className="vx-th w-32">HSN/SAC</th>
              <th className="vx-th w-24 text-right">Qty</th>
              <th className="vx-th w-20">Unit</th>
              <th className="vx-th w-28 text-right">Rate ₹</th>
              <th className="vx-th w-24 text-right">GST %</th>
              <th className="vx-th w-32 text-right">Amount</th>
              <th className="vx-th w-10" />
            </tr>
          </thead>
          <tbody>
            {d.lines.map((l, i) => (
              <tr key={l.id} className="border-t border-rule align-top">
                <td className="vx-td text-muted">{i + 1}</td>
                <td className="vx-td">
                  <Input list={MATERIAL_LIST_ID} aria-label={`Item ${i + 1} description`} aria-invalid={!!errors[`line.${i}.description`] || undefined} value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} placeholder="e.g. 300GSM Gold Coin board…" />
                  {errors[`line.${i}.description`] ? <span className="vx-help text-risk">{errors[`line.${i}.description`]}</span> : null}
                </td>
                <td className="vx-td">
                  <Input
                    aria-label={`Item ${i + 1} HSN`}
                    list={HSN_LIST_ID}
                    value={l.hsn}
                    spellCheck={false}
                    onChange={(e) => {
                      const hsn = e.target.value.trim()
                      const known = HSN_SUGGESTIONS.find((h) => h.hsn === hsn)
                      setLine(i, known ? { hsn, gstPct: known.gstPct } : { hsn: e.target.value })
                    }}
                  />
                </td>
                <td className="vx-td">
                  <NumberInput aria-label={`Item ${i + 1} quantity`} invalid={!!errors[`line.${i}.quantity`]} className="text-right" value={l.quantity} onChange={(v) => setLine(i, { quantity: v ?? NaN })} />
                </td>
                <td className="vx-td">
                  <Input aria-label={`Item ${i + 1} unit`} value={l.uom} onChange={(e) => setLine(i, { uom: e.target.value })} />
                </td>
                <td className="vx-td">
                  <NumberInput aria-label={`Item ${i + 1} rate`} invalid={!!errors[`line.${i}.rate`]} className="text-right" value={l.rate} onChange={(v) => setLine(i, { rate: v ?? NaN })} />
                </td>
                <td className="vx-td">
                  <GstPctInput label={`Item ${i + 1} GST %`} value={l.gstPct} invalid={!!errors[`line.${i}.gstPct`]} onChange={(v) => setLine(i, { gstPct: v })} />
                </td>
                <td className="vx-td vx-code text-right">
                  {moneyPaise(t.lines[i]?.amount ?? 0)}
                  <span className="block text-2xs text-faint">+ GST {moneyPaise(t.lines[i]?.tax ?? 0)}</span>
                </td>
                <td className="vx-td">
                  <IconButton label={`Remove item ${i + 1}`} disabled={d.lines.length === 1} onClick={() => set({ lines: d.lines.filter((_, j) => j !== i) })}>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <Button size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => set({ lines: [...d.lines, blankLine()] })}>
          Add item
        </Button>
        {errors.lines ? <span className="text-sm text-risk">{errors.lines}</span> : null}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_320px]">
        <div>
          <Field label="Notes">
            <Textarea rows={3} value={d.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Transport, delivery note, payment terms…" />
          </Field>
          {t.summary.length > 1 ? (
            <div className="text-xs text-muted">
              GST by HSN:{' '}
              {t.summary.map((g) => `${g.hsn || '—'} @ ${g.gstPct}% → ${moneyPaise(g.tax)}`).join(' · ')}
            </div>
          ) : null}
        </div>
        <dl className="space-y-1 rounded-md border border-rule bg-surface-2 p-3 text-sm">
          <Row label="Taxable value" value={moneyPaise(t.taxable)} />
          {t.supply === 'intra' ? (
            <>
              <Row label="CGST" value={moneyPaise(t.cgst)} />
              <Row label="SGST" value={moneyPaise(t.sgst)} />
            </>
          ) : t.supply === 'inter' ? (
            <Row label="IGST" value={moneyPaise(t.igst)} />
          ) : (
            <Row label="GST (split not set)" value={moneyPaise(t.tax)} />
          )}
          <label className="flex cursor-pointer items-center justify-between gap-2 py-0.5">
            <span className="flex items-center gap-2">
              <input type="checkbox" checked={d.roundOff} onChange={(e) => set({ roundOff: e.target.checked })} />
              Round off to rupee
            </span>
            <span className="vx-code">{d.roundOff ? moneyPaise(t.roundOff) : '—'}</span>
          </label>
          <div className="flex justify-between border-t border-rule pt-2 text-base font-semibold text-ink">
            <dt>Net amount</dt>
            <dd className="vx-code">{moneyPaise(t.net)}</dd>
          </div>
        </dl>
      </div>
    </Modal>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="vx-code">{value}</dd>
    </div>
  )
}

/** A GST rate: pick a common slab, or type any other rate. */
export function GstPctInput({ label, value, onChange, invalid }: { label: string; value: number; onChange: (v: number) => void; invalid?: boolean }) {
  const custom = !GST_RATES.includes(value)
  const [typing, setTyping] = useState(custom)
  if (typing || custom) return <NumberInput aria-label={label} invalid={invalid} className="text-right" value={value} onChange={(v) => onChange(v ?? NaN)} />
  return (
    <Select
      aria-label={label}
      aria-invalid={invalid || undefined}
      value={String(value)}
      onChange={(e) => (e.target.value === 'other' ? setTyping(true) : onChange(Number(e.target.value)))}
    >
      {GST_RATES.map((r) => (
        <option key={r} value={r}>
          {r}%
        </option>
      ))}
      <option value="other">Other…</option>
    </Select>
  )
}
