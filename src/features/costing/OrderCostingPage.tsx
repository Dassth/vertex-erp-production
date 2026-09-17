import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Calculator, CheckCircle2, Factory, Lock, Plus, Save, Trash2 } from 'lucide-react'
import { useStore } from '../../store/store'
import type { ChargeBasis, CostingInputs, CostingResult, OrderCosting, Plan, ProfitMethod } from '../../lib/types'
import { finalizeCosting, openCosting, saveCostingInputs } from '../../domain/orderCosting'
import { COST_BASIS_LABEL, computeOrderCosting } from '../../lib/costing'
import { cx, fmtDate, fmtDateTime, moneyPaise, moneyPrecise, pct, pieces, qty, uid } from '../../lib/format'
import { Badge, Button, Card, CardHead, ConfirmDialog, EmptyState, Field, IconButton, Input, Select, Skeleton } from '../../components/ui'
import { ConflictNotice, Detail, IssueList, LinkButton, NumberInput, PageHeader, useDocumentTitle, useUnsavedChanges } from '../../components/page'
import { CostingStatusBadge, PlanStatusBadge } from '../../components/status'

export function OrderCostingPage() {
  const { planId } = useParams()
  const { db, run } = useStore()
  const plan = db.plans.find((p) => p.id === planId)
  const costing = db.costings.find((c) => c.planId === planId)
  useDocumentTitle(plan ? `Costing · ${plan.code}` : 'Order costing')

  useEffect(() => {
    if (plan?.status === 'Ready for Costing' && !costing) run(openCosting(plan.id))
  }, [plan?.id, plan?.status, costing, run])

  const back = (
    <LinkButton to="/costing" variant="secondary" icon={<ArrowLeft className="h-4 w-4" />}>
      Order costing
    </LinkButton>
  )

  if (!plan)
    return (
      <Card>
        <EmptyState icon={<Calculator className="h-6 w-6" />} title="Plan not found" message="Return to the costing list." action={back} />
      </Card>
    )
  if (plan.status === 'Draft' || plan.status === 'Cancelled')
    return (
      <Card>
        <EmptyState
          icon={<Calculator className="h-6 w-6" />}
          title={plan.status === 'Draft' ? `${plan.code} is still a draft` : `${plan.code} was cancelled`}
          message={plan.status === 'Draft' ? 'Complete the plan and send it to costing from Planning — every stage needs a production unit first.' : 'Cancelled plans cannot be costed.'}
          action={<LinkButton to={`/planning/${plan.id}`}>Open plan</LinkButton>}
        />
      </Card>
    )
  if (!costing) return <Skeleton className="h-96 w-full" />
  return <CostingWorkspace key={costing.id} plan={plan} costing={costing} back={back} />
}

