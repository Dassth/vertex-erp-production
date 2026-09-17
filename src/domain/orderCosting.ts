import type {
  CostingInputs,
  CostingResult,
  CostingSnapshot,
  OrderCosting,
  Product,
  ProductionOrder,
  VertexDB,
} from '../lib/types'
import { computeOrderCosting } from '../lib/costing'
import { buildJobStages } from '../lib/schedule'
import {
  audit,
  customerSnapshot,
  deepClone,
  docCode,
  fail,
  isFiniteNumber,
  nextSeq,
  notify,
  ok,
  requireCapability,
  staleRecord,
  stampNew,
  stampUpdate,
  command,
} from './common'
import type { Op } from './common'
import { planReadiness } from './planning'

/* ---------------------------------------------------------------------------
 * Costing lifecycle:  Draft ──finalize──▶ Finalized (+ production order)
 *
 * Finalizing is idempotent. It is guarded three ways — the costing status, the
 * plan status and a scan for an existing order on the plan — so a repeated
 * click, a second tab or a reload can never create a second production order.
 * ------------------------------------------------------------------------- */

export function defaultCostingInputs(db: VertexDB, product: Product | undefined, newId: (p: string) => string): CostingInputs {
  return {
    profitMethod: db.settings.profitMethod,
    profitPct: db.settings.profitPct,
    taxPct: product?.taxPct ?? db.settings.taxPct,
    charges: db.settings.orderCharges
      .filter((c) => c.active && c.applyByDefault)
      .map((c) => ({ id: newId('chg'), templateId: c.id, name: c.name, basis: c.basis, amount: c.amount })),
    discountType: 'amount',
    discountValue: 0,
  }
}

/** Live calculation against current Master data (used while the costing is a draft). */
export function previewCosting(db: VertexDB, costing: OrderCosting): CostingResult | null {
  if (costing.snapshot) return costing.snapshot.result
  const plan = db.plans.find((p) => p.id === costing.planId)
  const product = plan ? db.products.find((p) => p.id === plan.productId) : undefined
  if (!plan || !product) return null
  return computeOrderCosting({
    quantity: plan.quantity,
    product: { productId: product.id, stages: product.stages, materials: product.materials, spec: product.spec },
    materials: db.materials,
    settings: db.settings,
    inputs: costing.inputs,
  })
}

export const openCosting = command(
  'openCosting',
  (planId: string): Op<OrderCosting> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'costing')
    if (denied) return denied
    const plan = db.plans.find((p) => p.id === planId)
    if (!plan) return fail('Plan not found.')
    const existing = db.costings.find((c) => c.planId === planId)
    if (existing) return ok(db, existing)
    if (plan.status !== 'Ready for Costing')
      return fail(`${plan.code} is ${plan.status}. Send the plan to costing from Planning first.`)
    const product = db.products.find((p) => p.id === plan.productId)
    let next = db
    let seq: number
    ;[next, seq] = nextSeq(next, 'costing')
    const costing: OrderCosting = {
      id: ctx.newId('CST'),
      code: docCode('CST', seq),
      planId,
      inputs: defaultCostingInputs(db, product, ctx.newId),
      status: 'Draft',
      finalizedAt: null,
      finalizedBy: null,
      snapshot: null,
      orderId: null,
      ...stampNew(ctx),
    }
    next = {
      ...next,
      costings: [costing, ...next.costings],
      plans: next.plans.map((p) => (p.id === planId ? { ...p, costingId: costing.id } : p)),
    }
    next = audit(next, ctx, {
      action: 'Order costing opened',
      entity: 'Costing',
      entityId: costing.id,
      entityLabel: `${costing.code} — ${plan.code}`,
    })
    return ok(next, costing)
  },
)

