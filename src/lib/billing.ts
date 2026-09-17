/* ---------------------------------------------------------------------------
 * Dispatch balances and invoice allocation.
 *
 * ALLOCATION & ROUNDING RULE (applies to every dispatch invoice)
 *   All money is handled in integer paise.
 *   • Rate          — the finalized selling price per piece from the costing
 *                     snapshot. Setup, process and additional order charges are
 *                     already absorbed into this rate at costing time, so fixed
 *                     charges are allocated to dispatches in proportion to the
 *                     quantity dispatched.
 *   • Line amount   — rate × dispatched quantity (exact; the rate is in paise).
 *   • Discount      — order discount × (dispatched qty ÷ ordered qty), rounded
 *                     half-up to the paisa.
 *   • Tax           — (line amount − discount) × tax %, rounded half-up.
 *   • Final dispatch (the one that brings the dispatched quantity up to the
 *     ordered quantity) does not use the proportional formulas: it receives the
 *     order totals MINUS everything already invoiced. The invoices of an order
 *     therefore always add up exactly to the finalized costing totals.
 *   • A full order dispatched in one go is simply a final dispatch with no
 *     previous invoices, so it equals the costing totals exactly.
 *
 * A consolidated order document only SUMMARISES issued invoices — it is not a
 * tax invoice and never creates a second charge for the same quantity.
 * ------------------------------------------------------------------------- */

import type { CostingResult, Dispatch, Invoice, ProductionOrder } from './types'
import { fromPaise, toPaise } from './costing'

export interface OrderBalance {
  orderedQty: number
  completedQty: number
  dispatchedQty: number
  remainingQty: number
}

export function orderBalance(order: ProductionOrder, dispatches: Dispatch[]): OrderBalance {
  const dispatchedQty = dispatches.filter((d) => d.orderId === order.id).reduce((s, d) => s + d.quantity, 0)
  const completedQty = order.status === 'Completed' ? order.completedQty : 0
  return {
    orderedQty: order.quantity,
    completedQty,
    dispatchedQty,
    remainingQty: Math.max(0, completedQty - dispatchedQty),
  }
}

export type BillingTotals = Pick<
  CostingResult,
  'quantity' | 'sellingPerPiece' | 'totalSelling' | 'discountAmount' | 'taxPct' | 'taxAmount'
>

export type PreviousInvoice = Pick<Invoice, 'subtotal' | 'discount' | 'taxAmount'> & {
  partial: Pick<Invoice['partial'], 'thisQty'>
}

export interface InvoiceAmounts {
  quantity: number
  rate: number
  subtotal: number
  discount: number
  taxableValue: number
  taxPct: number
  taxAmount: number
  total: number
  previouslyDispatched: number
  remainingAfter: number
  isFinal: boolean
  isSingleFull: boolean
}

export class BillingError extends Error {}

export function allocateInvoice(
  totals: BillingTotals,
  previous: PreviousInvoice[],
  thisQty: number,
): InvoiceAmounts {
  const ordered = totals.quantity
  const previouslyDispatched = previous.reduce((s, p) => s + p.partial.thisQty, 0)
  if (!Number.isInteger(thisQty) || thisQty < 1) throw new BillingError('Dispatch quantity must be a whole number of at least 1.')
  if (previouslyDispatched + thisQty > ordered)
    throw new BillingError(
      `Only ${ordered - previouslyDispatched} pieces remain to be billed on this order; ${thisQty} were requested.`,
    )

  const ratePaise = toPaise(totals.sellingPerPiece)
  const isFinal = previouslyDispatched + thisQty === ordered
  let subtotal: number
  let discount: number
  let tax: number

  if (isFinal) {
    subtotal = toPaise(totals.totalSelling) - previous.reduce((s, p) => s + toPaise(p.subtotal), 0)
    discount = toPaise(totals.discountAmount) - previous.reduce((s, p) => s + toPaise(p.discount), 0)
    const taxable = subtotal - discount
    tax = toPaise(totals.taxAmount) - previous.reduce((s, p) => s + toPaise(p.taxAmount), 0)
    if (subtotal < 0 || discount < 0 || taxable < 0 || tax < 0)
      throw new BillingError('Previous invoices already exceed the order totals; the final invoice cannot be reconciled.')
  } else {
    subtotal = ratePaise * thisQty
    discount = Math.round((toPaise(totals.discountAmount) * thisQty) / ordered)
    tax = Math.round(((subtotal - discount) * totals.taxPct) / 100)
  }

  const taxable = subtotal - discount
  return {
    quantity: thisQty,
    rate: fromPaise(ratePaise),
    subtotal: fromPaise(subtotal),
    discount: fromPaise(discount),
    taxableValue: fromPaise(taxable),
    taxPct: totals.taxPct,
    taxAmount: fromPaise(tax),
    total: fromPaise(taxable + tax),
    previouslyDispatched,
    remainingAfter: ordered - previouslyDispatched - thisQty,
    isFinal,
    isSingleFull: isFinal && previous.length === 0,
  }
}

