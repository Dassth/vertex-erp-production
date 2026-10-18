/* ---------------------------------------------------------------------------
 * Income & expenses — the money side of the business.
 *
 *   Money in    receipts: customers paying invoices, other income.
 *   Money out   payments: suppliers' bills, salary, power, rent…
 *   Balance            brought forward + money in + loans received
 *                      − money out (expenses and loan repayments).
 *   Loans              principal is cash but never income; an EMI's
 *                      principal is never an expense — only its interest
 *                      ("Loan interest") is.
 *   To collect         what customers still owe on sales invoices.
 *   To pay             what we still owe suppliers on purchase bills.
 *
 * All sums are worked in integer paise and returned in rupees.
 * ------------------------------------------------------------------------- */

import type { Debt, Invoice, MoneyDirection, MoneyEntry, MoneyMode, PurchaseBill, VertexDB } from './types'
import { fromPaise, toPaise } from './costing'
import { purchaseTotals } from './gst'
import { fmtDate } from './format'
import type { CellValue, ReportTable } from './reportTable'

export const CUSTOMER_PAYMENT = 'Customer payment'
export const SUPPLIER_PAYMENT = 'Supplier payment'
export const OPENING_BALANCE = 'Opening balance'

/** The kinds of money in and out a printing unit meets every month. Any other text may be typed. */
export const CATEGORIES: Record<MoneyDirection, string[]> = {
  in: [CUSTOMER_PAYMENT, 'Advance from customer', 'Other income', OPENING_BALANCE],
  out: [SUPPLIER_PAYMENT, 'Salary & wages', 'Electricity', 'Rent', 'Loan EMI', 'Transport', 'Machine repair', 'Raw material (no bill)', 'Office expenses', 'Tax payment', 'Other expense'],
}

export const MODE_LABEL: Record<MoneyMode, string> = { cash: 'Cash', bank: 'Bank transfer', upi: 'UPI', cheque: 'Cheque' }
export const MODES: MoneyMode[] = ['cash', 'upi', 'bank', 'cheque']

const paise = (entries: MoneyEntry[]) => entries.reduce((s, e) => s + toPaise(e.amount), 0)

/** `yyyy-MM` of an ISO date. */
export const monthOf = (isoDate: string) => isoDate.slice(0, 7)

export const LOAN_INTEREST = 'Loan interest'

export interface MoneySummary {
  /** Income: every receipt (loans are not income). */
  moneyIn: number
  /** Expenses: every payment, except the principal part of loan repayments. */
  moneyOut: number
  /** moneyIn − moneyOut: income less expenses. */
  balance: number
  /** Loans received this period (cash in, not income). */
  loanReceived: number
  /** Principal paid back this period (cash out, not an expense). */
  loanRepaid: number
  /** What the cash really changed by: balance + loanReceived − loanRepaid. */
  cashChange: number
  byCategory: Array<{ direction: MoneyDirection; category: string; amount: number; count: number }>
  /** Every rupee by payment mode — loans received included. */
  byMode: Array<{ mode: MoneyMode; moneyIn: number; moneyOut: number }>
}

/**
 * The parts of a payment that pays back a loan. Entries saved before the split
 * existed count as all principal (they can be edited to split them).
 */
export function repaymentParts(e: Pick<MoneyEntry, 'amount' | 'direction' | 'repaysDebtId' | 'principal' | 'interest'>): { principal: number; interest: number } {
  if (e.direction !== 'out' || !e.repaysDebtId) return { principal: 0, interest: 0 }
  const total = toPaise(e.amount)
  const interest = e.interest !== null && e.interest !== undefined && Number.isFinite(e.interest) ? Math.min(total, Math.max(0, toPaise(e.interest))) : 0
  return { principal: fromPaise(total - interest), interest: fromPaise(interest) }
}

