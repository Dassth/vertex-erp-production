import type { CustomerSnapshot, Invoice, PurchaseBill, PurchaseLine, SupplyType } from '../lib/types'
import { fromPaise, toPaise } from '../lib/costing'
import { isValidGstin } from '../lib/billing'
import { purchaseTotals, retaxInvoice, validGstPct } from '../lib/gst'
import type { InvoiceTaxEdit } from '../lib/gst'
import {
  audit,
  command,
  docCode,
  fail,
  hasFieldErrors,
  isIsoDate,
  nextSeq,
  ok,
  requireCapability,
  stampNew,
  stampUpdate,
  staleRecord,
  validationFailure,
} from './common'
import type { Op } from './common'

/* ---------------------------------------------------------------------------
 * Purchase bills record what we bought from suppliers. Unlike sales invoices
 * they are not tied to a dispatch, so they can be edited, previewed and
 * downloaded at any time. Every change is audited.
 * ------------------------------------------------------------------------- */

export interface PurchaseDraft {
  /** Empty for a new bill. */
  id: string
  supplierName: string
  supplierGstin: string
  supplierAddress: string
  supplierInvoiceNo: string
  date: string
  lines: PurchaseLine[]
  supplyType: SupplyType
  roundOff: boolean
  notes: string
  /** The `updatedAt` the editor loaded, so a newer save is never overwritten. */
  expectedUpdatedAt?: string | null
}

const SUPPLY_TYPES: SupplyType[] = ['auto', 'intra', 'inter', 'none']

export function validatePurchase(d: PurchaseDraft): Record<string, string> {
  const e: Record<string, string> = {}
  if (!d.supplierName.trim()) e.supplierName = 'Enter the supplier name.'
  if (d.supplierGstin.trim() && !isValidGstin(d.supplierGstin)) e.supplierGstin = 'GSTIN must be 15 characters, starting with the 2-digit state code.'
  if (!isIsoDate(d.date)) e.date = 'Enter the bill date.'
  if (!SUPPLY_TYPES.includes(d.supplyType)) e.supplyType = 'Choose how GST applies.'
  if (!d.lines.length) e.lines = 'Add at least one item.'
  d.lines.forEach((l, i) => {
    if (!l.description.trim()) e[`line.${i}.description`] = 'Enter the item.'
    if (!(Number.isFinite(l.quantity) && l.quantity > 0)) e[`line.${i}.quantity`] = 'Quantity must be more than 0.'
    if (!(Number.isFinite(l.rate) && l.rate >= 0)) e[`line.${i}.rate`] = 'Enter the rate.'
    if (!validGstPct(l.gstPct)) e[`line.${i}.gstPct`] = 'GST % must be between 0 and 100.'
  })
  return e
}

const clean = (d: PurchaseDraft) => ({
  supplierName: d.supplierName.trim(),
  supplierGstin: d.supplierGstin.trim().toUpperCase(),
  supplierAddress: d.supplierAddress.trim(),
  supplierInvoiceNo: d.supplierInvoiceNo.trim(),
  date: d.date,
  lines: d.lines.map((l) => ({ ...l, description: l.description.trim(), hsn: l.hsn.trim(), uom: l.uom.trim() })),
  supplyType: d.supplyType,
  roundOff: d.roundOff,
  notes: d.notes.trim(),
})

export const savePurchaseBill = command(
  'savePurchaseBill',
  (draft: PurchaseDraft): Op<PurchaseBill> =>
    (db, ctx) => {
      const denied = requireCapability(ctx, 'billing')
      if (denied) return denied
      const errors = validatePurchase(draft)
      if (hasFieldErrors(errors)) return validationFailure(errors)
      const purchases = db.purchases ?? []
      const net = (b: PurchaseBill) => purchaseTotals(b, db.company.gstin).net.toFixed(2)

      if (draft.id) {
        const current = purchases.find((p) => p.id === draft.id)
        if (!current) return fail('This purchase bill no longer exists.')
        const stale = staleRecord(current.code, current, draft.expectedUpdatedAt)
        if (stale) return stale
        const updated: PurchaseBill = stampUpdate({ ...current, ...clean(draft) }, ctx)
        let next = { ...db, purchases: purchases.map((p) => (p.id === current.id ? updated : p)) }
        next = audit(next, ctx, {
          action: 'Purchase bill edited',
          entity: 'Purchase',
          entityId: updated.id,
          entityLabel: `${updated.code} — ${updated.supplierName}`,
          field: 'Net amount',
          oldValue: net(current),
          newValue: net(updated),
        })
        return ok(next, updated)
      }

      let next = db
      let seq: number
      ;[next, seq] = nextSeq(next, 'purchase')
      const bill: PurchaseBill = { id: ctx.newId('PUR'), code: docCode('PUR', seq), ...clean(draft), ...stampNew(ctx) }
      next = { ...next, purchases: [...purchases, bill] }
      next = audit(next, ctx, {
        action: 'Purchase bill recorded',
        entity: 'Purchase',
        entityId: bill.id,
        entityLabel: `${bill.code} — ${bill.supplierName}`,
        field: 'Net amount',
        newValue: net(bill),
      })
      return ok(next, bill)
    },
)

