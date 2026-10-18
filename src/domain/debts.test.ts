import { describe, expect, it } from 'vitest'
import { buildEmptyDB } from '../lib/defaults'
import { LOAN_INTEREST, balances, debtRows, debtsTable, entriesOfMonth, loansOfMonth, monthReportTable, suggestEmiSplit, summarise } from '../lib/cashbook'
import { deleteDebt, saveDebt, saveMoneyEntry } from './cashbook'
import type { MoneyDraft } from './cashbook'
import { ADMIN, NOW, ctxFor, must } from '../test/fixtures'

const out = (over: Partial<MoneyDraft>): MoneyDraft => ({ id: '', direction: 'out', date: '2026-09-20', amount: 0, mode: 'bank', category: 'Other expense', party: '', invoiceId: null, purchaseId: null, reference: '', notes: '', ...over })

describe('debts', () => {
  it('records a loan, money spent from it and paid back, and what is still owed', () => {
    let db = buildEmptyDB(NOW)
    const loan = must(saveDebt({ id: '', lender: 'Indian Bank', date: '2026-09-01', amount: 100000, purpose: 'Die-cutting machine', mode: 'bank', reference: '', notes: '' })(db, ctxFor(ADMIN[0])))
    db = loan.db
    expect(loan.value.code).toBe('DBT-0001')
    db = must(saveMoneyEntry(out({ amount: 30000, category: 'Machine repair', paidFromDebtId: loan.value.id }))(db, ctxFor(ADMIN[0]))).db
    db = must(saveMoneyEntry(out({ amount: 10000, category: 'Loan EMI', repaysDebtId: loan.value.id }))(db, ctxFor(ADMIN[0]))).db
    expect(debtRows(db)[0]).toMatchObject({ used: 30000, repaid: 10000, interest: 0, outstanding: 90000, unspent: 70000 })
    // The loan came into the cash (+1,00,000); the machine (−30,000) and the EMI (−10,000) went out.
    expect(balances(db, '2026-09').closing).toBe(60000)
    // Never repay more than is owed; a loan in use cannot be deleted.
    expect(saveMoneyEntry(out({ amount: 95000, category: 'Loan EMI', repaysDebtId: loan.value.id }))(db, ctxFor(ADMIN[0])).ok).toBe(false)
    expect(deleteDebt(loan.value.id)(db, ctxFor(ADMIN[0])).ok).toBe(false)
    expect(debtsTable(db).rows.at(-1)!.cells).toEqual(['Total', '', '', '', 100000, 30000, 10000, 0, 90000])
  })
})

describe('loans in the cash balance, and EMIs split into principal and interest', () => {
  const setup = () => {
    const loan = must(saveDebt({ id: '', lender: 'Demo Bank', date: '2026-09-02', amount: 500000, purpose: 'Machine', mode: 'bank', reference: '', notes: '', interestRatePct: 12, tenureMonths: 36, emiAmount: 16370 })(buildEmptyDB(NOW), ctxFor(ADMIN[0])))
    return { db: loan.db, loanId: loan.value.id }
  }

  it('counts the loan in the month-end balance and under its payment mode, but never as income', () => {
    const { db } = setup()
    expect(balances(db, '2026-09')).toEqual({ opening: 0, closing: 500000 })
    expect(balances(db, '2026-10').opening).toBe(500000)
    const s = summarise(entriesOfMonth(db, '2026-09'), loansOfMonth(db, '2026-09'))
    expect(s).toMatchObject({ moneyIn: 0, loanReceived: 500000, cashChange: 500000 })
    expect(s.byMode).toEqual([{ mode: 'bank', moneyIn: 500000, moneyOut: 0 }])
    expect(monthReportTable({ ...db, invoices: [], purchases: [] }, '2026-09').rows.some((r) => r.cells[3] === 'Loan received' && r.cells[7] === 500000)).toBe(true)
  })

  it('reduces what is owed by the principal only, and shows the interest as an expense', () => {
    let { db, loanId } = setup()
    // 1% a month on 5,00,000 owed → 5,000 interest, 11,370 principal.
    expect(suggestEmiSplit(db, loanId, 16370)).toEqual({ principal: 11370, interest: 5000 })
    db = must(saveMoneyEntry(out({ date: '2026-09-30', amount: 16370, category: 'Loan EMI', repaysDebtId: loanId, principal: 11370, interest: 5000 }))(db, ctxFor(ADMIN[0]))).db
    expect(debtRows(db)[0]).toMatchObject({ repaid: 11370, interest: 5000, outstanding: 488630 })
    const s = summarise(entriesOfMonth(db, '2026-09'), loansOfMonth(db, '2026-09'))
    expect(s).toMatchObject({ moneyOut: 5000, loanRepaid: 11370, balance: -5000, cashChange: 500000 - 16370 })
    expect(s.byCategory).toEqual([{ direction: 'out', category: LOAN_INTEREST, amount: 5000, count: 1 }])
    expect(balances(db, '2026-09').closing).toBe(500000 - 16370)
    // Principal + interest must equal the amount.
    expect(saveMoneyEntry(out({ amount: 16370, category: 'Loan EMI', repaysDebtId: loanId, principal: 11000, interest: 5000 }))(db, ctxFor(ADMIN[0])).ok).toBe(false)
  })

  it('treats an EMI saved before the split as all principal, until it is edited', () => {
    let { db, loanId } = setup()
    db = must(saveMoneyEntry(out({ amount: 16370, category: 'Loan EMI', repaysDebtId: loanId }))(db, ctxFor(ADMIN[0]))).db
    expect(debtRows(db)[0]).toMatchObject({ repaid: 16370, interest: 0, outstanding: 483630 })
    const emi = db.cashbook[0]
    db = must(saveMoneyEntry(out({ ...emi, id: emi.id, repaysDebtId: loanId, principal: 11370, interest: 5000, expectedUpdatedAt: emi.updatedAt }))(db, ctxFor(ADMIN[0]))).db
    expect(debtRows(db)[0]).toMatchObject({ repaid: 11370, interest: 5000, outstanding: 488630 })
  })
})
