import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { addDays, format } from 'date-fns'
import { ArrowLeft, ArrowRight, CalendarRange, ClipboardList, Eye, Lock, Pin, Save, Undo2, XCircle } from 'lucide-react'
import { useStore } from '../../store/store'
import type { Plan, Priority } from '../../lib/types'
import type { PlanDraft } from '../../domain/planning'
import { cancelPlan, planReadiness, returnPlanToDraft, savePlan, setPlanPinned, submitPlan } from '../../domain/planning'
import { PRIORITIES, processHours, stageHours } from '../../lib/schedule'
import { cx, fmtDateTime, qty } from '../../lib/format'
import { Badge, Button, Card, CardHead, EmptyState, Field, Input, Modal, Select, Textarea } from '../../components/ui'
import { ConflictNotice, Detail, IssueList, LinkButton, NumberInput, PageHeader, focusFirstInvalid, useDocumentTitle, useUnsavedChanges } from '../../components/page'
import { PlanStatusBadge } from '../../components/status'
import { DocumentPreview, DownloadButton, jobCardDoc, useLatestDb } from '../../components/DocumentPreview'
import type { PreviewDoc } from '../../components/DocumentPreview'

export function PlanEditorPage() {
  const { planId } = useParams()
  const { db } = useStore()
  const plan = planId === 'new' ? undefined : db.plans.find((p) => p.id === planId)
  if (planId !== 'new' && !plan)
    return (
      <Card>
        <EmptyState icon={<CalendarRange className="h-6 w-6" />} title="Plan not found" message="Return to the plan list." action={<LinkButton to="/planning">Planning</LinkButton>} />
      </Card>
    )
  return <PlanEditor key={planId} plan={plan} />
}

const today = () => format(new Date(), 'yyyy-MM-dd')

function toDraft(p?: Plan): PlanDraft {
  if (!p)
    return {
      customerId: '',
      productId: '',
      quantity: NaN,
      orderDate: today(),
      deliveryDate: format(addDays(new Date(), 14), 'yyyy-MM-dd'),
      priority: 'Normal',
      customerRef: '',
      dimensions: '',
      options: '',
      instructions: '',
      processUnits: {},
    }
  return {
    id: p.id,
    customerId: p.customerId,
    productId: p.productId,
    quantity: p.quantity,
    orderDate: p.orderDate,
    deliveryDate: p.deliveryDate,
    priority: p.priority,
    customerRef: p.customerRef,
    dimensions: p.dimensions,
    options: p.options,
    instructions: p.instructions,
    processUnits: { ...p.processUnits },
    expectedUpdatedAt: p.updatedAt,
  }
}