export const ALLOCATION_NOTE =
  'Rate is the finalized selling price per piece. Discount is allocated by quantity and tax is calculated on this invoice’s taxable value; the final dispatch invoice absorbs rounding so all invoices total the order value exactly.'

/* ------------------------------- Tax split -------------------------------- */

const GSTIN_RE = /^[0-9]{2}[A-Z0-9]{13}$/

export function gstinState(gstin: string): string | null {
  const v = gstin.trim().toUpperCase()
  return GSTIN_RE.test(v) ? v.slice(0, 2) : null
}

export function isValidGstin(gstin: string): boolean {
  return gstinState(gstin) !== null
}

/**
 * Same state for seller and buyer → CGST + SGST (half each, odd paisa to SGST).
 * Different states → IGST. Unknown → a single tax line.
 */
export function splitTax(
  taxAmount: number,
  sellerGstin: string,
  buyerGstin: string,
  placeOfSupply: string,
): { cgst: number | null; sgst: number | null; igst: number | null } {
  const seller = gstinState(sellerGstin)
  const buyer = gstinState(buyerGstin) ?? (/^\d{2}$/.test(placeOfSupply.trim()) ? placeOfSupply.trim() : null)
  if (!seller || !buyer) return { cgst: null, sgst: null, igst: null }
  if (seller !== buyer) return { cgst: null, sgst: null, igst: taxAmount }
  const paise = toPaise(taxAmount)
  const cgst = Math.floor(paise / 2)
  return { cgst: fromPaise(cgst), sgst: fromPaise(paise - cgst), igst: null }
}

/* ------------------------- Consolidated statement ------------------------- */

export interface ConsolidatedStatement {
  invoices: Invoice[]
  orderedQty: number
  invoicedQty: number
  remainingQty: number
  subtotal: number
  discount: number
  taxableValue: number
  taxAmount: number
  total: number
  orderGrandTotal: number
  fullyInvoiced: boolean
  reconciles: boolean
}

export function consolidatedStatement(
  order: ProductionOrder,
  invoices: Invoice[],
  totals: Pick<CostingResult, 'grandTotal'>,
): ConsolidatedStatement {
  const list = invoices
    .filter((i) => i.orderId === order.id)
    .sort((a, b) => a.partial.seq - b.partial.seq)
  const sum = (pick: (i: Invoice) => number) => fromPaise(list.reduce((s, i) => s + toPaise(pick(i)), 0))
  const invoicedQty = list.reduce((s, i) => s + i.partial.thisQty, 0)
  const total = sum((i) => i.total)
  const fullyInvoiced = invoicedQty === order.quantity
  return {
    invoices: list,
    orderedQty: order.quantity,
    invoicedQty,
    remainingQty: order.quantity - invoicedQty,
    subtotal: sum((i) => i.subtotal),
    discount: sum((i) => i.discount),
    taxableValue: sum((i) => i.taxableValue),
    taxAmount: sum((i) => i.taxAmount),
    total,
    orderGrandTotal: totals.grandTotal,
    fullyInvoiced,
    reconciles: !fullyInvoiced || toPaise(total) === toPaise(totals.grandTotal),
  }
}

/* --------------------------- Per-order invoice view ----------------------- */

export type OrderInvoiceStatus = 'none' | 'partial' | 'full'

/* Invoice documents become available only after the shipment is confirmed received. */
export const DELIVERY_PENDING_MESSAGE = 'Confirm delivery received in Dispatch to enable invoice download.'
export const DELIVERY_PENDING_BILLING_MESSAGE = 'Awaiting delivery confirmation from Administrator 1 or 2.'

export function isReceived(dispatch: Pick<Dispatch, 'receivedAt'> | undefined | null): boolean {
  return !!dispatch?.receivedAt
}

/** Null when the invoice may be previewed or downloaded; otherwise the reason it may not. */
export function invoiceDownloadBlock(_invoice: Pick<Invoice, 'dispatchId'>, _dispatches: Dispatch[]): string | null {
  return null
}

