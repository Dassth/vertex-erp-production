/* ---------------------------------------------------------------------------
 * Income & expenses — the money side of the business.
 *
 *   Money in    receipts: customers paying invoices, other income.
 *   Money out   payments: suppliers' bills, salary, power, rent…
 *   Balance            money in − money out.
 *   To collect         what customers still owe on sales invoices.
 *   To pay             what we still owe suppliers on purchase bills.
 *
 * All sums are worked in integer paise and returned in rupees.
 * ------------------------------------------------------------------------- */

import type { Invoice, MoneyDirection, MoneyEntry, MoneyMode, PurchaseBill, VertexDB } from './types'
import { fromPaise, toPaise } from './costing'
import { purchaseTotals } from './gst'
import { fmtDate } from './format'
import type { ReportTable } from './reportTable'

export const CUSTOMER_PAYMENT = 'Customer payment'
export const SUPPLIER_PAYMENT = 'Supplier payment'
export const OPENING_BALANCE = 'Opening balance'

/** The kinds of money in and out a printing unit meets every month. Any other text may be typed. */
export const CATEGORIES: Record<MoneyDirection, string[]> = {
  in: [CUSTOMER_PAYMENT, 'Advance from customer', 'Other income', OPENING_BALANCE],
  out: [SUPPLIER_PAYMENT, 'Salary & wages', 'Electricity', 'Rent', 'Transport', 'Machine repair', 'Raw material (no bill)', 'Office expenses', 'Tax payment', 'Other expense'],
}

export const MODE_LABEL: Record<MoneyMode, string> = { cash: 'Cash', bank: 'Bank transfer', upi: 'UPI', cheque: 'Cheque' }
export const MODES: MoneyMode[] = ['cash', 'upi', 'bank', 'cheque']

const paise = (entries: MoneyEntry[]) => entries.reduce((s, e) => s + toPaise(e.amount), 0)

/** `yyyy-MM` of an ISO date. */
export const monthOf = (isoDate: string) => isoDate.slice(0, 7)

export interface MoneySummary {
  moneyIn: number
  moneyOut: number
  /** moneyIn − moneyOut. */
  balance: number
  byCategory: Array<{ direction: MoneyDirection; category: string; amount: number; count: number }>
  byMode: Array<{ mode: MoneyMode; moneyIn: number; moneyOut: number }>
}

export function summarise(entries: MoneyEntry[]): MoneySummary {
  const ins = entries.filter((e) => e.direction === 'in')
  const outs = entries.filter((e) => e.direction === 'out')
  const groups = new Map<string, MoneySummary['byCategory'][number] & { p: number }>()
  for (const e of entries) {
    const key = `${e.direction}|${e.category}`
    const g = groups.get(key) ?? { direction: e.direction, category: e.category, amount: 0, count: 0, p: 0 }
    g.p += toPaise(e.amount)
    g.count += 1
    groups.set(key, g)
  }
  const byCategory = [...groups.values()]
    .map(({ p, ...g }) => ({ ...g, amount: fromPaise(p) }))
    .sort((a, b) => (a.direction === b.direction ? b.amount - a.amount : a.direction === 'in' ? -1 : 1))
  const byMode = MODES.map((mode) => ({
    mode,
    moneyIn: fromPaise(paise(ins.filter((e) => e.mode === mode))),
    moneyOut: fromPaise(paise(outs.filter((e) => e.mode === mode))),
  })).filter((m) => m.moneyIn || m.moneyOut)
  return { moneyIn: fromPaise(paise(ins)), moneyOut: fromPaise(paise(outs)), balance: fromPaise(paise(ins) - paise(outs)), byCategory, byMode }
}

/** Entries of one month, newest first. */
export function entriesOfMonth(db: Pick<VertexDB, 'cashbook'>, month: string): MoneyEntry[] {
  return (db.cashbook ?? []).filter((e) => monthOf(e.date) === month).sort((a, b) => b.date.localeCompare(a.date) || b.code.localeCompare(a.code))
}

/** Balance carried in from every month before `month`, and the balance at its end. */
export function balances(db: Pick<VertexDB, 'cashbook'>, month: string): { opening: number; closing: number } {
  const all = db.cashbook ?? []
  const signed = (e: MoneyEntry) => (e.direction === 'in' ? 1 : -1) * toPaise(e.amount)
  const opening = all.filter((e) => monthOf(e.date) < month).reduce((s, e) => s + signed(e), 0)
  const closing = all.filter((e) => monthOf(e.date) <= month).reduce((s, e) => s + signed(e), 0)
  return { opening: fromPaise(opening), closing: fromPaise(closing) }
}

