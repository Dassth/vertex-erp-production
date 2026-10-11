import { describe, expect, it } from 'vitest'
import { buildEmptyDB } from '../lib/defaults'
import { balances, debtRows, debtsTable } from '../lib/cashbook'
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
    expect(debtRows(db)[0]).toMatchObject({ used: 30000, repaid: 10000, outstanding: 90000, unspent: 70000 })
    // Own money: the machine was paid with the loan, the EMI with own money.
    expect(balances(db, '2026-09').closing).toBe(-10000)
    // Never repay more than is owed; a loan in use cannot be deleted.
    expect(saveMoneyEntry(out({ amount: 95000, category: 'Loan EMI', repaysDebtId: loan.value.id }))(db, ctxFor(ADMIN[0])).ok).toBe(false)
    expect(deleteDebt(loan.value.id)(db, ctxFor(ADMIN[0])).ok).toBe(false)
    expect(debtsTable(db).rows.at(-1)!.cells).toEqual(['Total', '', '', '', 100000, 30000, 10000, 90000])
  })
})
