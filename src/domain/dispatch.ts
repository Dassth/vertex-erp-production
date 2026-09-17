import type { CompanyProfile, Dispatch, Invoice, OrderCosting, ProductionOrder, VertexDB } from '../lib/types'
import {
  ALLOCATION_NOTE,
  BillingError,
  allocateInvoice,
  invoiceNumber,
  isValidGstin,
  orderBalance,
  splitTax,
} from '../lib/billing'
import type { InvoiceAmounts } from '../lib/billing'
import { audit, docCode, fail, isIsoDate, nextSeq, notify, ok, requireCapability, command } from './common'
import type { Op } from './common'

/* ---------------------------------------------------------------------------
 * Dispatch confirmation is one atomic operation:
 *   save dispatch → update balances → generate invoice → expose in Billing.
 *
 * Rules
 *   • only a Completed production order can be dispatched;
 *   • quantity is a whole number, ≥ 1 and ≤ remaining completed quantity;
 *   • dispatch dates cannot precede production completion or the previous dispatch;
 *   • company identity must be complete enough for a tax invoice.
 * Idempotency: every confirmation carries a client-generated requestId. A
 * repeated confirmation with the same id returns the stored dispatch and
 * invoice unchanged, so double clicks and retries never bill twice.
 * ------------------------------------------------------------------------- */

export interface DispatchRequest {
  requestId: string
  orderId: string
  date: string
  quantity: number
  deliveryAddress: string
  transporter: string
  vehicleNo: string
  notes: string
}

export function companyInvoiceIssues(company: CompanyProfile, taxPct: number): string[] {
  const out: string[] = []
  if (!company.name.trim()) out.push('Company name is missing.')
  if (!company.address.trim()) out.push('Company address is missing.')
  if (company.gstin.trim() && !isValidGstin(company.gstin)) out.push('Company GSTIN is not a valid 15-character GSTIN.')
  if (taxPct > 0 && !company.gstin.trim()) out.push('Company GSTIN is required to issue a tax invoice.')
  return out
}

export function finalizedCostingFor(db: VertexDB, order: ProductionOrder): OrderCosting | null {
  const costing = db.costings.find((c) => c.id === order.costingId)
  return costing?.status === 'Finalized' && costing.snapshot ? costing : null
}

export function orderInvoices(db: VertexDB, orderId: string): Invoice[] {
  return db.invoices.filter((i) => i.orderId === orderId).sort((a, b) => a.partial.seq - b.partial.seq)
}

export function validateDispatchRequest(
  db: VertexDB,
  req: DispatchRequest,
): { fieldErrors: Record<string, string>; amounts: InvoiceAmounts | null; error: string | null } {
  const e: Record<string, string> = {}
  const order = db.orders.find((o) => o.id === req.orderId)
  if (!order) return { fieldErrors: e, amounts: null, error: 'Production order not found.' }
  if (order.status !== 'Completed')
    return { fieldErrors: e, amounts: null, error: `${order.code} is still in production; only completed production can be dispatched.` }
  const costing = finalizedCostingFor(db, order)
  if (!costing) return { fieldErrors: e, amounts: null, error: 'The finalized costing snapshot for this order is missing.' }

  const balance = orderBalance(order, db.dispatches)
  if (!(Number.isInteger(req.quantity) && req.quantity >= 1)) e.quantity = 'Enter a whole number of pieces (at least 1).'
  else if (req.quantity > balance.remainingQty)
    e.quantity = balance.remainingQty === 0 ? 'Nothing remains to dispatch on this order.' : `Only ${balance.remainingQty.toLocaleString('en-IN')} ${order.uom} remain available.`

  const previous = db.dispatches.filter((d) => d.orderId === order.id).sort((a, b) => a.seq - b.seq)
  if (!isIsoDate(req.date)) e.date = 'Enter the dispatch date.'
  else {
    const completedDay = order.completedAt?.slice(0, 10)
    if (completedDay && req.date < completedDay) e.date = `Dispatch cannot be dated before production completed (${completedDay}).`
    const last = previous[previous.length - 1]
    if (last && req.date < last.date) e.date = `Dispatch cannot be dated before the previous dispatch (${last.date}).`
  }
  if (!req.deliveryAddress.trim()) e.deliveryAddress = 'Enter the delivery destination.'

  let amounts: InvoiceAmounts | null = null
  if (!e.quantity) {
    try {
      amounts = allocateInvoice(costing.snapshot!.result, orderInvoices(db, order.id), req.quantity)
    } catch (err) {
      if (err instanceof BillingError) e.quantity = err.message
      else throw err
    }
  }
  return { fieldErrors: e, amounts, error: null }
}