export function summarise(entries: MoneyEntry[], loans: Debt[] = []): MoneySummary {
  const ins = entries.filter((e) => e.direction === 'in')
  const outs = entries.filter((e) => e.direction === 'out')
  const groups = new Map<string, MoneySummary['byCategory'][number] & { p: number }>()
  const add = (direction: MoneyDirection, category: string, p: number) => {
    const key = `${direction}|${category}`
    const g = groups.get(key) ?? { direction, category, amount: 0, count: 0, p: 0 }
    g.p += p
    g.count += 1
    groups.set(key, g)
  }
  let expenses = 0
  let repaid = 0
  for (const e of ins) add('in', e.category, toPaise(e.amount))
  for (const e of outs) {
    if (e.repaysDebtId) {
      // An EMI: only the interest is an expense; the principal reduces the loan.
      const parts = repaymentParts(e)
      repaid += toPaise(parts.principal)
      if (parts.interest) {
        add('out', LOAN_INTEREST, toPaise(parts.interest))
        expenses += toPaise(parts.interest)
      }
    } else {
      add('out', e.category, toPaise(e.amount))
      expenses += toPaise(e.amount)
    }
  }
  const byCategory = [...groups.values()]
    .map(({ p, ...g }) => ({ ...g, amount: fromPaise(p) }))
    .sort((a, b) => (a.direction === b.direction ? b.amount - a.amount : a.direction === 'in' ? -1 : 1))
  const received = loans.reduce((n, l) => n + toPaise(l.amount), 0)
  const byMode = MODES.map((mode) => ({
    mode,
    moneyIn: fromPaise(paise(ins.filter((e) => e.mode === mode)) + loans.filter((l) => l.mode === mode).reduce((n, l) => n + toPaise(l.amount), 0)),
    moneyOut: fromPaise(paise(outs.filter((e) => e.mode === mode))),
  })).filter((m) => m.moneyIn || m.moneyOut)
  const income = paise(ins)
  return {
    moneyIn: fromPaise(income),
    moneyOut: fromPaise(expenses),
    balance: fromPaise(income - expenses),
    loanReceived: fromPaise(received),
    loanRepaid: fromPaise(repaid),
    cashChange: fromPaise(income + received - paise(outs)),
    byCategory,
    byMode,
  }
}

/** Loans received in one month. */
export function loansOfMonth(db: { debts?: Debt[] }, month: string): Debt[] {
  return (db.debts ?? []).filter((d) => monthOf(d.date) === month)
}

/** Entries of one month, newest first. */
export function entriesOfMonth(db: Pick<VertexDB, 'cashbook'>, month: string): MoneyEntry[] {
  return (db.cashbook ?? []).filter((e) => monthOf(e.date) === month).sort((a, b) => b.date.localeCompare(a.date) || b.code.localeCompare(a.code))
}

/**
 * Balance carried in from every month before `month`, and the balance at its
 * end: every receipt and every loan received in, every payment out (loan
 * repayments and money spent from a loan included — the loan came in first).
 */
export function balances(db: Pick<VertexDB, 'cashbook'> & { debts?: Debt[] }, month: string): { opening: number; closing: number } {
  const all = db.cashbook ?? []
  const signed = (e: MoneyEntry) => (e.direction === 'in' ? 1 : -1) * toPaise(e.amount)
  const loans = (before: (m: string) => boolean) => (db.debts ?? []).filter((d) => before(monthOf(d.date))).reduce((s, d) => s + toPaise(d.amount), 0)
  const opening = all.filter((e) => monthOf(e.date) < month).reduce((s, e) => s + signed(e), 0) + loans((m) => m < month)
  const closing = all.filter((e) => monthOf(e.date) <= month).reduce((s, e) => s + signed(e), 0) + loans((m) => m <= month)
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
      const total = purchaseTotals(bill, db.company).net
      const settled = paidFor(db, bill.id, except)
      return { record: bill, total, settled, due: fromPaise(toPaise(total) - toPaise(settled)) }
    })
    .filter((d) => all || d.due > 0)
    .sort((a, b) => a.record.date.localeCompare(b.record.date))
}

export const sumDue = <T,>(list: Array<Due<T>>) => fromPaise(list.reduce((s, d) => s + toPaise(d.due), 0))

/** A sale or purchase of a month whose money is not recorded in full yet. */
export interface MonthDoc {
  id: string
  /** Invoice number or purchase bill code. */
  number: string
  date: string
  party: string
  /** Rupees still not recorded against it. */
  due: number
}

