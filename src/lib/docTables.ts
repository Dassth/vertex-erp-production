/* ---------------------------------------------------------------------------
 * Spreadsheet versions of the documents that already download as PDF, plus the
 * costing sheet. Each builder returns the shared ReportTable shape, so the
 * Excel file, the CSV file and the PDF all carry the same rows.
 * ------------------------------------------------------------------------- */

import type { CompanySnapshot, Invoice, OrderCosting, ProductionOrder, PurchaseBill } from './types'
import type { CellValue, ReportRow, ReportTable } from './reportTable'
import type { ConsolidatedStatement } from './billing'
import type { JobCard } from './jobCard'
import { purchaseTotals } from './gst'

const blank = (n: number) => Array<CellValue>(n).fill(null)
const clean = (name: string) => name.replace(/[^A-Za-z0-9-]+/g, '-')

/* --------------------------------- Invoice -------------------------------- */

export function invoiceTable(inv: Invoice): ReportTable {
  const rows: ReportRow[] = inv.lines.map((l, i) => ({
    kind: 'row',
    cells: [String(i + 1), l.description, l.hsn, l.quantity, l.uom, l.rate, l.amount],
  }))
  const total = (label: string, value: number, kind: ReportRow['kind'] = 'total') => rows.push({ kind, cells: [null, label, ...blank(4), value] })
  total('Subtotal', inv.subtotal)
  if (inv.discount) total('Less: discount', -inv.discount)
  total('Taxable value', inv.taxableValue)
  if (inv.cgst !== null) total(`CGST @ ${inv.cgstPct ?? inv.taxPct / 2}%`, inv.cgst)
  if (inv.sgst !== null) total(`SGST @ ${inv.sgstPct ?? inv.taxPct / 2}%`, inv.sgst)
  if (inv.igst !== null) total(`IGST @ ${inv.taxPct}%`, inv.igst)
  if (inv.cgst === null && inv.igst === null) total(`${inv.taxLabel} @ ${inv.taxPct}%`, inv.taxAmount)
  total('Invoice total', inv.total, 'grand')
  return {
    name: `Invoice ${clean(inv.number)}`.slice(0, 31),
    heading: [
      `TAX INVOICE ${inv.number}`,
      inv.company.name,
      `${inv.customer.company} · ${inv.issueDate} · order ${inv.refs.orderCode} · dispatch ${inv.refs.dispatchCode}`,
    ],
    columns: [
      { label: '#', width: 5 },
      { label: 'Description', width: 40, wrap: true },
      { label: 'HSN/SAC', width: 12 },
      { label: 'Quantity', width: 12, numeric: true },
      { label: 'Unit', width: 8 },
      { label: 'Rate', width: 12, numeric: true },
      { label: 'Amount', width: 14, numeric: true },
    ],
    rows,
  }
}

/* -------------------------- Cumulative invoice summary -------------------- */

export function statementTable(order: ProductionOrder, st: ConsolidatedStatement, company: string): ReportTable {
  const rows: ReportRow[] = st.invoices.map((i) => ({
    kind: 'row',
    cells: [i.number, i.issueDate, i.refs.dispatchCode || `#${i.partial.seq}`, i.partial.thisQty, i.taxableValue, i.taxAmount, i.total],
  }))
  rows.push({ kind: 'grand', cells: ['Total of listed invoices', null, null, st.invoicedQty, st.taxableValue, st.taxAmount, st.total] })
  rows.push({ kind: 'total', cells: [`Order quantity not yet covered (${order.uom})`, null, null, st.remainingQty, null, null, null] })
  return {
    name: `Summary ${clean(order.code)}`.slice(0, 31),
    heading: ['CUMULATIVE INVOICE SUMMARY', company, `${order.code} · ${order.customer.company} · not a tax invoice`],
    columns: [
      { label: 'Invoice No.', width: 20 },
      { label: 'Invoice date', width: 12 },
      { label: 'Dispatch', width: 14 },
      { label: 'Quantity', width: 12, numeric: true },
      { label: 'Taxable value', width: 14, numeric: true },
      { label: 'Tax', width: 12, numeric: true },
      { label: 'Total', width: 14, numeric: true },
    ],
    rows,
  }
}

/* ------------------------------ Purchase bill ----------------------------- */