export interface ConfirmDispatchResult {
  dispatch: Dispatch
  invoice: Invoice
  duplicate: boolean
}

export const confirmDispatch = command(
  'confirmDispatch',
  (req: DispatchRequest): Op<ConfirmDispatchResult> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'dispatch')
    if (denied) return denied
    if (!req.requestId) return fail('Missing request id.')

    const replay = db.dispatches.find((d) => d.requestId === req.requestId)
    if (replay) {
      const invoice = db.invoices.find((i) => i.id === replay.invoiceId)
      if (invoice) return ok(db, { dispatch: replay, invoice, duplicate: true })
    }

    const { fieldErrors, amounts, error } = validateDispatchRequest(db, req)
    if (error) return fail(error)
    if (Object.keys(fieldErrors).length || !amounts)
      return fail(Object.values(fieldErrors)[0] ?? 'Check the dispatch details.', { fieldErrors })

    const order = db.orders.find((o) => o.id === req.orderId)!
    const costing = finalizedCostingFor(db, order)!
    const snapshot = costing.snapshot!
    const plan = db.plans.find((p) => p.id === order.planId)
    const companyProblems = companyInvoiceIssues(db.company, snapshot.result.taxPct)
    if (companyProblems.length)
      return fail(`Complete the company profile before invoicing: ${companyProblems.join(' ')}`)

    const previousDispatches = db.dispatches.filter((d) => d.orderId === order.id)
    let next = db
    let dispatchSeq: number
    let invoiceSeq: number
    ;[next, dispatchSeq] = nextSeq(next, 'dispatch')
    ;[next, invoiceSeq] = nextSeq(next, 'invoice')

    const dispatchId = ctx.newId('DSP')
    const invoiceId = ctx.newId('INV')
    const seq = previousDispatches.length + 1
    const { updatedAt: _u, updatedBy: _b, ...company } = db.company
    void _u
    void _b

    const dispatch: Dispatch = {
      id: dispatchId,
      code: docCode('DSP', dispatchSeq),
      orderId: order.id,
      seq,
      date: req.date,
      quantity: req.quantity,
      deliveryAddress: req.deliveryAddress.trim(),
      transporter: req.transporter.trim(),
      vehicleNo: req.vehicleNo.trim(),
      notes: req.notes.trim(),
      invoiceId,
      requestId: req.requestId,
      createdAt: ctx.now.toISOString(),
      createdBy: ctx.actor.name,
    }

    const tax = splitTax(amounts.taxAmount, company.gstin, snapshot.customer.gstin, snapshot.customer.placeOfSupply)
    const descriptionParts = [order.productName, order.dimensions, order.options].filter((s) => s && s.trim())
    const invoice: Invoice = {
      id: invoiceId,
      number: invoiceNumber(company.invoicePrefix, req.date, invoiceSeq),
      issueDate: req.date,
      orderId: order.id,
      dispatchId,
      requestId: req.requestId,
      company,
      customer: snapshot.customer,
      deliveryAddress: dispatch.deliveryAddress,
      refs: {
        orderCode: order.code,
        planCode: plan?.code ?? snapshot.plan.code,
        costingCode: costing.code,
        dispatchCode: dispatch.code,
        customerRef: order.customerRef,
      },
      productName: order.productName,
      lines: [
        {
          description: descriptionParts.join(' — '),
          hsn: order.hsn,
          quantity: amounts.quantity,
          uom: order.uom,
          rate: amounts.rate,
          amount: amounts.subtotal,
        },
      ],
      subtotal: amounts.subtotal,
      discount: amounts.discount,
      taxableValue: amounts.taxableValue,
      taxLabel: snapshot.result.taxLabel,
      taxPct: amounts.taxPct,
      taxAmount: amounts.taxAmount,
      ...tax,
      total: amounts.total,
      partial: {
        seq,
        orderedQty: order.quantity,
        previouslyDispatched: amounts.previouslyDispatched,
        thisQty: amounts.quantity,
        remainingAfter: amounts.remainingAfter,
        isFinal: amounts.isFinal,
        isSingleFull: amounts.isSingleFull,
      },
      paymentTerms: snapshot.customer.paymentTerms,
      transporter: dispatch.transporter,
      vehicleNo: dispatch.vehicleNo,
      notes: dispatch.notes,
      allocationNote: ALLOCATION_NOTE,
      createdAt: ctx.now.toISOString(),
      createdBy: ctx.actor.name,
    }

    next = { ...next, dispatches: [...next.dispatches, dispatch], invoices: [...next.invoices, invoice] }
    next = audit(next, ctx, {
      action: amounts.isSingleFull ? 'Full order dispatched' : 'Dispatch confirmed',
      entity: 'Dispatch',
      entityId: dispatch.id,
      entityLabel: `${dispatch.code} — ${order.code}`,
      field: 'Quantity',
      newValue: `${dispatch.quantity} ${order.uom} (dispatch ${seq}, ${amounts.remainingAfter} remaining)`,
    })
    next = audit(next, ctx, {
      action: 'Invoice generated',
      entity: 'Invoice',
      entityId: invoice.id,
      entityLabel: `${invoice.number} — ${snapshot.customer.company}`,
      field: 'Invoice total',
      newValue: invoice.total.toFixed(2),
    })
    next = notify(next, ctx, {
      key: `${order.id}:dispatch:${dispatch.id}`,
      title: `${invoice.number} issued`,
      message: `${dispatch.quantity.toLocaleString('en-IN')} ${order.uom} dispatched on ${dispatch.date} for ${snapshot.customer.company}. ${amounts.remainingAfter.toLocaleString('en-IN')} remaining.`,
      level: 'success',
      audience: 'admin',
      orderId: order.id,
    })
    return ok(next, { dispatch, invoice, duplicate: false })
  },
)