export const saveCostingInputs = command(
  'saveCostingInputs',
  (costingId: string, inputs: CostingInputs, expectedUpdatedAt?: string): Op<OrderCosting> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'costing')
    if (denied) return denied
    const costing = db.costings.find((c) => c.id === costingId)
    if (!costing) return fail('Costing not found.')
    if (costing.status === 'Finalized') return fail(`${costing.code} is finalized and can no longer be changed.`)
    const stale = staleRecord(costing.code, costing, expectedUpdatedAt)
    if (stale) return stale
    if (!isFiniteNumber(inputs.profitPct) || !isFiniteNumber(inputs.taxPct) || !isFiniteNumber(inputs.discountValue))
      return fail('Enter valid numbers for profit, tax and discount.')
    const updated = stampUpdate({ ...costing, inputs: deepClone(inputs) }, ctx)
    const next = audit({ ...db, costings: db.costings.map((c) => (c.id === costingId ? updated : c)) }, ctx, {
      action: 'Costing inputs saved',
      entity: 'Costing',
      entityId: costingId,
      entityLabel: costing.code,
      field: 'Profit / tax',
      oldValue: `${costing.inputs.profitMethod} ${costing.inputs.profitPct}% · tax ${costing.inputs.taxPct}%`,
      newValue: `${inputs.profitMethod} ${inputs.profitPct}% · tax ${inputs.taxPct}%`,
    })
    return ok(next, updated)
  },
)

export interface FinalizeResult {
  costing: OrderCosting
  order: ProductionOrder
  created: boolean
}