/**
 * The month's sales invoices and purchase bills that still have money due —
 * what "Add this month's sales & purchases" records, one entry each. Anything
 * already recorded is left out, so pressing it again adds nothing twice.
 */
export function monthDocsToRecord(db: Pick<VertexDB, 'cashbook' | 'invoices' | 'purchases' | 'company'>, month: string): { sales: MonthDoc[]; purchases: MonthDoc[] } {
  return {
    sales: toCollect(db)
      .filter((d) => monthOf(d.record.issueDate) === month)
      .map((d) => ({ id: d.record.id, number: d.record.number, date: d.record.issueDate, party: d.record.customer.company, due: d.due })),
    purchases: toPay(db)
      .filter((d) => monthOf(d.record.date) === month)
      .map((d) => ({ id: d.record.id, number: d.record.supplierInvoiceNo ? `${d.record.code} (${d.record.supplierInvoiceNo})` : d.record.code, date: d.record.date, party: d.record.supplierName, due: d.due })),
  }
}

/** The month's report — the same rows in the Excel file and the PDF: balance brought forward, every entry oldest first, totals and month-end balance. */
export function monthReportTable(db: Pick<VertexDB, 'cashbook' | 'invoices' | 'purchases' | 'company'> & { debts?: Debt[] }, month: string): ReportTable {
  const entries = [...entriesOfMonth(db, month)].reverse()
  const loans = loansOfMonth(db, month)
  const s = summarise(entries, loans)
  const b = balances(db, month)
  const [y, m] = month.split('-').map(Number)
  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  const doc = (e: MoneyEntry) => (e.invoiceId ? db.invoices.find((i) => i.id === e.invoiceId)?.number : e.purchaseId ? (db.purchases ?? []).find((p) => p.id === e.purchaseId)?.code : '') ?? ''
  const line = (label: string, moneyIn: number | null, moneyOut: number | null) => [label, '', '', '', '', '', '', moneyIn, moneyOut]
  // Loans received are listed with the entries, in date order.
  const lines = [
    ...entries.map((e) => ({ date: e.date, cells: [fmtDate(e.date), e.code, e.direction === 'in' ? 'In' : 'Out', e.repaysDebtId ? `${e.category}${repaymentParts(e).interest ? ` (principal ${repaymentParts(e).principal.toFixed(2)} + interest ${repaymentParts(e).interest.toFixed(2)})` : ''}` : e.category, e.party, MODE_LABEL[e.mode], doc(e), e.direction === 'in' ? e.amount : null, e.direction === 'out' ? e.amount : null] as CellValue[] })),
    ...loans.map((l) => ({ date: l.date, cells: [fmtDate(l.date), l.code, 'In', 'Loan received', l.lender, MODE_LABEL[l.mode], '', l.amount, null] as CellValue[] })),
  ].sort((a, b) => a.date.localeCompare(b.date))
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
      ...lines.map((l) => ({ kind: 'row' as const, cells: l.cells })),
      { kind: 'grand', cells: line('Cash in / out this month', fromPaise(toPaise(s.moneyIn) + toPaise(s.loanReceived)), fromPaise(toPaise(s.moneyOut) + toPaise(s.loanRepaid))) },
      ...(s.loanReceived || s.loanRepaid
        ? [
            { kind: 'total' as const, cells: line('— of which loan received / loan repaid (principal)', s.loanReceived || null, s.loanRepaid || null) },
            { kind: 'total' as const, cells: line('— income / expenses', s.moneyIn, s.moneyOut) },
          ]
        : []),
      { kind: 'total', cells: line('Income − expenses this month', s.balance, null) },
      { kind: 'total', cells: line('Balance at month end', b.closing, null) },
    ],
  }
}

/* --------------------------------- Debts ---------------------------------- */

