/* ---------------------------------------------------------------------------
 * Monthly GST report, laid out like the auditor's Annexure-I:
 *
 *   Purchases — one row per supplier bill and GST rate, grouped into
 *               "GST 18% LOCAL PURCHASE" (CGST + SGST) and
 *               "GST 18% PURCHASE" (IGST, other state).
 *   Sales     — one row per invoice, grouped the same way.
 *   HSN       — HSN-wise summary of quantity, taxable value and tax, which is
 *               what the GST return asks for (GSTR-1 table 12 for sales).
 *
 * Every figure is taken from the saved invoices and purchase bills — the
 * report never recalculates an issued invoice.
 * ------------------------------------------------------------------------- */

import { format, subMonths } from 'date-fns'
import type { Invoice, VertexDB } from './types'
import { fromPaise, toPaise } from './costing'
import { purchaseTotals, splitPaise } from './gst'
import type { ResolvedSupply } from './gst'

export interface GstRow {
  party: string
  /** What was bought or sold on this bill — materials for purchases, products for sales. */
  items: string
  gstin: string
  billNo: string
  date: string
  hsn: string
  taxable: number
  cgstPct: number | null
  cgst: number
  sgstPct: number | null
  sgst: number
  igstPct: number | null
  igst: number
  /** Tax that was not split (no GSTIN state known and no type chosen). */
  gst: number
  total: number
}

export interface GstSection {
  title: string
  rows: GstRow[]
  taxable: number
  cgst: number
  sgst: number
  igst: number
  gst: number
  total: number
}

export interface HsnRow {
  hsn: string
  description: string
  uom: string
  quantity: number
  taxable: number
  cgst: number
  sgst: number
  igst: number
  gst: number
  tax: number
  total: number
}

export interface GstRegister {
  sections: GstSection[]
  hsn: HsnRow[]
  taxable: number
  cgst: number
  sgst: number
  igst: number
  gst: number
  total: number
}

export interface MonthlyGstReport {
  month: string
  label: string
  purchases: GstRegister
  sales: GstRegister
}

/** Last month — the one a GST return is normally filed for. */
export const defaultReportMonth = (now = new Date()) => format(subMonths(now, 1), 'yyyy-MM')

