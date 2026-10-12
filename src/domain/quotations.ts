import type { CostingInputs, CostingResult, Plan, ProductSize, Quotation, QuotationStatus, QuotationTotals, VertexDB } from '../lib/types'
import { computeOrderCosting, fromPaise, toPaise } from '../lib/costing'
import { addDays, format } from 'date-fns'
import { audit, command, docCode, fail, hasFieldErrors, isIsoDate, nextSeq, ok, requireCapability, stampNew, stampUpdate, staleRecord, validationFailure } from './common'
import type { Op } from './common'
import { planCostingSource } from './orderCosting'
import { cleanSize } from './master'
import { savePlan } from './planning'

/* ---------------------------------------------------------------------------
 * Quotations — a price for a customer before anything is planned or made.
 * The price is worked out like an order costing (Master materials and process
 * rates, the order size, profit, GST) and may be rounded by hand. When the
 * customer agrees, a plan is made from it and its costing starts with the
 * same profit, rates and charges. Nothing reaches production from here.
 * ------------------------------------------------------------------------- */

export interface QuotationDraft {
  /** Empty for a new quotation. */
  id: string
  date: string
  validUntil: string
  customerId: string
  productId: string
  quantity: number
  size?: ProductSize | null
  inputs: CostingInputs
  pricePerPiece: number | null
  notes: string
  expectedUpdatedAt?: string
}

/** The costing behind a quotation — the same calculation an order costing uses. */
export function quoteCosting(db: VertexDB, q: Pick<QuotationDraft, 'productId' | 'quantity' | 'size' | 'inputs'>): CostingResult | null {
  const product = db.products.find((p) => p.id === q.productId)
  if (!product) return null
  return computeOrderCosting({
    quantity: q.quantity,
    product: planCostingSource(db, { size: q.size }, product),
    materials: db.materials,
    settings: db.settings,
    inputs: q.inputs,
  })
}

/** What the customer is told: from cost and profit, or from a price per piece typed by hand. */
export function quoteTotals(result: CostingResult, pricePerPiece: number | null, inputs: CostingInputs): QuotationTotals {
  const base = { costPerPiece: result.costPerPiece, totalCost: result.totalCost, taxLabel: result.taxLabel, taxPct: result.taxPct }
  if (pricePerPiece === null || !Number.isFinite(pricePerPiece) || pricePerPiece < 0)
    return { ...base, sellingPerPiece: result.sellingPerPiece, totalSelling: result.totalSelling, discountAmount: result.discountAmount, taxableValue: result.taxableValue, taxAmount: result.taxAmount, grandTotal: result.grandTotal }
  const q = result.quantity
  const totalSelling = fromPaise(Math.round(toPaise(pricePerPiece) * q))
  const discount = Number.isFinite(inputs.discountValue) && inputs.discountValue > 0 ? (inputs.discountType === 'percent' ? (totalSelling * Math.min(100, inputs.discountValue)) / 100 : Math.min(totalSelling, inputs.discountValue)) : 0
  const discountAmount = fromPaise(Math.round(toPaise(discount)))
  const taxableValue = fromPaise(toPaise(totalSelling) - toPaise(discountAmount))
  const taxAmount = fromPaise(Math.round((toPaise(taxableValue) * result.taxPct) / 100))
  return { ...base, sellingPerPiece: pricePerPiece, totalSelling, discountAmount, taxableValue, taxAmount, grandTotal: fromPaise(toPaise(taxableValue) + toPaise(taxAmount)) }
}

export function validateQuotation(db: VertexDB, d: QuotationDraft): Record<string, string> {
  const e: Record<string, string> = {}
  if (!db.customers.some((c) => c.id === d.customerId)) e.customerId = 'Choose a customer.'
  if (!db.products.some((p) => p.id === d.productId)) e.productId = 'Choose a product.'
  if (!(Number.isInteger(d.quantity) && d.quantity >= 1)) e.quantity = 'Enter a whole number of pieces (at least 1).'
  if (!isIsoDate(d.date)) e.date = 'Enter the quotation date.'
  if (!isIsoDate(d.validUntil)) e.validUntil = 'Enter how long the price holds.'
  else if (isIsoDate(d.date) && d.validUntil < d.date) e.validUntil = 'Valid until cannot be before the quotation date.'
  if (d.pricePerPiece !== null && !(Number.isFinite(d.pricePerPiece) && d.pricePerPiece >= 0)) e.pricePerPiece = 'Enter a price of 0 or more, or leave it blank.'
  return e
}

const label = (q: Pick<Quotation, 'code'>, db: VertexDB, customerId: string) => `${q.code} — ${db.customers.find((c) => c.id === customerId)?.company ?? ''}`