export const finalizeCosting = command(
  'finalizeCosting',
  (costingId: string, inputs?: CostingInputs, expectedUpdatedAt?: string): Op<FinalizeResult> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'costing')
    if (denied) return denied
    const costing = db.costings.find((c) => c.id === costingId)
    if (!costing) return fail('Costing not found.')
    const plan = db.plans.find((p) => p.id === costing.planId)
    if (!plan) return fail('The plan for this costing no longer exists.')

    // Idempotency: already finalized, or an order already exists for this plan.
    const existingOrder =
      db.orders.find((o) => o.id === costing.orderId) ??
      db.orders.find((o) => o.id === plan.orderId) ??
      db.orders.find((o) => o.planId === plan.id)
    if (existingOrder) {
      const finalized = db.costings.find((c) => c.id === existingOrder.costingId) ?? costing
      return ok(db, { costing: finalized, order: existingOrder, created: false })
    }
    if (costing.status === 'Finalized') return fail(`${costing.code} is finalized but its production order is missing.`)
    // Inputs edited in this tab must not silently replace inputs another tab saved meanwhile.
    const stale = inputs ? staleRecord(costing.code, costing, expectedUpdatedAt) : null
    if (stale) return stale
    if (plan.status !== 'Ready for Costing') return fail(`${plan.code} is ${plan.status}; only plans ready for costing can be finalized.`)

    const readiness = planReadiness(db, plan)
    if (readiness.blocking.length) return fail('The plan is incomplete.', { issues: readiness.blocking })

    const product = db.products.find((p) => p.id === plan.productId)!
    const customer = db.customers.find((c) => c.id === plan.customerId)!
    const useInputs = deepClone(inputs ?? costing.inputs)
    const result = computeOrderCosting({
      quantity: plan.quantity,
      product: { productId: product.id, stages: product.stages, materials: product.materials, spec: product.spec },
      materials: db.materials,
      settings: db.settings,
      inputs: useInputs,
    })
    if (!result.valid)
      return fail('Resolve the costing errors before finalizing.', { issues: result.issues.filter((i) => i.level === 'error') })

    const usedChargeIds = new Set(product.stages.flatMap((s) => s.processes.map((p) => p.chargeId)).filter(Boolean))
    const snapshot: CostingSnapshot = deepClone({
      takenAt: ctx.now.toISOString(),
      takenBy: ctx.actor.name,
      customer: customerSnapshot(customer),
      product: {
        id: product.id,
        code: product.code,
        name: product.name,
        category: product.category,
        hsn: product.hsn,
        uom: product.uom,
        version: product.version,
        stages: product.stages,
        materials: product.materials.map((l) => ({ ...l, material: db.materials.find((m) => m.id === l.materialId)! })),
      },
      processCharges: db.settings.processCharges.filter((c) => usedChargeIds.has(c.id)),
      plan: {
        code: plan.code,
        quantity: plan.quantity,
        orderDate: plan.orderDate,
        deliveryDate: plan.deliveryDate,
        priority: plan.priority,
        customerRef: plan.customerRef,
        dimensions: plan.dimensions,
        options: plan.options,
        instructions: plan.instructions,
        processUnits: plan.processUnits,
        stageUnits: plan.stageUnits,
      },
      inputs: useInputs,
      result,
    })

    let next = db
    let seq: number
    ;[next, seq] = nextSeq(next, 'order')
    const order: ProductionOrder = {
      id: ctx.newId('ORD'),
      code: docCode('JOB', seq),
      planId: plan.id,
      costingId: costing.id,
      customerId: customer.id,
      productId: product.id,
      customer: snapshot.customer,
      productCode: product.code,
      productName: product.name,
      hsn: product.hsn,
      uom: product.uom,
      quantity: plan.quantity,
      orderDate: plan.orderDate,
      deliveryDate: plan.deliveryDate,
      priority: plan.priority,
      customerRef: plan.customerRef,
      dimensions: plan.dimensions,
      options: plan.options,
      instructions: plan.instructions,
      stages: buildJobStages({
        stages: snapshot.product.stages,
        processUnits: plan.processUnits,
        quantity: plan.quantity,
        orderDate: plan.orderDate,
        deliveryDate: plan.deliveryDate,
        priority: plan.priority,
        bufferHours: db.settings.bufferHours,
        now: ctx.now,
        newId: ctx.newId,
      }),
      status: 'Active',
      completedAt: null,
      completedQty: 0,
      createdAt: ctx.now.toISOString(),
      createdBy: ctx.actor.name,
    }
    const finalized: OrderCosting = stampUpdate(
      {
        ...costing,
        inputs: useInputs,
        status: 'Finalized',
        finalizedAt: ctx.now.toISOString(),
        finalizedBy: ctx.actor.name,
        snapshot,
        orderId: order.id,
      },
      ctx,
    )

    next = {
      ...next,
      costings: next.costings.map((c) => (c.id === costing.id ? finalized : c)),
      plans: next.plans.map((p) => (p.id === plan.id ? stampUpdate({ ...p, status: 'In Production' as const, orderId: order.id, costingId: costing.id }, ctx) : p)),
      orders: [order, ...next.orders],
    }
    next = audit(next, ctx, {
      action: 'Costing finalized',
      entity: 'Costing',
      entityId: costing.id,
      entityLabel: `${costing.code} — ${plan.code}`,
      field: 'Customer amount',
      newValue: `${result.grandTotal.toFixed(2)} (${result.sellingPerPiece.toFixed(2)} / ${product.uom})`,
    })
    next = audit(next, ctx, {
      action: 'Production order created',
      entity: 'Production Order',
      entityId: order.id,
      entityLabel: `${order.code} — ${customer.company}`,
      field: 'Stages scheduled',
      newValue: `${order.stages.length} stages · delivery ${order.deliveryDate}`,
    })
    next = notify(next, ctx, {
      key: `${order.id}:created`,
      title: `${order.code} released to production`,
      message: `${order.stages.length}-stage schedule generated for ${customer.company} — ${order.quantity.toLocaleString('en-IN')} ${order.uom} of ${product.name}.`,
      level: 'success',
      audience: 'admin',
      orderId: order.id,
    })
    for (const unitId of new Set(order.stages.map((s) => s.unitId))) {
      const mine = order.stages.filter((s) => s.unitId === unitId)
      next = notify(next, ctx, {
        key: `${order.id}:assigned:${unitId}`,
        title: `${order.code} — work assigned to ${unitId}`,
        message: `Stage${mine.length > 1 ? 's' : ''} ${mine.map((s) => `${s.index + 1}. ${s.name}`).join(', ')} assigned to your unit.`,
        level: 'info',
        audience: 'unit',
        unitId,
        orderId: order.id,
      })
    }
    return ok(next, { costing: finalized, order, created: true })
  },
)
