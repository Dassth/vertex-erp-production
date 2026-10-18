/* ---------------------------------------------------------------------------
 * GST arithmetic shared by purchase bills and sales-invoice corrections.
 *
 *   • Same state for seller and buyer → CGST + SGST: CGST = half the tax
 *     rounded to the paisa, SGST = the rest, so the two always add up exactly.
 *   • Different states               → IGST, the full rate.
 *   • This holds for registered and unregistered (URD / B2C) buyers alike.
 *   • `auto` decides from the states: the seller's from its GSTIN or the
 *     company State; the buyer's from its GSTIN, else the Place of supply,
 *     else a state named in the delivery address. `intra` / `inter` let
 *     billing override it.
 * Tax is worked out per line and rounded half-up to the paisa, so bills with
 * goods at different rates add up the way the supplier's own bill does.
 * All money is handled in integer paise.
 * ------------------------------------------------------------------------- */

import type { Invoice, PurchaseBill, SupplyType } from './types'
import { fromPaise, toPaise } from './costing'
import { gstinState } from './billing'
import { GST_STATES, stateCodeFrom } from './gstStates'

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

/** A state named in free text (an address), when exactly one state's full name appears in it. */
export function stateInText(text: string | null | undefined): string | null {
  const t = ` ${(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `
  if (!t.trim()) return null
  const found = new Set(GST_STATES.filter((s) => s.code !== '28' && t.includes(` ${s.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `)).map((s) => s.code))
  if (t.includes(' tamilnadu ')) found.add('33')
  return found.size === 1 ? [...found][0] : null
}

/** The seller's state: from its GSTIN, else the State set in the company profile. */
export function sellerState(company: { gstin: string; stateCode?: string | null }): string | null {
  return gstinState(company.gstin) ?? stateCodeFrom(company.stateCode)
}

/** The buyer's state: from its GSTIN, else the Place of supply, else a state named in the delivery address. */
export function buyerState(buyer: { gstin?: string; placeOfSupply?: string; deliveryAddress?: string }): string | null {
  return gstinState(buyer.gstin ?? '') ?? stateCodeFrom(buyer.placeOfSupply) ?? stateInText(buyer.deliveryAddress)
}

/** Same state → intra (CGST + SGST); different → inter (IGST); a state not known → null. */
export function supplyBetween(seller: string | null, buyer: string | null): ResolvedSupply {
  if (!seller || !buyer) return null
  return seller === buyer ? 'intra' : 'inter'
}

/**
 * `auto` decides from the two parties' states; `intra` / `inter` are chosen by
 * hand; `none` prints one GST line. Seller and buyer are the parties (or their
 * GSTINs, for older callers).
 */
export function resolveSupply(
  type: SupplyType,
  seller: string | { gstin: string; stateCode?: string | null },
  buyer: string | { gstin?: string; placeOfSupply?: string; deliveryAddress?: string },
  placeOfSupply = '',
): ResolvedSupply {
  if (type === 'none') return null
  if (type !== 'auto') return type
  const s = typeof seller === 'string' ? sellerState({ gstin: seller }) : sellerState(seller)
  const b = typeof buyer === 'string' ? buyerState({ gstin: buyer, placeOfSupply }) : buyerState(buyer)
  return supplyBetween(s, b)
}

/**
 * Split a tax amount (paise) by supply. CGST is half rounded to the paisa and
 * SGST the rest, so they always add up exactly. Unknown supply keeps one line.
 */
export function splitPaise(taxPaise: number, supply: ResolvedSupply): { cgst: number | null; sgst: number | null; igst: number | null } {
  if (supply === 'inter') return { cgst: null, sgst: null, igst: taxPaise }
  if (supply === 'intra') {
    const cgst = Math.round(taxPaise / 2)
    return { cgst, sgst: taxPaise - cgst, igst: null }
  }
  return { cgst: null, sgst: null, igst: null }
}

/** The same split in rupees. */
export function splitRupees(tax: number, supply: ResolvedSupply): { cgst: number | null; sgst: number | null; igst: number | null } {
  const s = splitPaise(toPaise(tax), supply)
  return { cgst: s.cgst === null ? null : fromPaise(s.cgst), sgst: s.sgst === null ? null : fromPaise(s.sgst), igst: s.igst === null ? null : fromPaise(s.igst) }
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

/** `company` is the company profile (or, from older callers, just its GSTIN). The supplier's state comes from its GSTIN or address. */
export function purchaseTotals(bill: Pick<PurchaseBill, 'lines' | 'supplyType' | 'supplierGstin' | 'roundOff'> & { supplierAddress?: string }, company: string | { gstin: string; stateCode?: string | null }): PurchaseTotals {
  const supply = resolveSupply(bill.supplyType, typeof company === 'string' ? { gstin: company } : company, { gstin: bill.supplierGstin, deliveryAddress: bill.supplierAddress })
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
  const supply = resolveSupply(edit.supplyType, inv.company, { gstin: inv.customer.gstin, placeOfSupply: inv.customer.placeOfSupply, deliveryAddress: inv.deliveryAddress })
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

/* ------------------------------ Tax lines ---------------------------------- */

/**
 * The tax lines to print for a sale — "CGST @ 9%" + "SGST @ 9%", or "IGST @ 18%",
 * or one line saying the state is missing — from the same helper invoices use.
 */
export function saleTaxLines(
  company: { gstin: string; stateCode?: string | null },
  buyer: { gstin?: string; placeOfSupply?: string; deliveryAddress?: string },
  taxPct: number,
  taxAmount: number,
  taxLabel = 'GST',
): { supply: ResolvedSupply; lines: Array<[string, number]> } {
  const supply = supplyBetween(sellerState(company), buyerState(buyer))
  const s = splitRupees(taxAmount, supply)
  if (supply === 'intra') return { supply, lines: [[`CGST @ ${taxPct / 2}%`, s.cgst!], [`SGST @ ${taxPct / 2}%`, s.sgst!]] }
  if (supply === 'inter') return { supply, lines: [[`IGST @ ${taxPct}%`, s.igst!]] }
  return { supply, lines: [[`${taxLabel} @ ${taxPct}% (set the customer’s Place of supply)`, taxAmount]] }
}
