import type { CostingIssue, Plan, Priority, VertexDB } from '../lib/types'
import { computeOrderCosting } from '../lib/costing'
import {
  audit,
  docCode,
  fail,
  hasFieldErrors,
  isIsoDate,
  nextSeq,
  ok,
  requireCapability,
  staleRecord,
  stampNew,
  stampUpdate,
  validationFailure,
  command,
} from './common'
import type { Op } from './common'
import { defaultCostingInputs } from './orderCosting'

/* ---------------------------------------------------------------------------
 * Plan lifecycle
 *
 *   Draft ──submit──▶ Ready for Costing ──finalize costing──▶ In Production
 *     ▲                     │
 *     └───return to draft───┘
 *   Draft / Ready for Costing ──cancel──▶ Cancelled
 *
 * Plans reference Master definitions read-only. Stage and process structure
 * always comes from the product; the plan only adds a production unit to each
 * PROCESS. Execution resources (responsible person, machine) are allocated by
 * the unit afterwards and are deliberately NOT required to send to costing.
 * ------------------------------------------------------------------------- */

export interface PlanDraft {
  id?: string
  customerId: string
  productId: string
  quantity: number
  orderDate: string
  deliveryDate: string
  priority: Priority
  customerRef: string
  dimensions: string
  options: string
  instructions: string
  /** Production unit per product process id. */
  processUnits: Record<string, string>
  expectedUpdatedAt?: string
}

export function validatePlanDraft(db: VertexDB, d: PlanDraft, existing?: Plan): Record<string, string> {
  const e: Record<string, string> = {}
  const customer = db.customers.find((c) => c.id === d.customerId)
  if (!customer) e.customerId = 'Select a customer.'
  else if (!customer.active && existing?.customerId !== customer.id) e.customerId = 'This customer is deactivated in Master.'
  const product = db.products.find((p) => p.id === d.productId)
  if (!product) e.productId = 'Select a product.'
  else if (!product.active && existing?.productId !== product.id) e.productId = 'This product is deactivated in Master.'
  if (!(Number.isInteger(d.quantity) && d.quantity >= 1)) e.quantity = 'Enter a whole number of pieces (at least 1).'
  else if (d.quantity > 100_000_000) e.quantity = 'Quantity looks too large.'
  if (!isIsoDate(d.orderDate)) e.orderDate = 'Enter the order date.'
  if (!isIsoDate(d.deliveryDate)) e.deliveryDate = 'Enter the required delivery date.'
  else if (isIsoDate(d.orderDate) && d.deliveryDate < d.orderDate) e.deliveryDate = 'Delivery cannot be before the order date.'
  if (product) {
    for (const unitId of Object.values(d.processUnits)) {
      if (unitId && !db.units.some((u) => u.id === unitId)) e.processUnits = 'An allocated production unit no longer exists.'
    }
  }
  return e
}

export interface PlanReadiness {
  blocking: CostingIssue[]
  warnings: CostingIssue[]
}