export function purchaseBillTable(bill: PurchaseBill, company: CompanySnapshot): ReportTable {
  const t = purchaseTotals(bill, company.gstin)
  const rows: ReportRow[] = bill.lines.map((l, i) => ({
    kind: 'row',
    cells: [String(i + 1), l.description, l.hsn, l.quantity, l.uom, l.rate, l.gstPct, t.lines[i]?.amount ?? 0],
  }))
  const total = (label: string, value: number, kind: ReportRow['kind'] = 'total') => rows.push({ kind, cells: [null, label, ...blank(5), value] })
  total('Taxable value', t.taxable)
  if (t.supply === 'intra') {
    total('CGST', t.cgst)
    total('SGST', t.sgst)
  } else if (t.supply === 'inter') total('IGST', t.igst)
  else total('GST (split not set)', t.tax)
  if (bill.roundOff && t.roundOff) total('Round off', t.roundOff)
  total('Net amount', t.net, 'grand')
  return {
    name: `Purchase ${clean(bill.code)}`.slice(0, 31),
    heading: [
      `PURCHASE BILL ${bill.code}`,
      company.name,
      `${bill.supplierName}${bill.supplierInvoiceNo ? ` · bill ${bill.supplierInvoiceNo}` : ''} · ${bill.date}`,
    ],
    columns: [
      { label: '#', width: 5 },
      { label: 'Description', width: 40, wrap: true },
      { label: 'HSN/SAC', width: 12 },
      { label: 'Quantity', width: 12, numeric: true },
      { label: 'Unit', width: 8 },
      { label: 'Rate', width: 12, numeric: true },
      { label: 'GST %', width: 8, numeric: true },
      { label: 'Amount', width: 14, numeric: true },
    ],
    rows,
  }
}

/* -------------------------------- Job card -------------------------------- */

export function jobCardTable(card: JobCard): ReportTable {
  const live = card.mode === 'live'
  const rows: ReportRow[] = []
  rows.push({ kind: 'section', cells: ['PROCESS ROUTE'] })
  card.processes.forEach((p, i) =>
    rows.push({
      kind: 'row',
      cells: live
        ? [String(i + 1), p.stage, p.name, p.unit, p.person, p.machine, p.planned, p.actual, p.status, [p.problem && `Problem: ${p.problem}`, p.note && `Note: ${p.note}`].filter(Boolean).join(' | ')]
        : [String(i + 1), p.stage, p.name, p.unit, null, null, p.planned, null, null, null],
    }),
  )
  rows.push({ kind: 'section', cells: ['MATERIALS TO ISSUE'] })
  card.materials.forEach((m) => rows.push({ kind: 'row', cells: [null, m.code, m.name, m.usedIn, m.perPiece, m.required, m.issue, null, null, null] }))
  if (live && card.dispatches.length) {
    rows.push({ kind: 'section', cells: ['DISPATCH AND INVOICES'] })
    card.dispatches.forEach((d) => rows.push({ kind: 'row', cells: [null, d.code, d.date, `${d.quantity} ${card.product.uom}`, d.received, d.invoice, null, null, null, null] }))
  }
  return {
    name: `${live ? 'Live job card' : 'Job card'} ${clean(card.orderCode ?? card.plan.code)}`.slice(0, 31),
    heading: [
      live ? 'LIVE JOB CARD' : 'JOB CARD — PLAN',
      `${card.orderCode ?? card.plan.code} · ${card.customer.company} · ${card.product.name}`,
      `${card.plan.quantity} ${card.product.uom} · delivery ${card.plan.deliveryDate} · ${live ? `${card.progress.done} of ${card.progress.total} processes done` : card.plan.status}`,
    ],
    columns: [
      { label: '#', width: 5 },
      { label: 'Stage / code', width: 22 },
      { label: 'Process / material', width: 30, wrap: true },
      { label: 'Unit / used in', width: 22, wrap: true },
      { label: live ? 'Person' : '', width: 26 },
      { label: live ? 'Machine' : '', width: 26 },
      { label: 'Planned / required', width: 20 },
      { label: live ? 'Actual' : '', width: 20 },
      { label: live ? 'Status' : '', width: 14 },
      { label: live ? 'Notes' : '', width: 34, wrap: true },
    ],
    rows,
  }
}

/* --------------------------------- Costing -------------------------------- */

