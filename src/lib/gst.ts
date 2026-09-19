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
  intra: 'Local (within state) — CGST + SGST',
  inter: 'Other state — IGST',
  none: 'Local — one GST line (no split)',
}

/** Choices offered in a GST type dropdown; `none` is reached by un-ticking the split. */
export const SUPPLY_CHOICES: SupplyType[] = ['auto', 'intra', 'inter']

/**
 * HSN/SAC codes seen on this business's own bills. The rate is only a starting
 * point — confirm it against the current GST rate notification and edit it.
 */
export const HSN_SUGGESTIONS: Array<{ hsn: string; label: string; gstPct: number }> = [
  // What Vertex sells
  { hsn: '48192020', label: 'Folding cartons / boxes of non-corrugated paperboard', gstPct: 18 },
  { hsn: '48191010', label: 'Corrugated boxes and cartons (5% from 22 Sep 2025)', gstPct: 5 },
  { hsn: '48211020', label: 'Printed paper labels / tags', gstPct: 18 },
  { hsn: '998912', label: 'Printing / lamination job work (SAC)', gstPct: 18 },
  // What Vertex buys
  { hsn: '4810', label: 'Coated paper / paperboard (art board, Gold Coin, duplex)', gstPct: 18 },
  { hsn: '4802', label: 'Uncoated paper / board (maplitho, kraft)', gstPct: 18 },
  { hsn: '39201012', label: 'Plastic film for lamination (BOPP / PVC)', gstPct: 18 },
  { hsn: '3506', label: 'Glue / adhesive', gstPct: 18 },
  { hsn: '84425020', label: 'Printing plates', gstPct: 18 },
  { hsn: '996511', label: 'Goods transport by road (SAC)', gstPct: 5 },
]

export type ResolvedSupply = 'intra' | 'inter' | null

export function resolveSupply(type: SupplyType, sellerGstin: string, buyerGstin: string, placeOfSupply = ''): ResolvedSupply {
  if (type === 'none') return null
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
  /** Local supply only: CGST and SGST rates when they are not an equal half each. */
  cgstPct?: number | null
  sgstPct?: number | null
  /** HSN per invoice line, same order as `invoice.lines`. */
  hsn: string[]
  taxLabel: string
}

/** The invoice with its GST recalculated. Quantities, rates and discount are untouched. */
export function retaxInvoice(inv: Invoice, edit: InvoiceTaxEdit): Invoice {
  const supply = resolveSupply(edit.supplyType, inv.company.gstin, inv.customer.gstin, inv.customer.placeOfSupply)
  const taxable = toPaise(inv.taxableValue)
  const custom = supply === 'intra' && validGstPct(edit.cgstPct) && validGstPct(edit.sgstPct)
  let taxPct = edit.taxPct
  let taxPaise: number
  let split: ReturnType<typeof splitPaise>
  if (custom) {
    const cgst = Math.round((taxable * edit.cgstPct!) / 100)
    const sgst = Math.round((taxable * edit.sgstPct!) / 100)
    taxPct = Math.round((edit.cgstPct! + edit.sgstPct!) * 1000) / 1000
    taxPaise = cgst + sgst
    split = { cgst, sgst, igst: null }
  } else {
    taxPaise = Math.round((taxable * taxPct) / 100)
    split = splitPaise(taxPaise, supply)
  }
  const opt = (p: number | null) => (p === null ? null : fromPaise(p))
  return {
    ...inv,
    lines: inv.lines.map((l, i) => ({ ...l, hsn: (edit.hsn[i] ?? l.hsn).trim() })),
    taxLabel: edit.taxLabel.trim() || inv.taxLabel,
    taxPct,
    taxAmount: fromPaise(taxPaise),
    cgst: opt(split.cgst),
    sgst: opt(split.sgst),
    igst: opt(split.igst),
    cgstPct: split.cgst === null ? null : custom ? edit.cgstPct! : taxPct / 2,
    sgstPct: split.sgst === null ? null : custom ? edit.sgstPct! : taxPct / 2,
    total: fromPaise(taxable + taxPaise),
    supplyType: edit.supplyType,
  }
}
