import type { Invoice, PurchaseBill, PurchaseLine, SupplyType } from '../lib/types'
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

const SUPPLY_TYPES: SupplyType[] = ['auto', 'intra', 'inter']

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
        newValue: `${updated.taxLabel} ${updated.taxPct}% (${updated.igst !== null ? 'IGST' : updated.cgst !== null ? 'CGST + SGST' : 'single line'}) = ${updated.taxAmount.toFixed(2)}, total ${updated.total.toFixed(2)}`,
      })
      return ok(next, updated)
    },
)
