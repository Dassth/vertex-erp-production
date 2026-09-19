/* ---------------------------------------------------------------------------
 * Invoice report: every sales invoice or purchase bill of a month with its
 * item lines (description, HSN, quantity, rate, amount) and document totals.
 * Where the Billing (GST) report is grouped by tax rate for the return, this
 * one reads document by document, like the bill file.
 * Figures come from the saved invoices and bills only.
 * ------------------------------------------------------------------------- */

import type { VertexDB } from './types'
import { fromPaise, toPaise } from './costing'
import { purchaseTotals } from './gst'
import type { ReportKind } from './gstReport'
import { monthLabel } from './gstReport'
import type { CellValue, ReportRow, ReportTable } from './reportTable'

export interface RegisterLine {
  description: string
  hsn: string
  quantity: number
  uom: string
  rate: number
  gstPct: number
  amount: number
}

export interface RegisterDoc {
  sourceId: string
  date: string
  number: string
  party: string
  gstin: string
  lines: RegisterLine[]
  discount: number
  taxable: number
  cgst: number
  sgst: number
  igst: number
  /** Tax not split into CGST/SGST/IGST. */
  gst: number
  roundOff: number
  total: number
}

export interface InvoiceRegister {
  kind: ReportKind
  month: string
  label: string
  docs: RegisterDoc[]
  taxable: number
  tax: number
  total: number
}

export function invoiceRegister(db: VertexDB, month: string, kind: ReportKind): InvoiceRegister {
  const inMonth = (date: string) => date.slice(0, 7) === month
  const docs: RegisterDoc[] =
    kind === 'sales'
      ? db.invoices
          .filter((i) => inMonth(i.issueDate))
          .map((inv) => ({
            sourceId: inv.id,
            date: inv.issueDate,
            number: inv.number,
            party: inv.customer.company,
            gstin: inv.customer.gstin,
            lines: inv.lines.map((l) => ({ description: l.description, hsn: l.hsn, quantity: l.quantity, uom: l.uom, rate: l.rate, gstPct: inv.taxPct, amount: l.amount })),
            discount: inv.discount,
            taxable: inv.taxableValue,
            cgst: inv.cgst ?? 0,
            sgst: inv.sgst ?? 0,
            igst: inv.igst ?? 0,
            gst: inv.cgst === null && inv.igst === null ? inv.taxAmount : 0,
            roundOff: 0,
            total: inv.total,
          }))
      : (db.purchases ?? [])
          .filter((b) => inMonth(b.date))
          .map((bill) => {
            const t = purchaseTotals(bill, db.company.gstin)
            return {
              sourceId: bill.id,
              date: bill.date,
              number: bill.supplierInvoiceNo || bill.code,
              party: bill.supplierName,
              gstin: bill.supplierGstin,
              lines: bill.lines.map((l, i) => ({ description: l.description, hsn: l.hsn, quantity: l.quantity, uom: l.uom, rate: l.rate, gstPct: l.gstPct, amount: t.lines[i]?.amount ?? 0 })),
              discount: 0,
              taxable: t.taxable,
              cgst: t.cgst,
              sgst: t.sgst,
              igst: t.igst,
              gst: t.supply === null ? t.tax : 0,
              roundOff: t.roundOff,
              total: t.net,
            }
          })
  docs.sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number))
  const sum = (pick: (d: RegisterDoc) => number) => fromPaise(docs.reduce((s, d) => s + toPaise(pick(d)), 0))
  return {
    kind,
    month,
    label: monthLabel(month),
    docs,
    taxable: sum((d) => d.taxable),
    tax: sum((d) => d.cgst + d.sgst + d.igst + d.gst),
    total: sum((d) => d.total),
  }
}

export const REGISTER_TITLE: Record<ReportKind, string> = { sales: 'Sales invoice report', purchases: 'Purchase invoice report' }

/** One row per item line; a total row closes each invoice or bill. */
export function invoiceRegisterTable(r: InvoiceRegister, company: string): ReportTable {
  const rows: ReportRow[] = []
  const blank = (n: number) => Array<CellValue>(n).fill(null)
  const total = (pick: (d: RegisterDoc) => number) => fromPaise(r.docs.reduce((s, d) => s + toPaise(pick(d)), 0))
  r.docs.forEach((d, n) => {
    d.lines.forEach((l, i) =>
      rows.push({
        kind: 'row',
        cells: [i === 0 ? String(n + 1) : null, i === 0 ? d.date : null, i === 0 ? d.number : null, i === 0 ? d.party : null, i === 0 ? d.gstin : null, l.description, l.hsn, l.quantity, l.uom, l.rate, l.gstPct, l.amount, ...blank(4)],
      }),
    )
    rows.push({
      kind: 'total',
      cells: [
        null,
        null,
        null,
        `${d.number} total${d.discount ? ` (after discount ${d.discount.toFixed(2)})` : ''}${d.roundOff ? ` (round off ${d.roundOff.toFixed(2)})` : ''}`,
        ...blank(7),
        d.taxable,
        d.cgst,
        d.sgst,
        fromPaise(toPaise(d.igst) + toPaise(d.gst)),
        d.total,
      ],
    })
  })
  rows.push({ kind: 'grand', cells: [null, null, null, `Grand total — ${r.docs.length} ${r.kind === 'sales' ? 'invoice(s)' : 'bill(s)'}`, ...blank(7), r.taxable, total((d) => d.cgst), total((d) => d.sgst), total((d) => d.igst + d.gst), r.total] })
  return {
    name: `${r.kind === 'sales' ? 'Sales' : 'Purchase'} invoices ${r.label.replace('/', '-')}`,
    heading: [REGISTER_TITLE[r.kind].toUpperCase(), company, `${r.kind === 'sales' ? 'Invoices issued' : 'Bills received'} during the month ${r.label}`],
    columns: [
      { label: 'Sl. No', width: 6 },
      { label: 'Date', width: 11 },
      { label: r.kind === 'sales' ? 'Invoice No' : 'Bill No', width: 18 },
      { label: r.kind === 'sales' ? 'Buyer' : 'Seller', width: 30, wrap: true },
      { label: 'GSTIN', width: 18 },
      { label: 'Item', width: 34, wrap: true },
      { label: 'HSN/SAC', width: 11 },
      { label: 'Qty', width: 10, numeric: true },
      { label: 'Unit', width: 7 },
      { label: 'Rate', width: 10, numeric: true },
      { label: 'GST %', width: 7, numeric: true },
      { label: 'Amount', width: 13, numeric: true },
      { label: 'CGST', width: 12, numeric: true },
      { label: 'SGST', width: 12, numeric: true },
      { label: 'IGST', width: 12, numeric: true },
      { label: 'Total', width: 14, numeric: true },
    ],
    rows,
  }
}