/** Invoices of one order whose shipment is dispatched AND confirmed received — what the cumulative summary covers. */
export function receivedInvoices(orderId: string, dispatches: Dispatch[], invoices: Invoice[]): Invoice[] {
  const received = new Set(dispatches.filter((d) => d.orderId === orderId && isReceived(d)).map((d) => d.id))
  return invoices.filter((i) => i.orderId === orderId && received.has(i.dispatchId))
}

export interface OrderInvoiceSummary {
  order: ProductionOrder
  shipments: Array<{ dispatch: Dispatch; invoice: Invoice | undefined }>
  dispatchedQty: number
  /** Pieces in shipments confirmed received — the only ones the cumulative download covers. */
  receivedQty: number
  awaitingQty: number
  remainingQty: number
  billed: number
  /** Sum of invoices whose shipment is confirmed received. */
  receivedBilled: number
  status: OrderInvoiceStatus
  latestDispatch: string | null
}

/**
 * One entry per production order, keyed by order id. Quantities come from saved
 * dispatch records and amounts from their issued invoice snapshots — never from
 * production output, a form value, or current master rates.
 */
export function orderInvoiceSummary(order: ProductionOrder, dispatches: Dispatch[], invoices: Invoice[]): OrderInvoiceSummary {
  const shipments = dispatches
    .filter((d) => d.orderId === order.id)
    .sort((a, b) => a.seq - b.seq)
    .map((dispatch) => ({ dispatch, invoice: invoices.find((i) => i.id === dispatch.invoiceId && i.orderId === order.id) }))
  const dispatchedQty = shipments.reduce((s, x) => s + x.dispatch.quantity, 0)
  const billed = fromPaise(shipments.reduce((s, x) => s + (x.invoice ? toPaise(x.invoice.total) : 0), 0))
  const received = shipments.filter((x) => isReceived(x.dispatch))
  const receivedQty = received.reduce((s, x) => s + x.dispatch.quantity, 0)
  const receivedBilled = fromPaise(received.reduce((s, x) => s + (x.invoice ? toPaise(x.invoice.total) : 0), 0))
  const latestDispatch = shipments.reduce<string | null>((m, x) => (!m || x.dispatch.date > m ? x.dispatch.date : m), null)
  return {
    order,
    shipments,
    dispatchedQty,
    receivedQty,
    awaitingQty: dispatchedQty - receivedQty,
    remainingQty: order.quantity - dispatchedQty,
    billed,
    receivedBilled,
    status: dispatchedQty === 0 ? 'none' : dispatchedQty >= order.quantity ? 'full' : 'partial',
    latestDispatch,
  }
}

/* ------------------------------- Numbering -------------------------------- */

/** Indian financial year (April–March), e.g. 2026-09-15 → "2026-27". */
export function financialYear(isoDate: string): string {
  const [y, m] = isoDate.split('-').map(Number)
  const start = m >= 4 ? y : y - 1
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`
}

export function invoiceNumber(prefix: string, isoDate: string, seq: number): string {
  const clean = prefix.trim().replace(/[^A-Za-z0-9-]/g, '') || 'INV'
  return `${clean}/${financialYear(isoDate)}/${String(seq).padStart(4, '0')}`
}

/* ----------------------------- Amount in words ---------------------------- */

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function belowHundred(n: number): string {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`
}

function belowThousand(n: number): string {
  const h = Math.floor(n / 100)
  const r = n % 100
  return [h ? `${ONES[h]} Hundred` : '', r ? belowHundred(r) : ''].filter(Boolean).join(' ')
}

/** Indian numbering (lakh, crore): 125000.5 → "Rupees One Lakh Twenty Five Thousand and Fifty Paise Only". */
export function rupeesInWords(amount: number): string {
  const paise = toPaise(Math.abs(amount))
  let rupees = Math.floor(paise / 100)
  const p = paise % 100
  if (rupees === 0 && p === 0) return 'Rupees Zero Only'
  const parts: string[] = []
  const crore = Math.floor(rupees / 10_000_000)
  rupees %= 10_000_000
  const lakh = Math.floor(rupees / 100_000)
  rupees %= 100_000
  const thousand = Math.floor(rupees / 1000)
  rupees %= 1000
  if (crore) parts.push(`${crore >= 1000 ? rupeesInWords(crore).replace(/^Rupees | Only$/g, '') : belowThousand(crore)} Crore`)
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`)
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`)
  if (rupees) parts.push(belowThousand(rupees))
  const words = parts.join(' ')
  return `Rupees ${words || 'Zero'}${p ? ` and ${belowHundred(p)} Paise` : ''} Only`
}
