/* ---------------------------------------------------------------------------
 * GST arithmetic shared by purchase bills and sales-invoice corrections.
 *
 *   • Same state for seller and buyer → CGST + SGST, half each (odd paisa to SGST).
 *   • Different states               → IGST, the full rate.
 *   • `auto` decides from the first two digits of each GSTIN (33 = Tamil Nadu);
 *     `intra` / `inter` let billing override it when a GSTIN is missing.
 * Tax is worked out per line and rounded half-up to the paisa, so bills with
 * goods at different rates add up the way the supplier's own bill does.
 * All money is handled in integer paise.
 * ------------------------------------------------------------------------- */

import type { Invoice, PurchaseBill, SupplyType } from './types'
import { fromPaise, toPaise } from './costing'
import { gstinState } from './billing'

/** Common GST slabs. Any other rate can still be typed in. */
export const GST_RATES = [0, 5, 12, 18, 28, 40]

export const SUPPLY_LABEL: Record<SupplyType, string> = {
  auto: 'Auto — from GSTIN state codes',
  intra: 'Within state — CGST + SGST',
  inter: 'Other state — IGST',
}

/**
 * HSN/SAC codes seen on this business's own bills. The rate is only a starting
 * point — confirm it against the current GST rate notification and edit it.
 */
export const HSN_SUGGESTIONS: Array<{ hsn: string; label: string; gstPct: number }> = [
  { hsn: '48192020', label: 'Folding cartons / boxes of non-corrugated paperboard', gstPct: 18 },
  { hsn: '48191010', label: 'Corrugated paper boxes and cartons', gstPct: 18 },
  { hsn: '48102900', label: 'Coated paper / paperboard (e.g. Gold Coin board)', gstPct: 18 },
  { hsn: '48025690', label: 'Uncoated printing paper', gstPct: 18 },
  { hsn: '998912', label: 'Printing / lamination job work (SAC)', gstPct: 18 },
  { hsn: '996511', label: 'Goods transport by road (SAC)', gstPct: 5 },
]

export type ResolvedSupply = 'intra' | 'inter' | null

export function resolveSupply(type: SupplyType, sellerGstin: string, buyerGstin: string, placeOfSupply = ''): ResolvedSupply {
  if (type !== 'auto') return type
  const seller = gstinState(sellerGstin)
  const buyer = gstinState(buyerGstin) ?? (/^\d{2}$/.test(placeOfSupply.trim()) ? placeOfSupply.trim() : null)
  if (!seller || !buyer) return null
  return seller === buyer ? 'intra' : 'inter'
}

/** Split a tax amount (paise) by supply. Unknown supply keeps a single tax line. */
export function splitPaise(taxPaise: number, supply: ResolvedSupply): { cgst: number | null; sgst: number | null; igst: number | null } {
  if (supply === 'inter') return { cgst: null, sgst: null, igst: taxPaise }
  if (supply === 'intra') {
    const cgst = Math.floor(taxPaise / 2)
    return { cgst, sgst: taxPaise - cgst, igst: null }
  }
  return { cgst: null, sgst: null, igst: null }
}

export const validGstPct = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100

/* ------------------------------ Purchase bills ---------------------------- */

export interface PurchaseTotals {
  supply: ResolvedSupply
  lines: Array<{ amount: number; tax: number }>
  /** HSN + rate summary, like the tax table printed under a GST invoice. */
  summary: Array<{ hsn: string; gstPct: number; taxable: number; cgst: number; sgst: number; igst: number; tax: number }>
  taxable: number
  cgst: number
  sgst: number
  igst: number
  tax: number
  roundOff: number
  net: number
}

export function purchaseTotals(bill: Pick<PurchaseBill, 'lines' | 'supplyType' | 'supplierGstin' | 'roundOff'>, companyGstin: string): PurchaseTotals {
  const supply = resolveSupply(bill.supplyType, bill.supplierGstin, companyGstin)
  let taxable = 0
  let cgst = 0
  let sgst = 0
  let igst = 0
  let tax = 0
  const groups = new Map<string, PurchaseTotals['summary'][number]>()
  const lines = bill.lines.map((l) => {
    const amount = Math.round((Number(l.quantity) || 0) * toPaise(Number(l.rate) || 0))
    const t = Math.round((amount * (Number(l.gstPct) || 0)) / 100)
    const s = splitPaise(t, supply)
    taxable += amount
    tax += t
    cgst += s.cgst ?? 0
    sgst += s.sgst ?? 0
    igst += s.igst ?? 0
    const key = `${l.hsn.trim()}|${l.gstPct}`
    const g = groups.get(key) ?? { hsn: l.hsn.trim(), gstPct: l.gstPct, taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0 }
    g.taxable += amount
    g.tax += t
    g.cgst += s.cgst ?? 0
    g.sgst += s.sgst ?? 0
    g.igst += s.igst ?? 0
    groups.set(key, g)
    return { amount: fromPaise(amount), tax: fromPaise(t) }
  })
  const gross = taxable + tax
  const net = bill.roundOff ? Math.round(gross / 100) * 100 : gross
  const money = (p: number) => fromPaise(p)
  return {
    supply,
    lines,
    summary: [...groups.values()].map((g) => ({ ...g, taxable: money(g.taxable), cgst: money(g.cgst), sgst: money(g.sgst), igst: money(g.igst), tax: money(g.tax) })),
    taxable: money(taxable),
    cgst: money(cgst),
    sgst: money(sgst),
    igst: money(igst),
    tax: money(tax),
    roundOff: money(net - gross),
    net: money(net),
  }
}

/* --------------------------- Sales invoice re-tax -------------------------- */

export interface InvoiceTaxEdit {
  taxPct: number
  supplyType: SupplyType
  /** HSN per invoice line, same order as `invoice.lines`. */
  hsn: string[]
  taxLabel: string
}

/** The invoice with its GST recalculated. Quantities, rates and discount are untouched. */
export function retaxInvoice(inv: Invoice, edit: InvoiceTaxEdit): Invoice {
  const taxPaise = Math.round((toPaise(inv.taxableValue) * edit.taxPct) / 100)
  const supply = resolveSupply(edit.supplyType, inv.company.gstin, inv.customer.gstin, inv.customer.placeOfSupply)
  const s = splitPaise(taxPaise, supply)
  const opt = (p: number | null) => (p === null ? null : fromPaise(p))
  return {
    ...inv,
    lines: inv.lines.map((l, i) => ({ ...l, hsn: (edit.hsn[i] ?? l.hsn).trim() })),
    taxLabel: edit.taxLabel.trim() || inv.taxLabel,
    taxPct: edit.taxPct,
    taxAmount: fromPaise(taxPaise),
    cgst: opt(s.cgst),
    sgst: opt(s.sgst),
    igst: opt(s.igst),
    total: fromPaise(toPaise(inv.taxableValue) + taxPaise),
    supplyType: edit.supplyType,
  }
}