/** The full costing sheet, including internal cost and profit. */
export function costingTable(costing: OrderCosting, company: string): ReportTable {
  const snap = costing.snapshot
  if (!snap) throw new Error('This costing has no saved snapshot yet.')
  const r = snap.result
  const rows: ReportRow[] = []

  rows.push({ kind: 'section', cells: ['MATERIALS'] })
  for (const m of r.materialLines)
    rows.push({
      kind: 'row',
      cells: [m.code, m.name, [m.stageName, m.processName].filter(Boolean).join(' / '), m.sheet ? `${m.sheet.ups} up` : '', m.netQty, m.wastageQty, m.totalQty, m.purchaseQty, m.pricedUnitLabel, m.amount],
    })
  rows.push({ kind: 'total', cells: [null, 'Material cost', ...blank(7), r.materialCost] })

  rows.push({ kind: 'section', cells: ['PROCESSES'] })
  for (const p of r.processLines)
    rows.push({ kind: 'row', cells: [p.processId.slice(0, 8), p.processName, p.stageName, p.chargeName ?? p.basis, p.hours, p.runCost, p.setupCost, null, p.basis, p.amount] })
  rows.push({ kind: 'total', cells: [null, 'Process run cost', ...blank(7), r.processRunCost] })
  rows.push({ kind: 'total', cells: [null, 'Setup cost', ...blank(7), r.setupCost] })

  if (r.chargeLines.length) {
    rows.push({ kind: 'section', cells: ['ADDITIONAL CHARGES'] })
    for (const c of r.chargeLines) rows.push({ kind: 'row', cells: [null, c.name, c.basis, c.input, ...blank(5), c.amount] })
    rows.push({ kind: 'total', cells: [null, 'Charges', ...blank(7), r.chargesCost] })
  }

  rows.push({ kind: 'section', cells: ['TOTALS'] })
  const t = (label: string, value: CellValue, kind: ReportRow['kind'] = 'total') => rows.push({ kind, cells: [null, label, ...blank(7), value] })
  t('Total production cost', r.totalCost)
  t('Cost per piece', r.costPerPiece)
  t(`Profit (${r.profitMethod} ${r.profitPct}%)`, r.profitAmount)
  t('Selling price per piece', r.sellingPerPiece)
  t('Total selling (before tax)', r.totalSelling)
  if (r.discountAmount) t('Discount', -r.discountAmount)
  t('Taxable value', r.taxableValue)
  t(`${r.taxLabel} @ ${r.taxPct}%`, r.taxAmount)
  t('Final customer amount', r.grandTotal, 'grand')

  return {
    name: `Costing ${clean(costing.code)}`.slice(0, 31),
    heading: [
      `ORDER COSTING ${costing.code} — INTERNAL`,
      company,
      `${snap.customer.company} · ${snap.product.name} · ${r.quantity} pcs · ${snap.plan.code} · ${costing.status}${costing.finalizedAt ? ` ${costing.finalizedAt.slice(0, 10)}` : ''}`,
    ],
    columns: [
      { label: 'Code', width: 14 },
      { label: 'Item', width: 34, wrap: true },
      { label: 'Used in / stage', width: 26, wrap: true },
      { label: 'Layout / basis', width: 16 },
      { label: 'Net / hours', width: 12, numeric: true },
      { label: 'Wastage / run', width: 14, numeric: true },
      { label: 'Total qty / setup', width: 16, numeric: true },
      { label: 'Purchase qty', width: 14, numeric: true },
      { label: 'Unit', width: 12 },
      { label: 'Amount', width: 14, numeric: true },
    ],
    rows,
  }
}

/* -------------------------------- Work list ------------------------------- */

export interface WorkListRow {
  unit: string
  job: string
  customer: string
  product: string
  stage: string
  process: string
  quantity: string
  planned: string
  status: string
}

export function workListTable(rows: WorkListRow[], title: string, scope: string): ReportTable {
  return {
    name: 'Work list',
    heading: [title.toUpperCase(), scope, `${rows.length} process(es)`],
    columns: [
      { label: 'Unit', width: 10 },
      { label: 'Job', width: 20 },
      { label: 'Customer', width: 26, wrap: true },
      { label: 'Product', width: 26, wrap: true },
      { label: 'Stage / process', width: 30, wrap: true },
      { label: 'Quantity', width: 12 },
      { label: 'Planned window', width: 26 },
      { label: 'Status', width: 14 },
    ],
    rows: rows.map((r) => ({ kind: 'row', cells: [r.unit, r.job, r.customer, r.product, `${r.stage} / ${r.process}`, r.quantity, r.planned, r.status] })),
  }
}