export const deletePurchaseBill = command(
  'deletePurchaseBill',
  (id: string): Op<null> =>
    (db, ctx) => {
      const denied = requireCapability(ctx, 'billing')
      if (denied) return denied
      const bill = (db.purchases ?? []).find((p) => p.id === id)
      if (!bill) return fail('This purchase bill no longer exists.')
      let next = { ...db, purchases: db.purchases.filter((p) => p.id !== id) }
      next = audit(next, ctx, {
        action: 'Purchase bill deleted',
        entity: 'Purchase',
        entityId: bill.id,
        entityLabel: `${bill.code} — ${bill.supplierName}`,
        oldValue: `${bill.supplierInvoiceNo || 'no supplier number'}, ${purchaseTotals(bill, db.company.gstin).net.toFixed(2)}`,
      })
      return ok(next, null)
    },
)

/* ------------------------- Sales invoice GST edit -------------------------- */

export function validateInvoiceTax(inv: Pick<Invoice, 'lines'>, edit: InvoiceTaxEdit): Record<string, string> {
  const e: Record<string, string> = {}
  if (!validGstPct(edit.taxPct)) e.taxPct = 'GST % must be between 0 and 100.'
  if (!SUPPLY_TYPES.includes(edit.supplyType)) e.supplyType = 'Choose how GST applies.'
  if (edit.hsn.length !== inv.lines.length) e.hsn = 'HSN is required for every line.'
  const hasSplit = edit.cgstPct !== undefined && edit.cgstPct !== null
  if (hasSplit || (edit.sgstPct !== undefined && edit.sgstPct !== null)) {
    if (!validGstPct(edit.cgstPct)) e.cgstPct = 'CGST % must be between 0 and 100.'
    if (!validGstPct(edit.sgstPct)) e.sgstPct = 'SGST % must be between 0 and 100.'
  }
  return e
}

/**
 * Correct the GST on an issued sales invoice: rate, CGST/SGST vs IGST and HSN.
 * The invoice number, quantity, rate and taxable value never change, and the
 * old and new totals are written to the audit trail.
 */
export const editInvoiceTax = command(
  'editInvoiceTax',
  (invoiceId: string, edit: InvoiceTaxEdit): Op<Invoice> =>
    (db, ctx) => {
      const denied = requireCapability(ctx, 'billing')
      if (denied) return denied
      const current = db.invoices.find((i) => i.id === invoiceId)
      if (!current) return fail('Invoice not found.')
      const errors = validateInvoiceTax(current, edit)
      if (hasFieldErrors(errors)) return validationFailure(errors)
      const updated: Invoice = { ...retaxInvoice(current, edit), editedAt: ctx.now.toISOString(), editedBy: ctx.actor.name }
      let next = { ...db, invoices: db.invoices.map((i) => (i.id === invoiceId ? updated : i)) }
      next = audit(next, ctx, {
        action: 'Invoice GST edited',
        entity: 'Invoice',
        entityId: updated.id,
        entityLabel: `${updated.number} — ${updated.customer.company}`,
        field: 'GST and total',
        oldValue: `${current.taxLabel} ${current.taxPct}% = ${current.taxAmount.toFixed(2)}, total ${current.total.toFixed(2)}`,
        newValue: `${updated.taxLabel} ${updated.taxPct}% (${updated.igst !== null ? 'IGST' : updated.cgst !== null ? `CGST ${updated.cgstPct}% + SGST ${updated.sgstPct}%` : 'single line'}) = ${updated.taxAmount.toFixed(2)}, total ${updated.total.toFixed(2)}`,
      })
      return ok(next, updated)
    },
)

/* --------------------------- Sales invoice full edit ------------------------ */

export interface InvoiceLineDraft {
  description: string
  hsn: string
  quantity: number
  uom: string
  rate: number
}

/** Everything billing may correct on an issued invoice. The invoice number never changes. */
export interface InvoiceDraft {
  issueDate: string
  customer: Pick<CustomerSnapshot, 'company' | 'contactPerson' | 'billingAddress' | 'gstin' | 'placeOfSupply' | 'phone' | 'email'>
  deliveryAddress: string
  customerRef: string
  lines: InvoiceLineDraft[]
  discount: number
  tax: InvoiceTaxEdit
  paymentTerms: string
  transporter: string
  vehicleNo: string
  notes: string
}

export function invoiceToDraft(inv: Invoice): InvoiceDraft {
  return {
    issueDate: inv.issueDate,
    customer: {
      company: inv.customer.company,
      contactPerson: inv.customer.contactPerson,
      billingAddress: inv.customer.billingAddress,
      gstin: inv.customer.gstin,
      placeOfSupply: inv.customer.placeOfSupply,
      phone: inv.customer.phone,
      email: inv.customer.email,
    },
    deliveryAddress: inv.deliveryAddress,
    customerRef: inv.refs.customerRef,
    lines: inv.lines.map((l) => ({ description: l.description, hsn: l.hsn, quantity: l.quantity, uom: l.uom, rate: l.rate })),
    discount: inv.discount,
    tax: {
      taxPct: inv.taxPct,
      supplyType: inv.supplyType ?? 'auto',
      cgstPct: inv.cgstPct ?? inv.taxPct / 2,
      sgstPct: inv.sgstPct ?? inv.taxPct / 2,
      hsn: inv.lines.map((l) => l.hsn),
      taxLabel: inv.taxLabel,
    },
    paymentTerms: inv.paymentTerms,
    transporter: inv.transporter,
    vehicleNo: inv.vehicleNo,
    notes: inv.notes,
  }
}