/** Principal already paid back on a loan (optionally leaving out one entry being edited). Interest does not reduce what is owed. */
export function repaidFor(db: Pick<VertexDB, 'cashbook'>, debtId: string, exceptEntryId?: string): number {
  return (db.cashbook ?? []).filter((m) => m.direction === 'out' && m.repaysDebtId === debtId && m.id !== exceptEntryId).reduce((n, m) => n + toPaise(repaymentParts(m).principal), 0) / 100
}

/** Interest paid on a loan so far. */
export function interestFor(db: Pick<VertexDB, 'cashbook'>, debtId: string): number {
  return (db.cashbook ?? []).filter((m) => m.direction === 'out' && m.repaysDebtId === debtId).reduce((n, m) => n + toPaise(repaymentParts(m).interest), 0) / 100
}

/**
 * The split a loan's own terms suggest for its next EMI: interest = what is
 * still owed × the monthly rate; the rest of the amount is principal.
 * Null when the loan has no interest rate.
 */
export function suggestEmiSplit(db: Pick<VertexDB, 'cashbook'> & { debts?: Debt[] }, debtId: string, amount: number, exceptEntryId?: string): { principal: number; interest: number } | null {
  const debt = (db.debts ?? []).find((d) => d.id === debtId)
  if (!debt || !debt.interestRatePct || !(amount > 0)) return null
  const owed = toPaise(debt.amount) - toPaise(repaidFor(db, debtId, exceptEntryId))
  const interest = Math.min(toPaise(amount), Math.max(0, Math.round((owed * debt.interestRatePct) / 1200)))
  return { principal: fromPaise(toPaise(amount) - interest), interest: fromPaise(interest) }
}

export interface DebtRow {
  debt: Debt
  /** Spent from this loan's money. */
  used: number
  /** Principal paid back. */
  repaid: number
  /** Interest paid (an expense, not a reduction of the loan). */
  interest: number
  /** Still owed. */
  outstanding: number
  /** Borrowed money not spent yet. */
  unspent: number
}

export function debtRows(db: Pick<VertexDB, 'cashbook'> & { debts?: Debt[] }): DebtRow[] {
  return [...(db.debts ?? [])]
    .sort((a, b) => b.date.localeCompare(a.date) || b.code.localeCompare(a.code))
    .map((debt) => {
      const used = (db.cashbook ?? []).filter((m) => m.direction === 'out' && m.paidFromDebtId === debt.id).reduce((n, m) => n + toPaise(m.amount), 0) / 100
      const repaid = repaidFor(db, debt.id)
      return { debt, used, repaid, interest: interestFor(db, debt.id), outstanding: (toPaise(debt.amount) - toPaise(repaid)) / 100, unspent: (toPaise(debt.amount) - toPaise(used)) / 100 }
    })
}

export function debtsTable(db: Pick<VertexDB, 'cashbook' | 'company'> & { debts?: Debt[] }): ReportTable {
  const rows = debtRows(db)
  const sum = (k: 'used' | 'repaid' | 'interest' | 'outstanding') => rows.reduce((n, r) => n + toPaise(r[k]), 0) / 100
  const borrowed = rows.reduce((n, r) => n + toPaise(r.debt.amount), 0) / 100
  return {
    name: 'Debts',
    internal: true,
    heading: [db.company.name, 'Debts — money borrowed'],
    columns: [
      { label: 'Date', width: 12 },
      { label: 'No.', width: 11 },
      { label: 'Borrowed from', width: 24, wrap: true },
      { label: 'For', width: 26, wrap: true },
      { label: 'Borrowed', width: 14, numeric: true },
      { label: 'Spent from it', width: 14, numeric: true },
      { label: 'Principal paid back', width: 14, numeric: true },
      { label: 'Interest paid', width: 14, numeric: true },
      { label: 'Still owed', width: 14, numeric: true },
    ],
    rows: [
      ...rows.map((r) => ({ kind: 'row' as const, cells: [fmtDate(r.debt.date), r.debt.code, r.debt.lender, r.debt.purpose, r.debt.amount, r.used, r.repaid, r.interest, r.outstanding] })),
      { kind: 'grand' as const, cells: ['Total', '', '', '', borrowed, sum('used'), sum('repaid'), sum('interest'), sum('outstanding')] },
    ],
  }
}