export interface Due<T> {
  record: T
  total: number
  settled: number
  due: number
}

/** Received so far against one sales invoice. `except` leaves out an entry being edited. */
export function receivedFor(db: Pick<VertexDB, 'cashbook'>, invoiceId: string, except?: string): number {
  return fromPaise(paise((db.cashbook ?? []).filter((e) => e.direction === 'in' && e.invoiceId === invoiceId && e.id !== except)))
}

/** Paid so far against one purchase bill. `except` leaves out an entry being edited. */
export function paidFor(db: Pick<VertexDB, 'cashbook'>, purchaseId: string, except?: string): number {
  return fromPaise(paise((db.cashbook ?? []).filter((e) => e.direction === 'out' && e.purchaseId === purchaseId && e.id !== except)))
}

/** Every sales invoice with its amount still to collect; fully paid ones are left out unless `all`. */
export function toCollect(db: Pick<VertexDB, 'cashbook' | 'invoices'>, all = false, except?: string): Array<Due<Invoice>> {
  return db.invoices
    .map((inv) => {
      const settled = receivedFor(db, inv.id, except)
      return { record: inv, total: inv.total, settled, due: fromPaise(toPaise(inv.total) - toPaise(settled)) }
    })
    .filter((d) => all || d.due > 0)
    .sort((a, b) => a.record.issueDate.localeCompare(b.record.issueDate))
}

/** Every purchase bill with its amount still to pay; fully paid ones are left out unless `all`. */
export function toPay(db: Pick<VertexDB, 'cashbook' | 'purchases' | 'company'>, all = false, except?: string): Array<Due<PurchaseBill>> {
  return (db.purchases ?? [])
    .map((bill) => {
      const total = purchaseTotals(bill, db.company.gstin).net
      const settled = paidFor(db, bill.id, except)
      return { record: bill, total, settled, due: fromPaise(toPaise(total) - toPaise(settled)) }
    })
    .filter((d) => all || d.due > 0)
    .sort((a, b) => a.record.date.localeCompare(b.record.date))
}

export const sumDue = <T,>(list: Array<Due<T>>) => fromPaise(list.reduce((s, d) => s + toPaise(d.due), 0))

/** The month's report — the same rows in the Excel file and the PDF: balance brought forward, every entry oldest first, totals and month-end balance. */
export function monthReportTable(db: Pick<VertexDB, 'cashbook' | 'invoices' | 'purchases' | 'company'>, month: string): ReportTable {
  const entries = [...entriesOfMonth(db, month)].reverse()
  const s = summarise(entries)
  const b = balances(db, month)
  const [y, m] = month.split('-').map(Number)
  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  const doc = (e: MoneyEntry) => (e.invoiceId ? db.invoices.find((i) => i.id === e.invoiceId)?.number : e.purchaseId ? (db.purchases ?? []).find((p) => p.id === e.purchaseId)?.code : '') ?? ''
  const line = (label: string, moneyIn: number | null, moneyOut: number | null) => [label, '', '', '', '', '', '', moneyIn, moneyOut]
  return {
    name: `Income & expenses ${month}`,
    internal: true,
    heading: [db.company.name, `Income & expenses — ${monthLabel}`],
    columns: [
      { label: 'Date', width: 12 },
      { label: 'No.', width: 11 },
      { label: 'In / Out', width: 9 },
      { label: 'Kind', width: 22, wrap: true },
      { label: 'Party', width: 26, wrap: true },
      { label: 'Mode', width: 13 },
      { label: 'Invoice / bill', width: 18 },
      { label: 'Money in', width: 14, numeric: true },
      { label: 'Money out', width: 14, numeric: true },
    ],
    rows: [
      { kind: 'total', cells: line('Balance brought forward', b.opening, null) },
      ...entries.map((e) => ({
        kind: 'row' as const,
        cells: [fmtDate(e.date), e.code, e.direction === 'in' ? 'In' : 'Out', e.category, e.party, MODE_LABEL[e.mode], doc(e), e.direction === 'in' ? e.amount : null, e.direction === 'out' ? e.amount : null],
      })),
      { kind: 'grand', cells: line('Total this month', s.moneyIn, s.moneyOut) },
      { kind: 'total', cells: line('This month (in − out)', s.balance, null) },
      { kind: 'total', cells: line('Balance at month end', b.closing, null) },
    ],
  }
}