function PlanEditor({ plan }: { plan?: Plan }) {
  useDocumentTitle(plan ? `Planning · ${plan.code}` : 'Planning · New plan')
  const { db, run, pushToast } = useStore()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<PlanDraft>(() => toDraft(plan))
  const [baseline, setBaseline] = useState(() => JSON.stringify(toDraft(plan)))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [bulkUnit, setBulkUnit] = useState('')
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [conflict, setConflict] = useState('')
  const saving = useRef(false)
  const readOnly = !!plan && plan.status !== 'Draft'
  const dirty = !readOnly && JSON.stringify(draft) !== baseline
  const guard = useUnsavedChanges(dirty)

  const customer = db.customers.find((c) => c.id === draft.customerId)
  const product = db.products.find((p) => p.id === draft.productId)
  const set = (patch: Partial<PlanDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const q = Number.isInteger(draft.quantity) && draft.quantity > 0 ? draft.quantity : 0

  const readiness = useMemo(
    () =>
      draft.customerId && draft.productId
        ? planReadiness(db, { customerId: draft.customerId, productId: draft.productId, productVersion: plan?.productVersion ?? product?.version ?? 0, quantity: q, processUnits: draft.processUnits })
        : null,
    [db, draft.customerId, draft.productId, draft.processUnits, q, plan?.productVersion, product?.version],
  )

  const persist = async (thenSubmit: boolean) => {
    if (saving.current) return
    saving.current = true
    try {
      await persistNow(thenSubmit)
    } finally {
      saving.current = false
    }
  }

  const loadLatest = () => {
    const latest = db.plans.find((p) => p.id === plan?.id)
    const next = toDraft(latest)
    setDraft(next)
    setBaseline(JSON.stringify(next))
    setConflict('')
    setErrors({})
  }

  const persistNow = async (thenSubmit: boolean) => {
    const r = await run(savePlan(draft))
    if (!r.ok) {
      if (r.conflict) setConflict(r.error)
      setErrors(r.fieldErrors ?? {})
      pushToast({ title: 'Plan not saved', message: r.error, level: 'danger' })
      focusFirstInvalid()
      return
    }
    setErrors({})
    const saved = toDraft(r.value)
    setDraft(saved)
    setBaseline(JSON.stringify(saved))
    if (thenSubmit) {
      const s = await run(submitPlan(r.value.id))
      guard.bypass()
      if (!s.ok) {
        pushToast({ title: 'Saved as draft — not sent to costing', message: 'Resolve the items listed under “Before costing”.', level: 'warn' })
        if (!plan) navigate(`/planning/${r.value.id}`, { replace: true })
        return
      }
      pushToast({ title: `${r.value.code} sent to costing`, message: 'Stage units confirmed. Review and finalize the costing next.', level: 'success' })
      navigate(`/costing/${r.value.id}`)
      return
    }
    pushToast({ title: 'Draft saved', message: r.value.code, level: 'success' })
    if (!plan) {
      guard.bypass()
      navigate(`/planning/${r.value.id}`, { replace: true })
    }
  }

  const customers = db.customers.filter((c) => c.active || c.id === draft.customerId)
  const products = db.products.filter((p) => p.active || p.id === draft.productId)
  const totalHours = product ? product.stages.reduce((s, st) => s + stageHours(st, q), 0) : 0
  const processCount = product ? product.stages.reduce((s, st) => s + st.processes.length, 0) : 0

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations · Planning"
        title={plan ? plan.code : 'New plan'}
        subtitle={plan ? `Created ${fmtDateTime(plan.createdAt)} by ${plan.createdBy}${plan.submittedAt ? ` · sent to costing ${fmtDateTime(plan.submittedAt)} by ${plan.submittedBy}` : ''}` : 'Select a customer and product, enter the order details, then allocate a production unit to every process.'}
        icon={<CalendarRange className="h-4 w-4" />}
        actions={
          <>
            {plan ? <PlanStatusBadge status={plan.status} /> : null}
            {plan ? <PlanHeaderActions plan={plan} /> : null}
            <LinkButton to="/planning" variant="secondary" icon={<ArrowLeft className="h-4 w-4" />}>
              Plans
            </LinkButton>
          </>
        }
      />

      {conflict && !readOnly ? <ConflictNotice message={conflict} onReload={loadLatest} /> : null}

      {readOnly ? (
        <div className="vx-anim-up flex flex-wrap items-center gap-3 rounded-md bg-accent-wash px-4 py-3 text-sm text-accent-text ring-1 ring-inset ring-accent-edge">
          <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            {plan!.status === 'Ready for Costing'
              ? 'This plan is with Costing. Return it to draft to change the details.'
              : plan!.status === 'In Production'
                ? 'Costing is finalized and the order is in production. The plan is locked.'
                : 'This plan was cancelled.'}
          </span>
          {plan!.status === 'Ready for Costing' ? (
            <>
              <Button size="sm" variant="secondary" icon={<Undo2 className="h-3.5 w-3.5" />} onClick={async () => {
                const r = await run(returnPlanToDraft(plan!.id))
                if (!r.ok) pushToast({ title: 'Cannot return to draft', message: r.error, level: 'danger' })
              }}>
                Return to draft
              </Button>
              <LinkButton to={`/costing/${plan!.id}`} size="sm" icon={<ArrowRight className="h-3.5 w-3.5" />}>
                Open costing
              </LinkButton>
            </>
          ) : plan!.status === 'In Production' && plan!.orderId ? (
            <LinkButton to={`/production?job=${plan!.orderId}`} size="sm" variant="secondary">
              View production order
            </LinkButton>
          ) : null}
        </div>
      ) : null}

      <form
        className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] xl:items-start"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          persist(false)
        }}
      >
        <div className="space-y-6">
          <Card className="vx-anim-up">
            <CardHead title="Order details" />
            <fieldset disabled={readOnly} className="grid gap-x-4 p-5 sm:grid-cols-2">
              <Field label="Customer" required error={errors.customerId} className="sm:col-span-2">
                <Select value={draft.customerId} onChange={(e) => set({ customerId: e.target.value })} aria-invalid={!!errors.customerId || undefined}>
                  <option value="">Select a customer…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company} ({c.code}){c.active ? '' : ' — inactive'}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Product" required error={errors.productId} className="sm:col-span-2">
                <Select
                  value={draft.productId}
                  onChange={(e) => set({ productId: e.target.value, processUnits: {} })}
                  aria-invalid={!!errors.productId || undefined}
                >
                  <option value="">Select a product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code}) · {p.stages.length} stages{p.active ? '' : ' — inactive'}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={`Quantity (${product?.uom ?? 'pcs'})`} required error={errors.quantity}>
                <NumberInput value={draft.quantity} onChange={(v) => set({ quantity: v ?? NaN })} invalid={!!errors.quantity} />
              </Field>
              <Field label="Priority">
                <Select value={draft.priority} onChange={(e) => set({ priority: e.target.value as Priority })}>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Order date" required error={errors.orderDate}>
                <Input type="date" value={draft.orderDate} onChange={(e) => set({ orderDate: e.target.value })} aria-invalid={!!errors.orderDate || undefined} />
              </Field>
              <Field label="Required delivery date" required error={errors.deliveryDate}>
                <Input type="date" min={draft.orderDate} value={draft.deliveryDate} onChange={(e) => set({ deliveryDate: e.target.value })} aria-invalid={!!errors.deliveryDate || undefined} />
              </Field>
              <Field label="Customer PO / reference">
                <Input value={draft.customerRef} onChange={(e) => set({ customerRef: e.target.value })} />
              </Field>
              <Field label="Dimensions">
                <Input value={draft.dimensions} onChange={(e) => set({ dimensions: e.target.value })} placeholder="e.g. 200 × 150 × 60 mm…" />
              </Field>
              <Field label="Options" className="sm:col-span-2">
                <Input value={draft.options} onChange={(e) => set({ options: e.target.value })} placeholder="e.g. Matt lamination, gold foil logo…" />
              </Field>
              <Field label="Instructions for production" className="sm:col-span-2">
                <Textarea rows={3} value={draft.instructions} onChange={(e) => set({ instructions: e.target.value })} />
              </Field>
            </fieldset>
          </Card>

          {customer ? (
            <Card className="vx-anim-up">
              <CardHead
                title="Customer details"
                subtitle="From Master — read-only here"
                actions={
                  <Link to={`/master/customers?id=${customer.id}`} className="vx-focus rounded-xs text-sm font-medium text-accent-text hover:underline">
                    Edit in Master
                  </Link>
                }
              />
              <dl className="grid gap-4 p-5 sm:grid-cols-2">
                <Detail label="Billing address">{customer.billingAddress || <span className="text-risk">Missing</span>}</Detail>
                <Detail label="Delivery address">{customer.deliveryAddress || customer.billingAddress || '—'}</Detail>
                <Detail label="GSTIN">{customer.gstin || '—'}</Detail>
                <Detail label="Payment terms">{customer.paymentTerms || '—'}</Detail>
              </dl>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card className="vx-anim-up">
            <CardHead
              title="Processes & production units"
              subtitle={product ? `${product.stages.length} stage(s) · ${processCount} process(es) from ${product.code} v${product.version} · about ${qty(totalHours, 1)} working hours` : 'Select a product to load its stages'}
              actions={
                product ? (
                  <Link to={`/master/products/${product.id}`} className="vx-focus inline-flex items-center gap-1 rounded-xs text-sm font-medium text-accent-text hover:underline">
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    Definition in Master
                  </Link>
                ) : null
              }
            />
            {!product ? (
              <EmptyState icon={<CalendarRange className="h-6 w-6" />} title="No product selected" message="The stages, processes and materials appear here once a product is selected." />
            ) : (
              <div className="p-5">
                <p className="mb-4 text-sm text-muted">
                  Stage and process names, their order and their materials come from Master and cannot be changed here. Allocate a unit to
                  <strong className="text-ink"> every process</strong> — processes in the same stage may run in different units. The responsible
                  person and machine are chosen later by each unit and are not required to send this plan to costing.
                  Processes run one after another in the order shown, across all stages: allocating them to different units records who does
                  the work, it does not make them run at the same time.
                </p>
                {!readOnly && processCount > 1 ? (
                  <div className="mb-4 flex flex-wrap items-end gap-2 rounded-md bg-surface-2 p-3">
                    <Field label="Allocate every process to" className="w-56">
                      <Select value={bulkUnit} onChange={(e) => setBulkUnit(e.target.value)}>
                        <option value="">Select a unit…</option>
                        {db.units.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="mb-5"
                      disabled={!bulkUnit}
                      onClick={() => set({ processUnits: Object.fromEntries(product.stages.flatMap((st) => st.processes.map((pr) => [pr.id, bulkUnit]))) })}
                    >
                      Apply to all
                    </Button>
                  </div>
                ) : null}
                <ol className="space-y-4">
                  {product.stages.map((stage, i) => {
                    const mats = product.materials.filter((l) => l.stageId === stage.id)
                    const unitsUsed = [...new Set(stage.processes.map((pr) => draft.processUnits[pr.id]).filter(Boolean))]
                    return (
                      <li key={stage.id} className="overflow-hidden rounded-md border border-rule-2">
                        <div className="flex flex-wrap items-center gap-2 border-b border-rule bg-surface-2 px-4 py-2.5">
                          <span className="vx-code flex h-7 w-7 shrink-0 items-center justify-center rounded-xs bg-surface-3 text-sm font-medium text-ink-2" aria-hidden="true">
                            {i + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-ink">{stage.name}</p>
                            <p className="vx-code truncate text-2xs text-faint" translate="no">
                              Stage ID {stage.id}
                            </p>
                          </div>
                          <Badge tone={unitsUsed.length > 1 ? "violet" : "slate"}>
                            {unitsUsed.length > 1 ? `${unitsUsed.length} units` : `${stage.processes.length} process(es)`}
                          </Badge>
                        </div>
                        <table className="w-full">
                          <thead>
                            <tr>
                              <th className="vx-th">Process</th>
                              <th className="vx-th w-24">Hours</th>
                              <th className="vx-th w-56">Assigned unit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stage.processes.map((process, pi) => {
                              const unitId = draft.processUnits[process.id] ?? ""
                              return (
                                <tr key={process.id} className={cx('vx-row', !unitId && 'bg-warn-wash/40')}>
                                  <td className="vx-td">
                                    <span className="block text-base font-medium text-ink">
                                      {i + 1}.{pi + 1} {process.name}
                                    </span>
                                    <span className="vx-code block text-2xs text-faint" translate="no">
                                      {stage.id} › {process.id}
                                    </span>
                                  </td>
                                  <td className="vx-td tabular-nums text-muted">{qty(processHours(process, q), 1)} h</td>
                                  <td className="vx-td">
                                    <label>
                                      <span className="sr-only">
                                        Unit for {stage.name} {process.name}
                                      </span>
                                      <Select
                                        value={unitId}
                                        disabled={readOnly}
                                        aria-invalid={!unitId && Object.keys(errors).length > 0 ? true : undefined}
                                        onChange={(e) => set({ processUnits: { ...draft.processUnits, [process.id]: e.target.value } })}
                                      >
                                        <option value="">Select unit…</option>
                                        {db.units.map((u) => (
                                          <option key={u.id} value={u.id}>
                                            {u.name}
                                          </option>
                                        ))}
                                      </Select>
                                    </label>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                        {mats.length ? (
                          <p className="border-t border-rule px-4 py-2 text-xs text-muted">
                            Materials: {mats.map((l) => db.materials.find((m) => m.id === l.materialId)?.name ?? '—').join(', ')}
                          </p>
                        ) : null}
                      </li>
                    )
                  })}
                </ol>
                {product.materials.some((l) => !l.stageId) ? (
                  <p className="mt-3 text-xs text-muted">
                    Whole-product materials: {product.materials.filter((l) => !l.stageId).map((l) => db.materials.find((m) => m.id === l.materialId)?.name ?? '—').join(', ')}
                  </p>
                ) : null}
              </div>
            )}
          </Card>

          {readiness && !readOnly ? (
            <Card className="vx-anim-up p-5">
              <p className="vx-smallcaps text-ink">Before costing</p>
              <div className="mt-3">
                {readiness.blocking.length || readiness.warnings.length ? (
                  <IssueList issues={[...readiness.blocking, ...readiness.warnings]} title={`${readiness.blocking.length} required item(s) before sending to costing`} />
                ) : (
                  <p className="rounded-md bg-ok-wash px-3 py-2.5 text-sm text-ok ring-1 ring-inset ring-ok-edge">Every process has a unit and Master data is complete.</p>
                )}
                {readiness.warnings.length && !readiness.blocking.length ? (
                  <p className="mt-2 text-xs text-muted">Warnings do not stop the plan moving to costing, but costing cannot be finalized until prices and settings are complete.</p>
                ) : null}
              </div>
            </Card>
          ) : null}

          {!readOnly ? (
            <div className="vx-anim-up flex flex-wrap items-center gap-2">
              <Button type="submit" variant="secondary" icon={<Save className="h-4 w-4" />}>
                Save draft
              </Button>
              <Button type="button" icon={<ArrowRight className="h-4 w-4" />} onClick={() => persist(true)}>
                Save & send to costing
              </Button>
              <span className="text-xs text-muted" aria-live="polite">
                {dirty ? 'Unsaved changes' : plan ? 'Saved' : ''}
              </span>
              {plan ? (
                <Button type="button" variant="ghost" className="ml-auto text-risk hover:bg-risk-wash" icon={<XCircle className="h-4 w-4" />} onClick={() => setCancelOpen(true)}>
                  Cancel plan…
                </Button>
              ) : null}
            </div>
          ) : plan?.status === 'Ready for Costing' ? (
            <div className="flex">
              <Button type="button" variant="ghost" className="ml-auto text-risk hover:bg-risk-wash" icon={<XCircle className="h-4 w-4" />} onClick={() => setCancelOpen(true)}>
                Cancel plan…
              </Button>
            </div>
          ) : null}
        </div>
      </form>

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={`Cancel ${plan?.code ?? 'plan'}?`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>
              Keep plan
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (!plan) return
                const r = await run(cancelPlan(plan.id, cancelReason))
                if (!r.ok) return setErrors({ reason: r.fieldErrors?.reason ?? r.error })
                setCancelOpen(false)
                guard.bypass()
                pushToast({ title: `${plan.code} cancelled`, level: 'info' })
                navigate('/planning')
              }}
            >
              Cancel plan
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">The plan is kept for reference and cannot be sent to costing again.</p>
        <Field label="Reason" required error={errors.reason} className="mt-3">
          <Textarea rows={2} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} aria-invalid={!!errors.reason || undefined} />
        </Field>
      </Modal>
      {!readOnly && plan && product && plan.productVersion !== product.version ? (
        <p className="text-xs text-warn">
          <Badge tone="amber">Product changed</Badge> The product was edited after this plan was saved; saving updates the plan to version {product.version}.
        </p>
      ) : null}
      {guard.dialog}
    </div>
  )
}

/** Pin and job card for a saved plan — available in every status. */
function PlanHeaderActions({ plan }: { plan: Plan }) {
  const { run, pushToast } = useStore()
  const read = useLatestDb()
  const [preview, setPreview] = useState<PreviewDoc | null>(null)
  const togglePin = async () => {
    const r = await run(setPlanPinned(plan.id, !plan.pinned))
    if (!r.ok) pushToast({ title: 'Could not change the pin', message: r.error, level: 'danger' })
  }
  return (
    <>
      <Button variant="secondary" icon={<Pin className={plan.pinned ? 'h-4 w-4 fill-current' : 'h-4 w-4'} />} onClick={togglePin}>
        {plan.pinned ? 'Unpin' : 'Pin'}
      </Button>
      <Button variant="ghost" icon={<Eye className="h-4 w-4" />} onClick={() => setPreview(jobCardDoc(read, plan.id))}>
        Preview
      </Button>
      <DownloadButton variant="secondary" icon={<ClipboardList className="h-4 w-4" />} doc={() => jobCardDoc(read, plan.id)}>
        Job card
      </DownloadButton>
      <DocumentPreview doc={preview} onClose={() => setPreview(null)} />
    </>
  )
}
