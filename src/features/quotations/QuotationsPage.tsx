import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { addDays, format } from 'date-fns'
import { ArrowLeft, CalendarRange, CheckCircle2, Download, Eye, FileText, Plus, Save, Send, XCircle } from 'lucide-react'
import { useStore } from '../../store/store'
import type { CostingInputs, Quotation, QuotationStatus } from '../../lib/types'
import type { QuotationDraft } from '../../domain/quotations'
import { quoteCosting, quoteTotals, quotationToPlan, saveQuotation, setQuotationStatus } from '../../domain/quotations'
import { defaultCostingInputs } from '../../domain/orderCosting'
import { cx, fmtDate, moneyPaise, moneyPrecise, pieces } from '../../lib/format'
import { sizeText } from '../../lib/sizeScale'
import { Badge, Button, Card, CardHead, ConfirmDialog, EmptyState, Field, Input, SearchInput, Segmented, Textarea } from '../../components/ui'
import type { Tone } from '../../components/ui'
import { IssueList, LinkButton, NumberInput, PageHeader, focusFirstInvalid, openRow, useDocumentTitle, useUnsavedChanges } from '../../components/page'
import { CustomerInput } from '../../components/CustomerInput'
import { Picker } from '../../components/Picker'
import { SizeInput } from '../../components/SizeInput'
import { DocumentPreview, DownloadButton, quotationDoc, useLatestDb } from '../../components/DocumentPreview'
import type { PreviewDoc } from '../../components/DocumentPreview'
import { saleTaxLines } from '../../lib/gst'
import { MaterialsTable, ProcessesTable } from '../costing/OrderCostingPage'

/* ---------------------------------------------------------------------------
 * Quotations — a price for a customer before anything is planned or made.
 * Choose customer, product, quantity and size; the price is worked out from
 * Master like an order costing, and can be rounded by hand. Download it as a
 * PDF. When the customer agrees, one press makes a plan from it.
 * ------------------------------------------------------------------------- */

const STATUS_TONE: Record<QuotationStatus, Tone> = { Draft: 'slate', Sent: 'blue', Accepted: 'green', Declined: 'red' }

export function QuotationStatusBadge({ status }: { status: QuotationStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} dot>
      {status === 'Accepted' ? 'Agreed — planned' : status}
    </Badge>
  )
}

const FILTERS = ['all', 'Draft', 'Sent', 'Accepted', 'Declined'] as const
type Filter = (typeof FILTERS)[number]