/** Everything that must be true before a plan can move to costing, plus advisory master gaps. */
export function planReadiness(db: VertexDB, plan: Pick<Plan, 'customerId' | 'productId' | 'productVersion' | 'quantity' | 'processUnits'>): PlanReadiness {
  const blocking: CostingIssue[] = []
  const warnings: CostingIssue[] = []
  const product = db.products.find((p) => p.id === plan.productId)
  const customer = db.customers.find((c) => c.id === plan.customerId)

  if (!customer) blocking.push({ level: 'error', message: 'The customer no longer exists.', fix: { label: 'Open Master → Customers', to: '/master/customers' } })
  else {
    if (!customer.active) blocking.push({ level: 'error', message: `${customer.company} is deactivated.`, fix: { label: 'Open customer', to: `/master/customers?id=${customer.id}` } })
    if (!customer.billingAddress.trim())
      warnings.push({ level: 'warning', message: `${customer.company} has no billing address — invoices need one.`, fix: { label: 'Complete customer', to: `/master/customers?id=${customer.id}` } })
  }

  if (!product) {
    blocking.push({ level: 'error', message: 'The product no longer exists.', fix: { label: 'Open Master → Products', to: '/master/products' } })
    return { blocking, warnings }
  }
  const productFix = { label: 'Open product in Master', to: `/master/products/${product.id}` }
  if (!product.active) blocking.push({ level: 'error', message: `${product.name} is deactivated.`, fix: productFix })
  if (!product.stages.length) blocking.push({ level: 'error', message: `${product.name} has no stages defined.`, fix: productFix })
  if (plan.productVersion && plan.productVersion !== product.version)
    warnings.push({
      level: 'warning',
      message: `${product.name} was edited in Master after this plan was saved (v${plan.productVersion} → v${product.version}). Review the process allocations.`,
    })

  // Every process needs an active unit. Operator and machine are NOT required here.
  product.stages.forEach((s, i) => {
    if (!s.processes.length) blocking.push({ level: 'error', message: `Stage ${i + 1} “${s.name}” has no processes.`, fix: productFix })
    s.processes.forEach((process, pi) => {
      const where = `${s.name} (${s.id}) › ${pi + 1}. ${process.name}`
      const unitId = plan.processUnits[process.id]
      if (!unitId) blocking.push({ level: 'error', message: `Allocate a production unit to ${where}.` })
      else {
        const unit = db.units.find((u) => u.id === unitId)
        if (!unit) blocking.push({ level: 'error', message: `${where} is allocated to a unit that no longer exists.` })
      }
    })
  })

  if (Number.isInteger(plan.quantity) && plan.quantity > 0) {
    const preview = computeOrderCosting({
      quantity: plan.quantity,
      product: { productId: product.id, stages: product.stages, materials: product.materials, spec: product.spec },
      materials: db.materials,
      settings: db.settings,
      inputs: defaultCostingInputs(db, product, () => 'preview'),
    })
    const seen = new Set(blocking.map((b) => b.message))
    for (const issue of preview.issues) {
      if (seen.has(issue.message)) continue
      seen.add(issue.message)
      warnings.push({ ...issue, level: 'warning' })
    }
  }
  return { blocking, warnings }
}

/** Keep only allocations that still match a process of the chosen product. */
function cleanProcessUnits(db: VertexDB, productId: string, processUnits: Record<string, string>): Record<string, string> {
  const product = db.products.find((p) => p.id === productId)
  if (!product) return {}
  const out: Record<string, string> = {}
  for (const stage of product.stages)
    for (const process of stage.processes) if (processUnits[process.id]) out[process.id] = processUnits[process.id]
  return out
}

export const savePlan = command(
  'savePlan',
  (draft: PlanDraft): Op<Plan> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'planning')
    if (denied) return denied
    const existing = draft.id ? db.plans.find((p) => p.id === draft.id) : undefined
    if (draft.id && !existing) return fail('Plan not found.')
    const stale = existing ? staleRecord(existing.code, existing, draft.expectedUpdatedAt) : null
    if (stale) return stale
    if (existing && existing.status !== 'Draft')
      return fail(`${existing.code} is ${existing.status}. Return it to draft before editing.`)
    const errors = validatePlanDraft(db, draft, existing)
    if (hasFieldErrors(errors)) return validationFailure(errors)
    const product = db.products.find((p) => p.id === draft.productId)!
    const fields = {
      customerId: draft.customerId,
      productId: draft.productId,
      productVersion: product.version,
      quantity: draft.quantity,
      orderDate: draft.orderDate,
      deliveryDate: draft.deliveryDate,
      priority: draft.priority,
      customerRef: draft.customerRef.trim(),
      dimensions: draft.dimensions.trim(),
      options: draft.options.trim(),
      instructions: draft.instructions.trim(),
      processUnits: cleanProcessUnits(db, draft.productId, draft.processUnits),
    }
    if (!existing) {
      let next = db
      let seq: number
      ;[next, seq] = nextSeq(next, 'plan')
      const plan: Plan = {
        id: ctx.newId('PLN'),
        code: docCode('PLN', seq),
        ...fields,
        status: 'Draft',
        submittedAt: null,
        submittedBy: null,
        costingId: null,
        orderId: null,
        ...stampNew(ctx),
      }
      next = audit({ ...next, plans: [plan, ...next.plans] }, ctx, {
        action: 'Plan created',
        entity: 'Plan',
        entityId: plan.id,
        entityLabel: `${plan.code} — ${product.name}`,
        newValue: `${plan.quantity} ${product.uom} · delivery ${plan.deliveryDate}`,
      })
      return ok(next, plan)
    }
    const updated = stampUpdate({ ...existing, ...fields }, ctx)
    const next = audit({ ...db, plans: db.plans.map((p) => (p.id === existing.id ? updated : p)) }, ctx, {
      action: 'Plan updated',
      entity: 'Plan',
      entityId: existing.id,
      entityLabel: `${existing.code} — ${product.name}`,
      field: existing.quantity !== updated.quantity ? 'Quantity' : undefined,
      oldValue: existing.quantity !== updated.quantity ? String(existing.quantity) : undefined,
      newValue: existing.quantity !== updated.quantity ? String(updated.quantity) : undefined,
    })
    return ok(next, updated)
  },
)