export function validateInvoiceDraft(d: InvoiceDraft): Record<string, string> {
  const e: Record<string, string> = {}
  if (!isIsoDate(d.issueDate)) e.issueDate = 'Enter the invoice date.'
  if (!d.customer.company.trim()) e.company = 'Enter the customer name.'
  if (d.customer.gstin.trim() && !isValidGstin(d.customer.gstin)) e.gstin = 'GSTIN must be 15 characters, starting with the 2-digit state code.'
  if (!d.lines.length) e.lines = 'Keep at least one line.'
  d.lines.forEach((l, i) => {
    if (!l.description.trim()) e[`line.${i}.description`] = 'Enter the description.'
    if (!(Number.isFinite(l.quantity) && l.quantity > 0)) e[`line.${i}.quantity`] = 'Quantity must be more than 0.'
    if (!(Number.isFinite(l.rate) && l.rate >= 0)) e[`line.${i}.rate`] = 'Enter the rate.'
  })
  if (!(Number.isFinite(d.discount) && d.discount >= 0)) e.discount = 'Discount cannot be negative.'
  Object.assign(e, validateInvoiceTax({ lines: d.lines.map(() => null) } as unknown as Invoice, { ...d.tax, hsn: d.lines.map((l) => l.hsn) }))
  return e
}

/** The invoice rebuilt from a draft: line amounts, taxable value, GST and total are recalculated. */
export function applyInvoiceDraft(inv: Invoice, d: InvoiceDraft): Invoice {
  const lines = d.lines.map((l) => ({
    description: l.description.trim(),
    hsn: l.hsn.trim(),
    quantity: l.quantity,
    uom: l.uom.trim(),
    rate: l.rate,
    amount: fromPaise(Math.round(l.quantity * toPaise(l.rate))),
  }))
  const subtotal = lines.reduce((s, l) => s + toPaise(l.amount), 0)
  const discount = Math.min(toPaise(d.discount), subtotal)
  const base: Invoice = {
    ...inv,
    issueDate: d.issueDate,
    customer: {
      ...inv.customer,
      ...d.customer,
      company: d.customer.company.trim(),
      gstin: d.customer.gstin.trim().toUpperCase(),
      billingAddress: d.customer.billingAddress.trim(),
    },
    deliveryAddress: d.deliveryAddress.trim(),
    refs: { ...inv.refs, customerRef: d.customerRef.trim() },
    lines,
    subtotal: fromPaise(subtotal),
    discount: fromPaise(discount),
    taxableValue: fromPaise(subtotal - discount),
    paymentTerms: d.paymentTerms.trim(),
    transporter: d.transporter.trim(),
    vehicleNo: d.vehicleNo.trim(),
    notes: d.notes.trim(),
  }
  return retaxInvoice(base, { ...d.tax, hsn: lines.map((l) => l.hsn) })
}

/**
 * Full correction of an issued sales invoice. The same record is updated, so the
 * Billing list, the Invoices page, the PDF and the monthly Sales report all show
 * the corrected figures. Dispatch quantities and balances are not touched.
 */
export const editInvoice = command(
  'editInvoice',
  (invoiceId: string, draft: InvoiceDraft): Op<Invoice> =>
    (db, ctx) => {
      const denied = requireCapability(ctx, 'billing')
      if (denied) return denied
      const current = db.invoices.find((i) => i.id === invoiceId)
      if (!current) return fail('Invoice not found.')
      const errors = validateInvoiceDraft(draft)
      if (hasFieldErrors(errors)) return validationFailure(errors)
      const updated: Invoice = { ...applyInvoiceDraft(current, draft), editedAt: ctx.now.toISOString(), editedBy: ctx.actor.name }
      let next = { ...db, invoices: db.invoices.map((i) => (i.id === invoiceId ? updated : i)) }
      next = audit(next, ctx, {
        action: 'Invoice edited',
        entity: 'Invoice',
        entityId: updated.id,
        entityLabel: `${updated.number} — ${updated.customer.company}`,
        field: 'Invoice',
        oldValue: `${current.issueDate}, ${current.customer.company}, taxable ${current.taxableValue.toFixed(2)}, ${current.taxLabel} ${current.taxPct}%, total ${current.total.toFixed(2)}`,
        newValue: `${updated.issueDate}, ${updated.customer.company}, taxable ${updated.taxableValue.toFixed(2)}, ${updated.taxLabel} ${updated.taxPct}%, total ${updated.total.toFixed(2)}`,
      })
      return ok(next, updated)
    },
)