export function QuotationsPage() {
  const navigate = useNavigate()
  useDocumentTitle('Quotations')
  const { db } = useStore()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const status = (FILTERS as readonly string[]).includes(params.get('status') ?? '') ? (params.get('status') as Filter) : 'all'
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v && v !== 'all') next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }
  const all = db.quotations ?? []
  const rows = useMemo(
    () =>
      all
        .map((x) => ({ x, customer: db.customers.find((c) => c.id === x.customerId)?.company ?? '—', product: db.products.find((p) => p.id === x.productId)?.name ?? '—', plan: db.plans.find((p) => p.id === x.planId) }))
        .filter((r) => status === 'all' || r.x.status === status)
        .filter((r) => !q.trim() || `${r.x.code} ${r.customer} ${r.product}`.toLowerCase().includes(q.trim().toLowerCase()))
        .sort((a, b) => b.x.date.localeCompare(a.x.date) || b.x.code.localeCompare(a.x.code)),
    [all, db.customers, db.products, db.plans, q, status],
  )
  const today = format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sales · Before an order"
        title="Quotations"
        subtitle="Give a customer a price before anything is planned. When they agree, make a plan from the quotation — nothing goes to production until then."
        icon={<FileText className="h-4 w-4" />}
        actions={
          <LinkButton to="/quotations/new" icon={<Plus className="h-4 w-4" />}>
            New quotation
          </LinkButton>
        }
      />

      <Card className="vx-anim-up overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-rule px-5 py-3">
          <Segmented<Filter>
            value={status}
            onChange={(v) => set('status', v)}
            options={FILTERS.map((f) => ({ value: f, label: f === 'all' ? 'All' : f === 'Accepted' ? 'Agreed' : f, count: f === 'all' ? all.length : all.filter((x) => x.status === f).length }))}
          />
          <SearchInput value={q} onChange={(v) => set('q', v)} placeholder="Quotation, customer, product…" className="w-full sm:ml-auto sm:w-64" />
        </div>
        {rows.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title={all.length ? 'No quotation matches' : 'No quotations yet'}
            message={all.length ? 'Try another search or filter.' : 'Make the first one: choose a customer, a product and a quantity — the price is worked out for you.'}
            action={all.length ? undefined : <LinkButton to="/quotations/new">New quotation</LinkButton>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr>
                  <th className="vx-th">Quotation</th>
                  <th className="vx-th">Customer</th>
                  <th className="vx-th">Product</th>
                  <th className="vx-th text-right">Qty</th>
                  <th className="vx-th text-right">Total</th>
                  <th className="vx-th">Valid until</th>
                  <th className="vx-th">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ x, customer, product, plan }) => (
                  <tr key={x.id} {...openRow(() => navigate(`/quotations/${x.id}`))} className="vx-row cursor-pointer">
                    <td className="vx-td">
                      <Link to={`/quotations/${x.id}`} className="vx-focus vx-code rounded-xs font-semibold text-accent-text hover:underline">
                        {x.code}
                      </Link>
                      <span className="block text-2xs text-faint">{fmtDate(x.date)}</span>
                    </td>
                    <td className="vx-td vx-td-wrap">{customer}</td>
                    <td className="vx-td vx-td-wrap">
                      {product}
                      {sizeText(x.size) ? <span className="block text-2xs text-faint">{sizeText(x.size)}</span> : null}
                    </td>
                    <td className="vx-td text-right tabular-nums">{x.quantity.toLocaleString('en-IN')}</td>
                    <td className="vx-td text-right font-semibold tabular-nums text-ink">{moneyPaise(x.totals.grandTotal)}</td>
                    <td className={cx('vx-td text-sm', x.status !== 'Accepted' && x.status !== 'Declined' && x.validUntil < today && 'text-warn')}>
                      {fmtDate(x.validUntil)}
                      {x.status !== 'Accepted' && x.status !== 'Declined' && x.validUntil < today ? <span className="block text-2xs">expired</span> : null}
                    </td>
                    <td className="vx-td">
                      <QuotationStatusBadge status={x.status} />
                      {plan ? (
                        <Link to={`/planning/${plan.id}`} className="vx-focus mt-1 block rounded-xs text-2xs font-medium text-accent-text hover:underline">
                          {plan.code}
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

/* --------------------------------- Editor --------------------------------- */

export function QuotationEditorPage() {
  const { quotationId } = useParams()
  const { db } = useStore()
  const existing = quotationId && quotationId !== 'new' ? (db.quotations ?? []).find((x) => x.id === quotationId) : undefined
  if (quotationId !== 'new' && !existing)
    return (
      <Card>
        <EmptyState icon={<FileText className="h-6 w-6" />} title="Quotation not found" message="It may have been made by another computer that has not synced yet." action={<LinkButton to="/quotations">All quotations</LinkButton>} />
      </Card>
    )
  return <QuotationEditor key={existing?.id ?? 'new'} quotation={existing} />
}

const toDraft = (x: Quotation): QuotationDraft => ({
  id: x.id,
  date: x.date,
  validUntil: x.validUntil,
  customerId: x.customerId,
  productId: x.productId,
  quantity: x.quantity,
  size: x.size ?? null,
  inputs: structuredClone(x.inputs),
  pricePerPiece: x.pricePerPiece,
  notes: x.notes,
  expectedUpdatedAt: x.updatedAt,
})

function QuotationEditor({ quotation }: { quotation?: Quotation }) {
  useDocumentTitle(quotation ? `Quotation ${quotation.code}` : 'New quotation')
  const { db, can, run, pushToast } = useStore()
  const read = useLatestDb()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [d, setD] = useState<QuotationDraft>(() =>
    quotation
      ? toDraft(quotation)
      : {
          id: '',
          date: format(new Date(), 'yyyy-MM-dd'),
          validUntil: format(addDays(new Date(), 15), 'yyyy-MM-dd'),
          customerId: params.get('customer') ?? '',
          productId: '',
          quantity: NaN,
          size: null,
          inputs: defaultCostingInputs(db, undefined, (p) => `${p}-${Math.random().toString(36).slice(2, 8)}`),
          pricePerPiece: null,
          notes: '',
        },
  )
  const [baseline, setBaseline] = useState(() => JSON.stringify(d))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [issues, setIssues] = useState<Parameters<typeof IssueList>[0]['issues']>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewDoc | null>(null)
  const [confirmPlan, setConfirmPlan] = useState(false)
  const dirty = JSON.stringify(d) !== baseline
  const guard = useUnsavedChanges(dirty)
  const locked = !!quotation?.planId
  const set = (patch: Partial<QuotationDraft>) => setD((x) => ({ ...x, ...patch }))
  const setInputs = (patch: Partial<CostingInputs>) => setD((x) => ({ ...x, inputs: { ...x.inputs, ...patch } }))

  const product = db.products.find((p) => p.id === d.productId)
  const products = db.products.filter((p) => p.active || p.id === d.productId)
  const ready = !!product && Number.isInteger(d.quantity) && d.quantity > 0
  const result = useMemo(() => (ready ? quoteCosting(db, d) : null), [db, d, ready])
  const usual = useMemo(() => (ready && (d.inputs.materialPrices || d.inputs.processRates) ? quoteCosting(db, { ...d, inputs: { ...d.inputs, materialPrices: undefined, processRates: undefined } }) : result), [db, d, ready, result])
  const totals = result ? quoteTotals(result, d.pricePerPiece, d.inputs) : null
  const wrong = result?.issues.filter((i) => i.level === 'error' && !i.gap) ?? []
  const missing = result?.issues.filter((i) => i.level === 'error' && i.gap) ?? []
  const own = (key: 'materialPrices' | 'processRates', id: string, v: number | null) =>
    setD((x) => {
      const { [id]: _old, ...rest } = x.inputs[key] ?? {}
      void _old
      const next = v === null ? rest : { ...rest, [id]: v }
      return { ...x, inputs: { ...x.inputs, [key]: Object.keys(next).length ? next : undefined } }
    })

  const save = async (): Promise<Quotation | null> => {
    if (busy) return null
    setBusy('save')
    try {
      const r = await run(saveQuotation(d))
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {})
        setIssues(r.issues ?? [])
        if (!r.fieldErrors) pushToast({ title: 'Quotation not saved', message: r.error, level: 'danger' })
        focusFirstInvalid()
        return null
      }
      setErrors({})
      setIssues([])
      const next = toDraft(r.value)
      setD(next)
      setBaseline(JSON.stringify(next))
      pushToast({ title: quotation ? `${r.value.code} saved` : `${r.value.code} created`, message: `Total ${moneyPaise(r.value.totals.grandTotal)}`, level: 'success' })
      if (!quotation) {
        guard.bypass()
        navigate(`/quotations/${r.value.id}`, { replace: true })
      }
      return r.value
    } finally {
      setBusy(null)
    }
  }

  const mark = async (status: QuotationStatus) => {
    if (!quotation || busy) return
    setBusy(status)
    try {
      const r = await run(setQuotationStatus(quotation.id, status))
      if (!r.ok) return pushToast({ title: 'Not changed', message: r.error, level: 'danger' })
      setBaseline(JSON.stringify({ ...d, expectedUpdatedAt: r.value.updatedAt }))
      setD((x) => ({ ...x, expectedUpdatedAt: r.value.updatedAt }))
      pushToast({ title: `${quotation.code} marked ${status.toLowerCase()}`, level: 'info' })
    } finally {
      setBusy(null)
    }
  }

  const makePlan = async () => {
    if (!quotation || busy) return
    setBusy('plan')
    try {
      const r = await run(quotationToPlan(quotation.id))
      setConfirmPlan(false)
      if (!r.ok) return pushToast({ title: 'Plan not made', message: r.error, level: 'danger' })
      guard.bypass()
      pushToast({ title: `${r.value.plan.code} made from ${quotation.code}`, message: 'Allocate the units, then send it to costing — it starts at the quoted price.', level: 'success' })
      navigate(`/planning/${r.value.plan.id}`)
    } finally {
      setBusy(null)
    }
  }

  const plan = quotation?.planId ? db.plans.find((p) => p.id === quotation.planId) : undefined

  return (
    <div className="space-y-6">
      <LinkButton to="/quotations" variant="ghost" icon={<ArrowLeft className="h-4 w-4" />}>
        All quotations
      </LinkButton>
      <PageHeader
        eyebrow="Sales · Quotation"
        title={quotation ? quotation.code : 'New quotation'}
        subtitle={quotation ? `${fmtDate(quotation.date)} · valid until ${fmtDate(quotation.validUntil)}` : 'Choose the customer, product and quantity — the price is worked out from Master.'}
        icon={<FileText className="h-4 w-4" />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {quotation ? <QuotationStatusBadge status={quotation.status} /> : null}
            {quotation ? (
              <>
                <Button variant="ghost" icon={<Eye className="h-4 w-4" />} disabled={dirty} title={dirty ? 'Save first' : undefined} onClick={() => setPreview(quotationDoc(read, quotation.id))}>
                  Preview
                </Button>
                <DownloadButton variant="secondary" icon={<Download className="h-4 w-4" />} disabled={dirty} title={dirty ? 'Save first' : undefined} doc={() => quotationDoc(read, quotation.id)}>
                  Quotation PDF
                </DownloadButton>
              </>
            ) : null}
          </div>
        }
      />

      {locked ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-ok-wash px-4 py-3 text-sm text-ok ring-1 ring-inset ring-ok-edge" role="status">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">The customer agreed and a plan was made from this quotation. Change the order in the plan.</span>
          {plan ? (
            <LinkButton to={`/planning/${plan.id}`} size="sm" variant="secondary" icon={<CalendarRange className="h-3.5 w-3.5" />}>
              {plan.code}
            </LinkButton>
          ) : null}
        </div>
      ) : null}

      <form
        noValidate
        className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <div className="min-w-0 space-y-6">
          <Card className="vx-anim-up">
            <CardHead title="Quotation for" />
            <fieldset disabled={locked} className="grid gap-x-4 p-5 sm:grid-cols-2">
              <Field label="Customer" required error={errors.customerId} as="div" className="sm:col-span-2">
                <CustomerInput aria-label="Customer" selectedId={d.customerId} onPick={(c) => set({ customerId: c.id })} invalid={!!errors.customerId} disabled={locked} />
              </Field>
              <Field label="Product" required error={errors.productId} as="div" className="sm:col-span-2">
                <Picker
                  noun="product"
                  aria-label="Product"
                  value={product?.name ?? ''}
                  options={products.map((p) => ({ id: p.id, label: p.name, detail: `${p.code}${p.active ? '' : ' · inactive'}`, item: p }))}
                  // A new product brings its own GST rate.
                  onPick={(o) => o.id !== d.productId && setD((x) => ({ ...x, productId: o.id, size: null, inputs: { ...x.inputs, taxPct: o.item.taxPct ?? db.settings.taxPct, materialPrices: undefined, processRates: undefined } }))}
                  onNew={can('master') ? () => navigate('/master/products/new?fresh=1') : undefined}
                  placeholder="Choose a product…"
                  invalid={!!errors.productId}
                  disabled={locked}
                />
              </Field>
              <Field label={`Quantity (${product?.uom ?? 'pcs'})`} required error={errors.quantity}>
                <NumberInput value={d.quantity} onChange={(v) => set({ quantity: v ?? NaN })} invalid={!!errors.quantity} />
              </Field>
              <div className="hidden sm:block" />
              <Field label="Date" required error={errors.date}>
                <Input type="date" value={d.date} onChange={(e) => set({ date: e.target.value })} />
              </Field>
              <Field label="Valid until" required error={errors.validUntil} hint="How long this price holds.">
                <Input type="date" value={d.validUntil} onChange={(e) => set({ validUntil: e.target.value })} />
              </Field>
              <div className="sm:col-span-2">
                <SizeInput
                  label="Size (optional)"
                  value={d.size}
                  onChange={(v) => set({ size: v })}
                  choices={product?.baseSize ? [{ size: product.baseSize, label: `Usual size ${sizeText(product.baseSize)}` }] : []}
                />
                <p className="mt-1 text-xs text-muted">Blank = the product’s usual size. A bigger or smaller box changes the materials in proportion.</p>
              </div>
              <Field label="Notes on the quotation" className="mt-3 sm:col-span-2">
                <Textarea rows={2} value={d.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Delivery in 10 days, artwork by customer…" />
              </Field>
            </fieldset>
          </Card>

          {result && !locked ? (
            <>
              <MaterialsTable result={result} edit={{ prices: d.inputs.materialPrices ?? {}, usual: (id) => usual?.materialLines.find((l) => l.materialId === id)?.price ?? null, onChange: (id, v) => own('materialPrices', id, v) }} />
              <ProcessesTable result={result} edit={{ rates: d.inputs.processRates ?? {}, usual: (id) => usual?.processLines.find((l) => l.processId === id)?.rate ?? null, onChange: (id, v) => own('processRates', id, v) }} />
            </>
          ) : null}
        </div>

        <aside className="space-y-6 xl:sticky xl:top-24">
          <Card className="vx-anim-up overflow-hidden">
            <div className="border-b border-rule bg-surface-2 px-5 py-5">
              <p className="font-mono text-2xs uppercase tracking-[0.10em] text-accent-text">Quoted total</p>
              <p className="vx-code mt-1.5 font-display text-3xl font-semibold leading-none tracking-tight text-ink">{totals && !wrong.length ? moneyPaise(totals.grandTotal) : '—'}</p>
              <p className="mt-2 text-sm text-muted">{totals ? `${moneyPaise(totals.sellingPerPiece)} per piece before ${totals.taxLabel} · ${pieces(d.quantity)}` : 'Choose a product and quantity to see the price.'}</p>
            </div>
            <fieldset disabled={locked} className="space-y-1 p-5">
              <Field label="Profit % (markup on cost)" hint={totals ? `Cost ${moneyPrecise(totals.costPerPiece)} per piece — not shown on the quotation.` : undefined}>
                <NumberInput value={d.inputs.profitPct} onChange={(v) => setInputs({ profitPct: v ?? NaN, profitMethod: 'markup' })} invalid={!Number.isFinite(d.inputs.profitPct)} />
              </Field>
              <Field label="Price per piece (₹)" error={errors.pricePerPiece} hint={d.pricePerPiece === null ? 'Worked out from cost + profit. Type a round price to quote that instead.' : 'Typed by hand — clear it to go back to cost + profit.'}>
                <NumberInput
                  value={d.pricePerPiece ?? (result ? result.sellingPerPiece : null)}
                  className={cx(d.pricePerPiece !== null && 'border-accent bg-accent-wash')}
                  onChange={(v) => set({ pricePerPiece: v === null || (result && v === result.sellingPerPiece) ? null : v })}
                  invalid={!!errors.pricePerPiece}
                />
              </Field>
              <div className="grid grid-cols-2 gap-x-3">
                <Field label="Discount (₹)">
                  <NumberInput value={d.inputs.discountValue} onChange={(v) => setInputs({ discountValue: v ?? 0, discountType: 'amount' })} />
                </Field>
                <Field label="GST %">
                  <NumberInput value={d.inputs.taxPct} onChange={(v) => setInputs({ taxPct: v ?? NaN })} invalid={!Number.isFinite(d.inputs.taxPct)} />
                </Field>
              </div>
            </fieldset>
            {totals ? (
              <dl className="space-y-1 border-t border-rule px-5 py-4 text-sm">
                {(
                  [
                    ['Subtotal', totals.totalSelling],
                    ...(totals.discountAmount > 0 ? [['Less: discount', -totals.discountAmount]] : []),
                    ['Taxable value', totals.taxableValue],
                    // Split as the invoice will be, for this customer's state.
                    ...saleTaxLines(db.company, db.customers.find((c) => c.id === d.customerId) ?? {}, totals.taxPct, totals.taxAmount, totals.taxLabel).lines,
                  ] as Array<[string, number]>
                ).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-muted">{k}</dt>
                    <dd className="vx-code tabular-nums">{moneyPaise(v)}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-3 border-t border-rule pt-2 font-semibold text-ink">
                  <dt>Total</dt>
                  <dd className="vx-code tabular-nums">{moneyPaise(totals.grandTotal)}</dd>
                </div>
                <p className={cx('pt-1 text-xs', totals.grandTotal - totals.taxAmount - totals.totalCost < 0 ? 'text-risk' : 'text-muted')}>
                  Profit about {moneyPaise(totals.taxableValue - totals.totalCost)} on cost {moneyPaise(totals.totalCost)} — internal, not printed.
                </p>
              </dl>
            ) : null}
          </Card>

          {wrong.length || issues.length ? <IssueList issues={wrong.length ? wrong : issues} title="Correct these before saving" /> : null}
          {missing.length ? <IssueList issues={missing.map((i) => ({ ...i, level: 'warning' as const }))} warningTitle={`${missing.length} detail(s) not entered — counted as zero, so the price may be low`} /> : null}

          {!locked ? (
            <Card className="vx-anim-up space-y-2 p-4">
              <Button type="submit" block icon={<Save className="h-4 w-4" />} loading={busy === 'save'}>
                {quotation ? 'Save quotation' : 'Save & number it'}
              </Button>
              {quotation ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant="secondary" icon={<Send className="h-4 w-4" />} loading={busy === 'Sent'} disabled={quotation.status === 'Sent'} onClick={() => void mark('Sent')}>
                      Mark sent
                    </Button>
                    <Button type="button" variant="secondary" icon={<XCircle className="h-4 w-4" />} loading={busy === 'Declined'} disabled={quotation.status === 'Declined'} onClick={() => void mark('Declined')}>
                      Declined
                    </Button>
                  </div>
                  {can('planning') ? (
                    <Button type="button" variant="secondary" block icon={<CheckCircle2 className="h-4 w-4" />} disabled={dirty} title={dirty ? 'Save first' : undefined} onClick={() => setConfirmPlan(true)}>
                      Customer agreed — make a plan
                    </Button>
                  ) : null}
                </>
              ) : null}
              <p className="text-xs text-muted">{dirty ? 'Unsaved changes — save to download the PDF.' : quotation ? 'Saved.' : 'Saving gives it a number (QTN-…).'}</p>
            </Card>
          ) : null}
        </aside>
      </form>

      <ConfirmDialog
        open={confirmPlan}
        title="Make a plan from this quotation?"
        body={`A draft plan is made for ${pieces(d.quantity)} of ${product?.name ?? 'this product'}. Allocate the units in Planning and send it to costing — the costing starts at the quoted price. Nothing goes to production until the costing is finalized.`}
        confirmLabel="Make the plan"
        onCancel={() => setConfirmPlan(false)}
        onConfirm={() => void makePlan()}
      />
      <DocumentPreview doc={preview} onClose={() => setPreview(null)} />
      {guard.dialog}
    </div>
  )
}