export const submitPlan = command(
  'submitPlan',
  (planId: string): Op<Plan> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'planning')
    if (denied) return denied
    const plan = db.plans.find((p) => p.id === planId)
    if (!plan) return fail('Plan not found.')
    if (plan.status === 'Ready for Costing') return ok(db, plan)
    if (plan.status !== 'Draft') return fail(`${plan.code} is ${plan.status} and cannot be submitted.`)
    const errors = validatePlanDraft(db, { ...plan }, plan)
    if (hasFieldErrors(errors)) return validationFailure(errors)
    const readiness = planReadiness(db, plan)
    if (readiness.blocking.length)
      return fail('Complete the required plan details before sending it to costing.', { issues: readiness.blocking })
    const product = db.products.find((p) => p.id === plan.productId)!
    const updated: Plan = stampUpdate(
      {
        ...plan,
        productVersion: product.version,
        processUnits: cleanProcessUnits(db, plan.productId, plan.processUnits),
        status: 'Ready for Costing',
        submittedAt: ctx.now.toISOString(),
        submittedBy: ctx.actor.name,
      },
      ctx,
    )
    const next = audit({ ...db, plans: db.plans.map((p) => (p.id === planId ? updated : p)) }, ctx, {
      action: 'Plan sent to costing',
      entity: 'Plan',
      entityId: planId,
      entityLabel: `${plan.code} — ${product.name}`,
      field: 'Status',
      oldValue: plan.status,
      newValue: updated.status,
    })
    return ok(next, updated)
  },
)

export const returnPlanToDraft = command(
  'returnPlanToDraft',
  (planId: string): Op<Plan> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'planning')
    if (denied) return denied
    const plan = db.plans.find((p) => p.id === planId)
    if (!plan) return fail('Plan not found.')
    if (plan.status === 'Draft') return ok(db, plan)
    if (plan.status !== 'Ready for Costing') return fail(`${plan.code} is ${plan.status} and cannot return to draft.`)
    const costing = db.costings.find((c) => c.id === plan.costingId)
    if (costing?.status === 'Finalized') return fail('The costing for this plan is already finalized.')
    const updated = stampUpdate({ ...plan, status: 'Draft' as const }, ctx)
    return ok(
      audit({ ...db, plans: db.plans.map((p) => (p.id === planId ? updated : p)) }, ctx, {
        action: 'Plan returned to draft',
        entity: 'Plan',
        entityId: planId,
        entityLabel: plan.code,
        field: 'Status',
        oldValue: plan.status,
        newValue: 'Draft',
      }),
      updated,
    )
  },
)

export const cancelPlan = command(
  'cancelPlan',
  (planId: string, reason: string): Op<Plan> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'planning')
    if (denied) return denied
    const plan = db.plans.find((p) => p.id === planId)
    if (!plan) return fail('Plan not found.')
    if (plan.status === 'Cancelled') return ok(db, plan)
    if (plan.status === 'In Production') return fail('A plan already in production cannot be cancelled.')
    if (!reason.trim()) return validationFailure({ reason: 'Record why the plan is cancelled.' })
    const updated = stampUpdate({ ...plan, status: 'Cancelled' as const }, ctx)
    return ok(
      audit({ ...db, plans: db.plans.map((p) => (p.id === planId ? updated : p)) }, ctx, {
        action: 'Plan cancelled',
        entity: 'Plan',
        entityId: planId,
        entityLabel: plan.code,
        field: 'Status',
        oldValue: plan.status,
        newValue: 'Cancelled',
        reason: reason.trim(),
      }),
      updated,
    )
  },
)