/**
 * Record that the customer received one shipment. Each partial shipment is
 * confirmed on its own; quantities, balances and the issued invoice are not
 * touched. A shipment can be confirmed once only.
 */
export const confirmDispatchReceived = command(
  'confirmDispatchReceived',
  (dispatchId: string): Op<Dispatch> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'dispatch')
    if (denied) return denied
    const dispatch = db.dispatches.find((d) => d.id === dispatchId)
    if (!dispatch) return fail('Shipment not found.')
    if (dispatch.receivedAt)
      return fail(`${dispatch.code} was already confirmed received by ${dispatch.receivedBy ?? 'another user'}.`)
    const order = db.orders.find((o) => o.id === dispatch.orderId)
    const received: Dispatch = { ...dispatch, receivedAt: ctx.now.toISOString(), receivedBy: ctx.actor.name }
    let next: VertexDB = { ...db, dispatches: db.dispatches.map((d) => (d.id === dispatchId ? received : d)) }
    next = audit(next, ctx, {
      action: 'Delivery confirmed received',
      entity: 'Dispatch',
      entityId: dispatch.id,
      entityLabel: `${dispatch.code} — ${order?.code ?? dispatch.orderId}`,
      field: 'Received quantity',
      newValue: `${dispatch.quantity} ${order?.uom ?? 'pcs'} — invoice download enabled`,
    })
    return ok(next, received)
  },
)