const qtyText = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 3 })

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${MONTHS[(m || 1) - 1]}/${y}`
}

const kind = (supply: ResolvedSupply) => (supply === 'intra' ? 'LOCAL ' : '')
const sectionTitle = (pct: number, supply: ResolvedSupply, what: 'PURCHASE' | 'SALES') =>
  `GST ${pct}% ${kind(supply)}${what}${supply === null ? ' (GST NOT SPLIT)' : ''}`

/* Sums in paise so a long register adds up to the paisa. */
function sumOf<T>(list: T[], pick: (x: T) => number): number {
  return fromPaise(list.reduce((s, x) => s + toPaise(pick(x)), 0))
}

function register(rows: Array<GstRow & { key: string; title: string; order: number }>, hsn: HsnRow[]): GstRegister {
  const bySection = new Map<string, { title: string; order: number; rows: GstRow[] }>()
  for (const { key, title, order, ...row } of rows) {
    const s = bySection.get(key) ?? { title, order, rows: [] }
    s.rows.push(row)
    bySection.set(key, s)
  }
  const sections: GstSection[] = [...bySection.values()]
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
    .map(({ title, rows: r }) => ({
      title,
      rows: r.sort((a, b) => a.date.localeCompare(b.date) || a.billNo.localeCompare(b.billNo)),
      taxable: sumOf(r, (x) => x.taxable),
      cgst: sumOf(r, (x) => x.cgst),
      sgst: sumOf(r, (x) => x.sgst),
      igst: sumOf(r, (x) => x.igst),
      gst: sumOf(r, (x) => x.gst),
      total: sumOf(r, (x) => x.total),
    }))
  return {
    sections,
    hsn: hsn.sort((a, b) => a.hsn.localeCompare(b.hsn)),
    taxable: sumOf(sections, (s) => s.taxable),
    cgst: sumOf(sections, (s) => s.cgst),
    sgst: sumOf(sections, (s) => s.sgst),
    igst: sumOf(sections, (s) => s.igst),
    gst: sumOf(sections, (s) => s.gst),
    total: sumOf(sections, (s) => s.total),
  }
}

/** Accumulates HSN totals in paise. */
function hsnBook() {
  const map = new Map<string, { hsn: string; description: string; uom: string; quantity: number; taxable: number; cgst: number; sgst: number; igst: number; gst: number }>()
  return {
    add(hsn: string, description: string, uom: string, quantity: number, taxable: number, split: { cgst: number; sgst: number; igst: number; gst: number }) {
      const code = hsn.trim() || '—'
      const key = `${code}|${uom.trim().toLowerCase()}`
      const h = map.get(key) ?? { hsn: code, description, uom, quantity: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, gst: 0 }
      h.quantity += quantity
      h.taxable += taxable
      h.cgst += split.cgst
      h.sgst += split.sgst
      h.igst += split.igst
      h.gst += split.gst
      map.set(key, h)
    },
    rows(): HsnRow[] {
      return [...map.values()].map((h) => {
        const tax = h.cgst + h.sgst + h.igst + h.gst
        return {
          hsn: h.hsn,
          description: h.description,
          uom: h.uom,
          quantity: Math.round(h.quantity * 1000) / 1000,
          taxable: fromPaise(h.taxable),
          cgst: fromPaise(h.cgst),
          sgst: fromPaise(h.sgst),
          igst: fromPaise(h.igst),
          gst: fromPaise(h.gst),
          tax: fromPaise(tax),
          total: fromPaise(h.taxable + tax),
        }
      })
    },
  }
}

const invoiceSupply = (inv: Invoice): ResolvedSupply => (inv.igst !== null ? 'inter' : inv.cgst !== null ? 'intra' : null)

/** Split an amount across lines by their value; the last line takes the rounding. */
function spread(totalPaise: number, weights: number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0)
  let left = totalPaise
  return weights.map((w, i) => {
    if (i === weights.length - 1) return left
    const part = sum ? Math.round((totalPaise * w) / sum) : 0
    left -= part
    return part
  })
}

export function monthlyGstReport(db: VertexDB, month: string): MonthlyGstReport {
  const inMonth = (date: string) => date.slice(0, 7) === month

  /* Purchases: one row per bill and GST rate. */
  const pRows: Array<GstRow & { key: string; title: string; order: number }> = []
  const pHsn = hsnBook()
  for (const bill of (db.purchases ?? []).filter((b) => inMonth(b.date))) {
    const t = purchaseTotals(bill, db.company.gstin)
    const byRate = new Map<number, { hsn: Set<string>; items: Set<string>; taxable: number; tax: number; cgst: number; sgst: number; igst: number }>()
    bill.lines.forEach((l, i) => {
      const amount = toPaise(t.lines[i]?.amount ?? 0)
      const tax = toPaise(t.lines[i]?.tax ?? 0)
      const s = splitPaise(tax, t.supply)
      const g = byRate.get(l.gstPct) ?? { hsn: new Set<string>(), items: new Set<string>(), taxable: 0, tax: 0, cgst: 0, sgst: 0, igst: 0 }
      if (l.hsn.trim()) g.hsn.add(l.hsn.trim())
      if (l.description.trim()) g.items.add(`${l.description.trim()} (${qtyText(l.quantity)} ${l.uom})`)
      g.taxable += amount
      g.tax += tax
      g.cgst += s.cgst ?? 0
      g.sgst += s.sgst ?? 0
      g.igst += s.igst ?? 0
      byRate.set(l.gstPct, g)
      pHsn.add(l.hsn, l.description, l.uom, l.quantity, amount, { cgst: s.cgst ?? 0, sgst: s.sgst ?? 0, igst: s.igst ?? 0, gst: t.supply === null ? tax : 0 })
    })
    for (const [pct, g] of byRate) {
      pRows.push({
        key: `${pct}|${t.supply}`,
        title: sectionTitle(pct, t.supply, 'PURCHASE'),
        order: t.supply === 'intra' ? pct : 1000 + pct,
        party: bill.supplierName,
        items: [...g.items].join('; '),
        gstin: bill.supplierGstin,
        billNo: bill.supplierInvoiceNo || bill.code,
        date: bill.date,
        hsn: [...g.hsn].join(', '),
        taxable: fromPaise(g.taxable),
        cgstPct: t.supply === 'intra' ? pct / 2 : null,
        cgst: fromPaise(g.cgst),
        sgstPct: t.supply === 'intra' ? pct / 2 : null,
        sgst: fromPaise(g.sgst),
        igstPct: t.supply === 'inter' ? pct : null,
        igst: fromPaise(g.igst),
        gst: t.supply === null ? fromPaise(g.tax) : 0,
        // Round-off is a bill-level adjustment, not tax; the register shows value + tax.
        total: fromPaise(g.taxable + g.tax),
      })
    }
  }

  /* Sales: one row per issued invoice, exactly as saved. */
  const sRows: Array<GstRow & { key: string; title: string; order: number }> = []
  const sHsn = hsnBook()
  for (const inv of db.invoices.filter((i) => inMonth(i.issueDate))) {
    const supply = invoiceSupply(inv)
    const cgst = inv.cgst ?? 0
    const sgst = inv.sgst ?? 0
    const igst = inv.igst ?? 0
    const gst = supply === null ? inv.taxAmount : 0
    sRows.push({
      key: `${inv.taxPct}|${supply}`,
      title: sectionTitle(inv.taxPct, supply, 'SALES'),
      order: supply === 'inter' ? inv.taxPct : 1000 + inv.taxPct,
      party: inv.customer.company,
      items: inv.lines.map((l) => `${l.description || inv.productName} (${qtyText(l.quantity)} ${l.uom})`).join('; '),
      gstin: inv.customer.gstin,
      billNo: inv.number,
      date: inv.issueDate,
      hsn: [...new Set(inv.lines.map((l) => l.hsn.trim()).filter(Boolean))].join(', '),
      taxable: inv.taxableValue,
      cgstPct: supply === 'intra' ? (inv.cgstPct ?? inv.taxPct / 2) : null,
      cgst,
      sgstPct: supply === 'intra' ? (inv.sgstPct ?? inv.taxPct / 2) : null,
      sgst,
      igstPct: supply === 'inter' ? inv.taxPct : null,
      igst,
      gst,
      total: inv.total,
    })
    // Discount and tax are invoice-level; spread them over the lines by value.
    const weights = inv.lines.map((l) => toPaise(l.amount))
    const taxable = spread(toPaise(inv.taxableValue), weights)
    const parts = {
      cgst: spread(toPaise(cgst), weights),
      sgst: spread(toPaise(sgst), weights),
      igst: spread(toPaise(igst), weights),
      gst: spread(toPaise(gst), weights),
    }
    inv.lines.forEach((l, i) =>
      sHsn.add(l.hsn, inv.productName || l.description, l.uom, l.quantity, taxable[i], { cgst: parts.cgst[i], sgst: parts.sgst[i], igst: parts.igst[i], gst: parts.gst[i] }),
    )
  }

  return { month, label: monthLabel(month), purchases: register(pRows, pHsn.rows()), sales: register(sRows, sHsn.rows()) }
}

/* ---------------------------------- CSV ----------------------------------- */

const cell = (v: string | number | null) => {
  const s = v === null ? '' : typeof v === 'number' ? v.toFixed(2) : v
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export type ReportKind = 'purchases' | 'sales'

export const REPORT_TITLE: Record<ReportKind, string> = {
  purchases: 'Details of Purchase/Receipts',
  sales: 'Details of Sales/Payments',
}
export const PARTY_HEAD: Record<ReportKind, string> = { purchases: 'Name of the Seller', sales: 'Name of the Buyer' }
export const ITEMS_HEAD: Record<ReportKind, string> = { purchases: 'Materials purchased', sales: 'Products sold' }

/** One register as CSV (Annexure-I columns), which opens directly in Excel for the auditor. */
export function gstReportCsv(r: MonthlyGstReport, company: string, kind: ReportKind): string {
  const reg = r[kind]
  const out: string[] = []
  const row = (...cells: Array<string | number | null>) => out.push(cells.map(cell).join(','))
  const tax = (x: { cgst: number; sgst: number; igst: number; gst: number }) => x.cgst + x.sgst + x.igst + x.gst
  row(`ANNEXURE-I — ${company}`)
  row(`${REPORT_TITLE[kind]} during the month ${r.label}`)
  row('Sl. No', PARTY_HEAD[kind], ITEMS_HEAD[kind], 'Bill No', 'Date', 'GST TIN No', 'HSN/SAC', 'Goods amount', 'CGST %', 'CGST', 'SGST %', 'SGST', 'IGST %', 'IGST', 'Tax amount', 'Total')
  for (const s of reg.sections) {
    row(s.title)
    s.rows.forEach((x, i) => row(i + 1, x.party, x.items, x.billNo, x.date, x.gstin, x.hsn, x.taxable, x.cgstPct, x.cgst, x.sgstPct, x.sgst, x.igstPct, x.igst + x.gst, tax(x), x.total))
    row('', `Total for ${s.title}`, '', '', '', '', '', s.taxable, '', s.cgst, '', s.sgst, '', s.igst + s.gst, tax(s), s.total)
  }
  row('', 'Grand Total', '', '', '', '', '', reg.taxable, '', reg.cgst, '', reg.sgst, '', reg.igst + reg.gst, tax(reg), reg.total)
  return out.join('\r\n')
}