export const saveQuotation = command(
  'saveQuotation',
  (draft: QuotationDraft): Op<Quotation> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'costing')
    if (denied) return denied
    const list = db.quotations ?? []
    const existing = draft.id ? list.find((q) => q.id === draft.id) : undefined
    if (draft.id && !existing) return fail('Quotation not found.')
    const stale = existing ? staleRecord(existing.code, existing, draft.expectedUpdatedAt) : null
    if (stale) return stale
    if (existing?.planId) return fail(`${existing.code} was made into a plan — change the plan instead.`)
    const errors = validateQuotation(db, draft)
    if (hasFieldErrors(errors)) return validationFailure(errors)
    const result = quoteCosting(db, draft)!
    const wrong = result.issues.filter((i) => i.level === 'error' && !i.gap)
    if (wrong.length) return fail('Correct these values first.', { issues: wrong })
    const fields = {
      date: draft.date,
      validUntil: draft.validUntil,
      customerId: draft.customerId,
      productId: draft.productId,
      quantity: draft.quantity,
      size: cleanSize(draft.size ?? null),
      inputs: structuredClone(draft.inputs),
      pricePerPiece: draft.pricePerPiece,
      notes: draft.notes.trim(),
      totals: quoteTotals(result, draft.pricePerPiece, draft.inputs),
    }
    if (existing) {
      const updated = stampUpdate({ ...existing, ...fields }, ctx)
      const next = audit({ ...db, quotations: list.map((q) => (q.id === existing.id ? updated : q)) }, ctx, {
        action: 'Quotation updated',
        entity: 'Quotation',
        entityId: existing.id,
        entityLabel: label(existing, db, draft.customerId),
        field: 'Total',
        oldValue: existing.totals.grandTotal.toFixed(2),
        newValue: updated.totals.grandTotal.toFixed(2),
      })
      return ok(next, updated)
    }
    const [counted, seq] = nextSeq(db, 'quotation')
    const quotation: Quotation = { id: ctx.newId('QTN'), code: docCode('QTN', seq), ...fields, status: 'Draft', planId: null, ...stampNew(ctx) }
    const next = audit({ ...counted, quotations: [quotation, ...list] }, ctx, {
      action: 'Quotation created',
      entity: 'Quotation',
      entityId: quotation.id,
      entityLabel: label(quotation, db, draft.customerId),
      newValue: quotation.totals.grandTotal.toFixed(2),
    })
    return ok(next, quotation)
  },
)

export const setQuotationStatus = command(
  'setQuotationStatus',
  (id: string, status: QuotationStatus): Op<Quotation> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'costing')
    if (denied) return denied
    const q = (db.quotations ?? []).find((x) => x.id === id)
    if (!q) return fail('Quotation not found.')
    if (q.planId) return fail(`${q.code} was already made into a plan.`)
    if (status === 'Accepted') return fail('Use “Customer agreed — make a plan”.')
    const updated = stampUpdate({ ...q, status }, ctx)
    const next = audit({ ...db, quotations: (db.quotations ?? []).map((x) => (x.id === id ? updated : x)) }, ctx, {
      action: `Quotation marked ${status.toLowerCase()}`,
      entity: 'Quotation',
      entityId: id,
      entityLabel: label(q, db, q.customerId),
      oldValue: q.status,
      newValue: status,
    })
    return ok(next, updated)
  },
)

/**
 * The customer agreed: a draft plan with the same customer, product, quantity
 * and size. Units are allocated in Planning as usual; its costing starts with
 * this quotation's profit, rates and charges (and its round price, as a markup).
 */
export const quotationToPlan = command(
  'quotationToPlan',
  (id: string, deliveryDate?: string): Op<{ quotation: Quotation; plan: Plan }> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'planning')
    if (denied) return denied
    const q = (db.quotations ?? []).find((x) => x.id === id)
    if (!q) return fail('Quotation not found.')
    if (q.planId) return fail(`${q.code} was already made into a plan.`)
    const today = ctx.now.toISOString().slice(0, 10)
    const made = savePlan({
      customerId: q.customerId,
      productId: q.productId,
      quantity: q.quantity,
      orderDate: today,
      deliveryDate: deliveryDate && isIsoDate(deliveryDate) ? deliveryDate : format(addDays(new Date(`${today}T00:00:00`), 14), 'yyyy-MM-dd'),
      priority: 'Normal',
      customerRef: q.code,
      dimensions: '',
      size: q.size ?? null,
      options: '',
      instructions: q.notes,
      processUnits: {},
    })(db, ctx)
    if (!made.ok) return made
    const plan: Plan = { ...made.value, quotationId: q.id }
    const quotation = stampUpdate({ ...q, status: 'Accepted' as const, planId: plan.id }, ctx)
    let next: VertexDB = { ...made.db, plans: made.db.plans.map((p) => (p.id === plan.id ? plan : p)), quotations: (made.db.quotations ?? []).map((x) => (x.id === id ? quotation : x)) }
    next = audit(next, ctx, {
      action: 'Quotation accepted — plan made',
      entity: 'Quotation',
      entityId: q.id,
      entityLabel: label(q, db, q.customerId),
      newValue: plan.code,
    })
    return ok(next, { quotation, plan })
  },
)