function CostingWorkspace({ plan, costing, back }: { plan: Plan; costing: OrderCosting; back: React.ReactNode }) {
  const { db, run, pushToast } = useStore()
  const navigate = useNavigate()
  const finalized = costing.status === 'Finalized' && !!costing.snapshot
  const [inputs, setInputs] = useState<CostingInputs>(() => structuredClone(costing.inputs))
  // The inputs and version this screen started from — drives dirty state and stale-save detection.
  const [base, setBase] = useState(() => ({ inputs: structuredClone(costing.inputs), updatedAt: costing.updatedAt }))
  const [conflict, setConflict] = useState('')
  const [saving, setSaving] = useState(false)
  const loadLatest = () => {
    setInputs(structuredClone(costing.inputs))
    setBase({ inputs: structuredClone(costing.inputs), updatedAt: costing.updatedAt })
    setConflict('')
  }
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [finalizeIssues, setFinalizeIssues] = useState<CostingResult['issues']>([])
  const [templateId, setTemplateId] = useState('')
  const inFlight = useRef(false)
  const dirty = !finalized && JSON.stringify(inputs) !== JSON.stringify(base.inputs)
  const guard = useUnsavedChanges(dirty)

  // Another tab saved these inputs: follow along unless this screen has its own unsaved edits.
  useEffect(() => {
    if (costing.updatedAt === base.updatedAt || dirty) return
    setInputs(structuredClone(costing.inputs))
    setBase({ inputs: structuredClone(costing.inputs), updatedAt: costing.updatedAt })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [costing.updatedAt])

  const product = db.products.find((p) => p.id === plan.productId)
  const customer = finalized ? costing.snapshot!.customer : db.customers.find((c) => c.id === plan.customerId)
  const productName = finalized ? costing.snapshot!.product.name : (product?.name ?? '—')
  const uom = finalized ? costing.snapshot!.product.uom : (product?.uom ?? 'pcs')
  const order = db.orders.find((o) => o.id === costing.orderId)

  const result = useMemo<CostingResult | null>(() => {
    if (finalized) return costing.snapshot!.result
    if (!product) return null
    return computeOrderCosting({
      quantity: plan.quantity,
      product: { productId: product.id, stages: product.stages, materials: product.materials },
      materials: db.materials,
      settings: db.settings,
      inputs,
    })
  }, [finalized, costing.snapshot, product, plan.quantity, db.materials, db.settings, inputs])

  const set = (patch: Partial<CostingInputs>) => setInputs((i) => ({ ...i, ...patch }))
  const errors = result?.issues.filter((i) => i.level === 'error') ?? []
  const warnings = result?.issues.filter((i) => i.level === 'warning') ?? []

  const doFinalize = async () => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    const r = await run(finalizeCosting(costing.id, inputs, base.updatedAt))
    setBusy(false)
    setConfirmOpen(false)
    inFlight.current = false
    if (!r.ok) {
      if (r.conflict) setConflict(r.error)
      setFinalizeIssues(r.issues ?? [])
      pushToast({ title: 'Costing not finalized', message: r.error, level: 'danger' })
      return
    }
    guard.bypass()
    pushToast({
      title: r.value.created ? `${r.value.order.code} released to production` : `${r.value.order.code} already exists`,
      message: r.value.created ? `${r.value.order.stages.length} stages scheduled. The costing snapshot is saved.` : 'This costing was finalized earlier; no duplicate order was created.',
      level: r.value.created ? 'success' : 'info',
    })
    navigate(`/production?job=${r.value.order.id}`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations · Order costing"
        title={`${costing.code} · ${plan.code}`}
        subtitle={`${customer?.company ?? '—'} · ${productName} · ${pieces(plan.quantity)} · delivery ${fmtDate(plan.deliveryDate)}`}
        icon={<Calculator className="h-4 w-4" />}
        actions={
          <>
            <CostingStatusBadge status={costing.status} />
            <PlanStatusBadge status={plan.status} />
            {back}
          </>
        }
      />

      {finalized ? (
        <div className="vx-anim-up flex flex-wrap items-center gap-3 rounded-md bg-ok-wash px-4 py-3 text-sm text-ok ring-1 ring-inset ring-ok-edge">
          <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            Finalized {fmtDateTime(costing.finalizedAt)} by {costing.finalizedBy}. This is a saved snapshot — later Master price or definition changes do not alter it.
          </span>
          {order ? (
            <LinkButton to={`/production?job=${order.id}`} size="sm" variant="secondary" icon={<Factory className="h-3.5 w-3.5" />}>
              {order.code}
            </LinkButton>
          ) : null}
        </div>
      ) : null}

      {conflict && !finalized ? <ConflictNotice message={conflict} onReload={loadLatest} /> : null}

      {!result ? (
        <Card>
          <EmptyState icon={<Calculator className="h-6 w-6" />} title="Product unavailable" message="The product for this plan no longer exists in Master." action={<LinkButton to="/master/products">Master → Products</LinkButton>} />
        </Card>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
            <div className="min-w-0 space-y-6">
              {!finalized && (errors.length || warnings.length || finalizeIssues.length) ? (
                <Card className="vx-anim-up p-5">
                  <IssueList issues={errors.length ? errors : finalizeIssues.length ? finalizeIssues : []} title={`${errors.length || finalizeIssues.length} input(s) must be completed before finalizing`} />
                  {warnings.length ? <IssueList issues={warnings} className="mt-3" /> : null}
                </Card>
              ) : null}

              <MaterialsTable result={result} />
              <ProcessesTable result={result} />

              <Card className="vx-anim-up">
                <CardHead title="Additional order charges" subtitle="Order-specific costs added to total cost (e.g. transport, design, plates)" />
                <div className="space-y-3 p-5">
                  {inputs.charges.length === 0 && !finalized ? <p className="text-sm text-muted">No additional charges on this order.</p> : null}
                  {(finalized ? costing.snapshot!.inputs.charges : inputs.charges).map((c) => {
                    const line = result.chargeLines.find((l) => l.id === c.id)
                    return (
                      <div key={c.id} className="grid items-end gap-x-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto_auto]">
                        <Field label="Charge">
                          <Input value={c.name} disabled={finalized} onChange={(e) => set({ charges: inputs.charges.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)) })} />
                        </Field>
                        <Field label="Basis">
                          <Select value={c.basis} disabled={finalized} onChange={(e) => set({ charges: inputs.charges.map((x) => (x.id === c.id ? { ...x, basis: e.target.value as ChargeBasis } : x)) })}>
                            {(['fixed', 'per_1000', 'percent'] as ChargeBasis[]).map((b) => (
                              <option key={b} value={b}>
                                {COST_BASIS_LABEL[b]}
                              </option>
                            ))}
                          </Select>
                        </Field>
                        <Field label={c.basis === 'percent' ? '%' : 'Amount ₹'}>
                          <NumberInput value={c.amount} disabled={finalized} invalid={c.amount === null} onChange={(v) => set({ charges: inputs.charges.map((x) => (x.id === c.id ? { ...x, amount: v } : x)) })} />
                        </Field>
                        <p className="vx-code mb-5 min-w-24 text-right text-sm font-medium text-ink">{moneyPaise(line?.amount ?? 0)}</p>
                        {!finalized ? (
                          <IconButton type="button" className="mb-5" label={`Remove ${c.name || 'charge'}`} onClick={() => set({ charges: inputs.charges.filter((x) => x.id !== c.id) })}>
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
                        ) : (
                          <span />
                        )}
                      </div>
                    )
                  })}
                  {!finalized ? (
                    <div className="flex flex-wrap items-end gap-2 border-t border-rule pt-3">
                      <Field label="Add from template" className="w-60">
                        <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                          <option value="">Custom charge</option>
                          {db.settings.orderCharges
                            .filter((t) => t.active)
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                        </Select>
                      </Field>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="mb-5"
                        icon={<Plus className="h-3.5 w-3.5" />}
                        onClick={() => {
                          const t = db.settings.orderCharges.find((x) => x.id === templateId)
                          set({ charges: [...inputs.charges, { id: uid('chg'), templateId: t?.id ?? null, name: t?.name ?? '', basis: t?.basis ?? 'fixed', amount: t?.amount ?? null }] })
                          setTemplateId('')
                        }}
                      >
                        Add charge
                      </Button>
                    </div>
                  ) : null}
                </div>
              </Card>
            </div>

            {/* ------------------------------ Pricing ------------------------------ */}
            <div className="space-y-6 xl:sticky xl:top-24">
              <Card className="vx-anim-up overflow-hidden">
                <div className="border-b border-rule bg-surface-2 px-5 py-5">
                  <p className="font-mono text-2xs uppercase tracking-[0.10em] text-accent-text">Final customer amount</p>
                  <p className="vx-code mt-1.5 font-display text-3xl font-semibold leading-none tracking-tight text-ink">{errors.length && !finalized ? '—' : moneyPaise(result.grandTotal)}</p>
                  <p className="mt-2 text-sm text-muted">
                    Includes {result.taxLabel} {result.taxPct}% · selling price {moneyPaise(result.sellingPerPiece)} per piece before tax
                  </p>
                </div>
                <dl className="grid grid-cols-2 divide-x divide-y divide-rule border-b border-rule">
                  <Mini label="Total production cost" value={moneyPaise(result.totalCost)} />
                  <Mini label="Production cost / piece" value={moneyPrecise(result.costPerPiece)} />
                  <Mini label="Profit amount" value={moneyPaise(result.profitAmount)} tone={result.profitAmount < 0 ? 'text-risk' : 'text-ok'} />
                  <Mini label="Selling price / piece" value={moneyPaise(result.sellingPerPiece)} />
                  <Mini label="Total selling (before tax)" value={moneyPaise(result.totalSelling)} />
                  <Mini label={`${result.taxLabel} ${result.taxPct}%`} value={moneyPaise(result.taxAmount)} />
                </dl>
                <div className="space-y-1 p-5">
                  <p className="vx-mono-label">Internal — not shown on invoices</p>
                  <p className="text-xs text-muted">
                    Effective markup {pct(result.effectiveMarkupPct)} · effective margin {pct(result.effectiveMarginPct)}
                  </p>
                </div>
              </Card>

              <Card className="vx-anim-up">
                <CardHead title="Profit, discount & tax" subtitle={finalized ? 'Frozen in the snapshot' : 'Order-specific — defaults come from Master → Costing'} />
                <fieldset disabled={finalized} className="grid gap-x-3 p-5 sm:grid-cols-2">
                  <Field label="Profit method" as="div" className="sm:col-span-2">
                    <div className="grid gap-2" role="radiogroup" aria-label="Profit method">
                      {(
                        [
                          ['markup', 'Markup on cost', 'Selling = cost × (1 + %)'],
                          ['margin', 'Margin on selling price', 'Selling = cost ÷ (1 − %)'],
                        ] as Array<[ProfitMethod, string, string]>
                      ).map(([m, label, hint]) => (
                        <label key={m} className={cx('vx-press flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2', inputs.profitMethod === m ? 'border-accent bg-accent-wash' : 'border-rule-2 hover:bg-surface-2')}>
                          <input type="radio" name="profit-method" className="mt-1 accent-[var(--color-accent)]" checked={inputs.profitMethod === m} onChange={() => set({ profitMethod: m })} />
                          <span>
                            <span className="block text-sm font-medium text-ink">{label}</span>
                            <span className="block text-xs text-muted">{hint}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </Field>
                  <Field label={inputs.profitMethod === 'markup' ? 'Markup %' : 'Margin %'}>
                    <NumberInput value={inputs.profitPct} onChange={(v) => set({ profitPct: v ?? NaN })} invalid={!Number.isFinite(inputs.profitPct)} />
                  </Field>
                  <Field label={`${result.taxLabel} %`}>
                    <NumberInput value={inputs.taxPct} onChange={(v) => set({ taxPct: v ?? NaN })} invalid={!Number.isFinite(inputs.taxPct)} />
                  </Field>
                  <Field label="Discount type">
                    <Select value={inputs.discountType} onChange={(e) => set({ discountType: e.target.value as 'amount' | 'percent' })}>
                      <option value="amount">Amount ₹</option>
                      <option value="percent">Percent of selling</option>
                    </Select>
                  </Field>
                  <Field label="Discount">
                    <NumberInput value={inputs.discountValue} onChange={(v) => set({ discountValue: v ?? 0 })} invalid={!Number.isFinite(inputs.discountValue)} />
                  </Field>
                </fieldset>
              </Card>

              <BuildUp result={result} uom={uom} />

              {!finalized ? (
                <Card className="vx-anim-up p-5">
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="secondary"
                      icon={<Save className="h-4 w-4" />}
                      disabled={!dirty}
                      loading={saving}
                      onClick={async () => {
                        if (saving) return
                        setSaving(true)
                        const r = await run(saveCostingInputs(costing.id, inputs, base.updatedAt))
                        setSaving(false)
                        if (r.ok) {
                          setBase({ inputs: structuredClone(r.value.inputs), updatedAt: r.value.updatedAt })
                          pushToast({ title: 'Costing inputs saved', level: 'success' })
                        } else {
                          if (r.conflict) setConflict(r.error)
                          pushToast({ title: 'Not saved', message: r.error, level: 'danger' })
                        }
                      }}
                    >
                      Save inputs
                    </Button>
                    <Button icon={<CheckCircle2 className="h-4 w-4" />} disabled={errors.length > 0} loading={busy} onClick={() => setConfirmOpen(true)}>
                      Finalize & release to production
                    </Button>
                    <p className="text-center text-xs text-muted" aria-live="polite">
                      {errors.length ? `Complete ${errors.length} input(s) above to finalize.` : dirty ? 'Unsaved inputs are saved when you finalize.' : 'Ready to finalize.'}
                    </p>
                  </div>
                </Card>
              ) : (
                <Card className="vx-anim-up p-5 text-sm text-muted">
                  <dl className="grid gap-3">
                    <Detail label="Customer">{costing.snapshot!.customer.company}</Detail>
                    <Detail label="Product version">
                      {costing.snapshot!.product.code} v{costing.snapshot!.product.version}
                    </Detail>
                  </dl>
                </Card>
              )}
            </div>
          </div>

          <ConfirmDialog
            open={confirmOpen}
            tone="success"
            title={`Finalize ${costing.code}?`}
            confirmLabel="Finalize and release"
            body={
              <div className="space-y-2">
                <p>
                  Final customer amount <strong className="text-ink">{moneyPaise(result.grandTotal)}</strong> (including {result.taxLabel}) for {pieces(plan.quantity)} at a selling price of {moneyPaise(result.sellingPerPiece)} per piece before tax. Production cost is {moneyPrecise(result.costPerPiece)} per piece.
                </p>
                <ul className="list-disc space-y-0.5 pl-5">
                  <li>A snapshot of prices, quantities, rates and selling prices is saved.</li>
                  <li>A production order is created and {product?.stages.length ?? 0} stages are scheduled for their assigned units.</li>
                  <li>The costing and plan become read-only.</li>
                </ul>
              </div>
            }
            onCancel={() => setConfirmOpen(false)}
            onConfirm={doFinalize}
          />
        </>
      )}
      {guard.dialog}
    </div>
  )
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <dt className="vx-mono-label !mb-0 truncate">{label}</dt>
      <dd className={cx('vx-code mt-1 truncate font-display text-md font-semibold text-ink', tone)}>{value}</dd>
    </div>
  )
}

function MaterialsTable({ result }: { result: CostingResult }) {
  return (
    <Card className="vx-anim-up overflow-hidden">
      <CardHead title="Materials" subtitle={`Wastage is applied once to the net requirement; purchase quantities are rounded up. Total ${moneyPaise(result.materialCost)}`} />
      {result.materialLines.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">No materials on this product.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px]">
            <thead>
              <tr>
                <th className="vx-th">Material</th>
                <th className="vx-th text-right">Ups / sheet</th>
                <th className="vx-th text-right">Pieces</th>
                <th className="vx-th text-right">Net</th>
                <th className="vx-th text-right">Wastage</th>
                <th className="vx-th text-right">Total</th>
                <th className="vx-th text-right">Purchase</th>
                <th className="vx-th text-right">Rate</th>
                <th className="vx-th text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {result.materialLines.map((l) => {
                const unit = l.kind === 'sheet' ? 'sheets' : l.uom
                const digits = l.kind === 'sheet' ? 0 : 3
                return (
                  <tr key={l.bomLineId} className="vx-row">
                    <td className="vx-td vx-td-wrap">
                      <span className="block font-medium text-ink">{l.name}</span>
                      <span className="block text-2xs text-faint">
                        {l.code}
                        {l.stageName ? ` · ${l.stageName}${l.processName ? ` › ${l.processName}` : ''}` : ' · whole product'}
                      </span>
                    </td>
                    <td className="vx-td text-right">
                      {l.sheet ? (
                        <>
                          <span className="vx-code block text-ink">{l.sheet.ups}</span>
                          <span className="block text-2xs text-faint">
                            {l.sheet.upsSource === 'override' ? `override (${l.sheet.calculatedUps} calc.)` : `${l.sheet.along}×${l.sheet.across}${l.sheet.orientation === 'rotated' ? ' rotated' : ''}`}
                          </span>
                        </>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className="vx-td text-right tabular-nums">{l.kind === 'sheet' ? qty(l.piecesNeeded, 0) : '—'}</td>
                    <td className="vx-td text-right tabular-nums">
                      {qty(l.netQty, digits)} <span className="text-2xs text-faint">{unit}</span>
                    </td>
                    <td className="vx-td text-right tabular-nums text-warn">
                      {qty(l.wastageQty, digits)} <span className="text-2xs text-faint">({l.wastagePct}%)</span>
                    </td>
                    <td className="vx-td text-right font-medium tabular-nums">{qty(l.totalQty, digits)}</td>
                    <td className="vx-td text-right tabular-nums">
                      <span className="block">
                        {qty(l.purchaseQty, 3)} × {l.purchaseUnit}
                      </span>
                      {l.surplusQty > 0 ? <span className="block text-2xs text-faint">+{qty(l.surplusQty, digits)} {unit} surplus</span> : null}
                    </td>
                    <td className="vx-td text-right tabular-nums">{l.price === null ? <Badge tone="red">Missing</Badge> : moneyPaise(l.price)}</td>
                    <td className="vx-td text-right font-semibold tabular-nums text-ink">{moneyPaise(l.amount)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function ProcessesTable({ result }: { result: CostingResult }) {
  return (
    <Card className="vx-anim-up overflow-hidden">
      <CardHead title="Processes & setup" subtitle={`Run ${moneyPaise(result.processRunCost)} · setup ${moneyPaise(result.setupCost)}`} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px]">
          <thead>
            <tr>
              <th className="vx-th">Stage › process</th>
              <th className="vx-th">Rate source</th>
              <th className="vx-th text-right">Hours</th>
              <th className="vx-th text-right">Rate</th>
              <th className="vx-th text-right">Run cost</th>
              <th className="vx-th text-right">Setup</th>
              <th className="vx-th text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {result.processLines.map((l) => (
              <tr key={l.processId} className="vx-row">
                <td className="vx-td vx-td-wrap">
                  <span className="block text-2xs text-faint">{l.stageName}</span>
                  <span className="block font-medium text-ink">{l.processName}</span>
                </td>
                <td className="vx-td text-sm">
                  {l.chargeName ?? 'Custom'} <span className="block text-2xs text-faint">{COST_BASIS_LABEL[l.basis]}</span>
                </td>
                <td className="vx-td text-right tabular-nums">{qty(l.hours, 2)}</td>
                <td className="vx-td text-right tabular-nums">{l.rate === null ? <Badge tone="red">Missing</Badge> : moneyPaise(l.rate)}</td>
                <td className="vx-td text-right tabular-nums">{moneyPaise(l.runCost)}</td>
                <td className="vx-td text-right tabular-nums">{l.setupCharge === null ? <Badge tone="red">Missing</Badge> : moneyPaise(l.setupCost)}</td>
                <td className="vx-td text-right font-semibold tabular-nums text-ink">{moneyPaise(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function BuildUp({ result, uom }: { result: CostingResult; uom: string }) {
  const p = result.profitPct
  const rows: Array<[string, string, boolean?]> = [
    ['Materials (incl. wastage, purchase rounding)', moneyPaise(result.materialCost)],
    ['+ Process run cost', moneyPaise(result.processRunCost)],
    ['+ Setup charges', moneyPaise(result.setupCost)],
    ['+ Additional order charges', moneyPaise(result.chargesCost)],
    ['= Total production cost', moneyPaise(result.totalCost), true],
    [`÷ ${result.quantity.toLocaleString('en-IN')} ${uom} = production cost per piece (unrounded)`, moneyPrecise(result.costPerPiece)],
    [
      result.profitMethod === 'markup'
        ? `Selling price per piece = cost/piece × (1 + ${p}% markup on cost), rounded to the paisa`
        : `Selling price per piece = cost/piece ÷ (1 − ${p}% margin on selling price), rounded to the paisa`,
      moneyPaise(result.sellingPerPiece),
    ],
    [`× ${result.quantity.toLocaleString('en-IN')} = total selling price (before discount and tax)`, moneyPaise(result.totalSelling), true],
    [
      `Profit (selling − cost) = ${result.effectiveMarkupPct.toFixed(2)}% of cost, ${result.effectiveMarginPct.toFixed(2)}% of selling price`,
      moneyPaise(result.profitAmount),
    ],
    ['− Discount', moneyPaise(result.discountAmount)],
    ['= Taxable value', moneyPaise(result.taxableValue)],
    [`+ ${result.taxLabel} ${result.taxPct}%`, moneyPaise(result.taxAmount)],
    ['= Final customer amount', moneyPaise(result.grandTotal), true],
  ]
  return (
    <Card className="vx-anim-up">
      <CardHead title="How the price is built" />
      <dl className="divide-y divide-rule px-5 py-2">
        {rows.map(([label, value, strong]) => (
          <div key={label} className="flex items-baseline justify-between gap-3 py-1.5">
            <dt className={cx('min-w-0 text-sm', strong ? 'font-semibold text-ink' : 'text-ink-2')}>{label}</dt>
            <dd className={cx('vx-code shrink-0 text-sm', strong ? 'font-semibold text-ink' : 'text-ink-2')}>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="border-t border-rule px-5 py-3 text-xs text-muted">
        Selling price per piece is rounded to the paisa; total selling is that rate × quantity so dispatch invoices reconcile exactly. <Link className="vx-focus rounded-xs text-accent-text hover:underline" to="/master/costing?tab=defaults">Costing defaults</Link>
      </p>
    </Card>
  )
}
