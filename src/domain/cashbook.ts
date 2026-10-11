import type { Debt, MoneyDirection, MoneyEntry, MoneyMode, VertexDB } from '../lib/types'
import { toPaise } from '../lib/costing'
import { CUSTOMER_PAYMENT, MODES, SUPPLIER_PAYMENT, paidFor, receivedFor, repaidFor } from '../lib/cashbook'
import { purchaseTotals } from '../lib/gst'
import { audit, command, docCode, fail, hasFieldErrors, isIsoDate, nextSeq, ok, requireCapability, stampNew, stampUpdate, staleRecord, validationFailure } from './common'
import type { Op } from './common'

/* ---------------------------------------------------------------------------
 * Income & expenses. A receipt records money that came in, a
 * payment money that went out. A receipt may settle a sales invoice and a
 * payment a purchase bill — never for more than is still due. Every change
 * is audited; deleting an entry needs the billing capability like any other.
 * ------------------------------------------------------------------------- */

export interface MoneyDraft {
  /** Empty for a new entry. */
  id: string
  direction: MoneyDirection
  date: string
  amount: number
  mode: MoneyMode
  category: string
  party: string
  invoiceId: string | null
  purchaseId: string | null
  reference: string
  notes: string
  /** Money out paid with a loan's money; null/omitted = own money (income). */
  paidFromDebtId?: string | null
  /** Money out that pays back this loan. */
  repaysDebtId?: string | null
  expectedUpdatedAt?: string | null
}

const rupees = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function validateMoney(d: MoneyDraft, db: Pick<VertexDB, 'cashbook' | 'invoices' | 'purchases' | 'company'> & { debts?: Debt[] }): Record<string, string> {
  const e: Record<string, string> = {}
  if (d.direction !== 'in' && d.direction !== 'out') e.direction = 'Choose money in or money out.'
  if (!isIsoDate(d.date)) e.date = 'Enter the date.'
  if (!(Number.isFinite(d.amount) && d.amount > 0)) e.amount = 'Enter an amount more than 0.'
  else if (Math.abs(d.amount * 100 - Math.round(d.amount * 100)) > 1e-6) e.amount = 'Use at most two decimals (paise).'
  if (!MODES.includes(d.mode)) e.mode = 'Choose cash, UPI, bank transfer or cheque.'
  if (!d.category.trim()) e.category = 'Choose what this money is for.'

  if (d.direction === 'in' && d.invoiceId) {
    const inv = db.invoices.find((i) => i.id === d.invoiceId)
    if (!inv) e.invoiceId = 'That invoice no longer exists.'
    else if (!e.amount) {
      const due = toPaise(inv.total) - toPaise(receivedFor(db, inv.id, d.id || undefined))
      if (toPaise(d.amount) > due) e.amount = `Only ${rupees(due / 100)} is still due on ${inv.number}.`
    }
  }
  if (d.direction === 'out' && d.purchaseId) {
    const bill = (db.purchases ?? []).find((p) => p.id === d.purchaseId)
    if (!bill) e.purchaseId = 'That purchase bill no longer exists.'
    else if (!e.amount) {
      const due = toPaise(purchaseTotals(bill, db.company.gstin).net) - toPaise(paidFor(db, bill.id, d.id || undefined))
      if (toPaise(d.amount) > due) e.amount = `Only ${rupees(due / 100)} is still due on ${bill.code}.`
    }
  }
  if (d.direction === 'out' && d.paidFromDebtId && !(db.debts ?? []).some((x) => x.id === d.paidFromDebtId)) e.paidFromDebtId = 'That loan no longer exists.'
  if (d.direction === 'out' && d.repaysDebtId) {
    const debt = (db.debts ?? []).find((x) => x.id === d.repaysDebtId)
    if (!debt) e.repaysDebtId = 'That loan no longer exists.'
    else if (!e.amount) {
      const owed = toPaise(debt.amount) - toPaise(repaidFor(db, debt.id, d.id || undefined))
      if (toPaise(d.amount) > owed) e.amount = `Only ${rupees(owed / 100)} is still owed on ${debt.code} (${debt.lender}).`
    }
  }
  if (!d.party.trim() && !d.invoiceId && !d.purchaseId && (d.category === CUSTOMER_PAYMENT || d.category === SUPPLIER_PAYMENT))
    e.party = d.direction === 'in' ? 'Enter who paid, or choose the invoice.' : 'Enter whom you paid, or choose the bill.'
  return e
}

/** The stored shape: links only on the side they belong to, party taken from the linked document when left blank. */
function clean(d: MoneyDraft, db: Pick<VertexDB, 'invoices' | 'purchases'>) {
  const invoiceId = d.direction === 'in' ? d.invoiceId || null : null
  const purchaseId = d.direction === 'out' ? d.purchaseId || null : null
  const linkedParty = invoiceId
    ? db.invoices.find((i) => i.id === invoiceId)?.customer.company
    : purchaseId
      ? (db.purchases ?? []).find((p) => p.id === purchaseId)?.supplierName
      : undefined
  return {
    direction: d.direction,
    date: d.date,
    amount: toPaise(d.amount) / 100,
    mode: d.mode,
    category: d.category.trim(),
    party: d.party.trim() || linkedParty || '',
    invoiceId,
    purchaseId,
    reference: d.reference.trim(),
    notes: d.notes.trim(),
    paidFromDebtId: d.direction === 'out' ? d.paidFromDebtId || null : null,
    repaysDebtId: d.direction === 'out' ? d.repaysDebtId || null : null,
  }
}

const labelOf = (m: MoneyEntry) => `${m.code} — ${m.category}${m.party ? ` · ${m.party}` : ''}`

export const saveMoneyEntry = command(
  'saveMoneyEntry',
  (draft: MoneyDraft): Op<MoneyEntry> =>
    (db, ctx) => {
      const denied = requireCapability(ctx, 'billing')
      if (denied) return denied
      const book = db.cashbook ?? []
      const current = draft.id ? book.find((m) => m.id === draft.id) : undefined
      if (draft.id && !current) return fail('This entry no longer exists.')
      if (current && current.direction !== draft.direction) return fail('Money in cannot be changed to money out. Delete the entry and record it again.')
      const errors = validateMoney(draft, db)
      if (hasFieldErrors(errors)) return validationFailure(errors)

      if (current) {
        const stale = staleRecord(current.code, current, draft.expectedUpdatedAt)
        if (stale) return stale
        const updated: MoneyEntry = stampUpdate({ ...current, ...clean(draft, db) }, ctx)
        let next = { ...db, cashbook: book.map((m) => (m.id === current.id ? updated : m)) }
        next = audit(next, ctx, {
          action: updated.direction === 'in' ? 'Receipt edited' : 'Payment edited',
          entity: 'Money',
          entityId: updated.id,
          entityLabel: labelOf(updated),
          field: 'Amount',
          oldValue: current.amount.toFixed(2),
          newValue: updated.amount.toFixed(2),
        })
        return ok(next, updated)
      }

      const key = draft.direction === 'in' ? 'receipt' : 'payment'
      const [counted, seq] = nextSeq(db, key)
      const entry: MoneyEntry = {
        id: ctx.newId(draft.direction === 'in' ? 'RCT' : 'PAY'),
        code: docCode(draft.direction === 'in' ? 'RCT' : 'PAY', seq),
        ...clean(draft, db),
        ...stampNew(ctx),
      }
      let next = { ...counted, cashbook: [...book, entry] }
      next = audit(next, ctx, {
        action: entry.direction === 'in' ? 'Money received' : 'Money paid',
        entity: 'Money',
        entityId: entry.id,
        entityLabel: labelOf(entry),
        field: 'Amount',
        newValue: entry.amount.toFixed(2),
      })
      return ok(next, entry)
    },
)

export const deleteMoneyEntry = command(
  'deleteMoneyEntry',
  (id: string): Op<null> =>
    (db, ctx) => {
      const denied = requireCapability(ctx, 'billing')
      if (denied) return denied
      const entry = (db.cashbook ?? []).find((m) => m.id === id)
      if (!entry) return fail('This entry no longer exists.')
      let next = { ...db, cashbook: db.cashbook.filter((m) => m.id !== id) }
      next = audit(next, ctx, {
        action: entry.direction === 'in' ? 'Receipt deleted' : 'Payment deleted',
        entity: 'Money',
        entityId: entry.id,
        entityLabel: labelOf(entry),
        oldValue: `${entry.date}, ${entry.amount.toFixed(2)}`,
      })
      return ok(next, null)
    },
)

/* --------------------------------- Debts ---------------------------------- */

export interface DebtDraft {
  id: string
  lender: string
  date: string
  amount: number
  purpose: string
  mode: MoneyMode
  reference: string
  notes: string
  expectedUpdatedAt?: string | null
}

export function validateDebt(d: DebtDraft, db: Pick<VertexDB, 'cashbook'>): Record<string, string> {
  const e: Record<string, string> = {}
  if (!d.lender.trim()) e.lender = 'Enter whom the money was borrowed from.'
  if (!isIsoDate(d.date)) e.date = 'Enter the date it was borrowed.'
  if (!(Number.isFinite(d.amount) && d.amount > 0)) e.amount = 'Enter an amount more than 0.'
  else if (Math.abs(d.amount * 100 - Math.round(d.amount * 100)) > 1e-6) e.amount = 'Use at most two decimals (paise).'
  else if (d.id && toPaise(d.amount) < toPaise(repaidFor(db, d.id))) e.amount = `${rupees(repaidFor(db, d.id))} is already paid back — the loan cannot be less.`
  if (!MODES.includes(d.mode)) e.mode = 'Choose cash, UPI, bank transfer or cheque.'
  return e
}

const debtLabel = (x: Debt) => `${x.code} — ${x.lender}`

export const saveDebt = command(
  'saveDebt',
  (draft: DebtDraft): Op<Debt> =>
    (db, ctx) => {
      const denied = requireCapability(ctx, 'billing')
      if (denied) return denied
      const list = db.debts ?? []
      const current = draft.id ? list.find((x) => x.id === draft.id) : undefined
      if (draft.id && !current) return fail('This loan no longer exists.')
      const errors = validateDebt(draft, db)
      if (hasFieldErrors(errors)) return validationFailure(errors)
      const fields = {
        lender: draft.lender.trim(),
        date: draft.date,
        amount: toPaise(draft.amount) / 100,
        purpose: draft.purpose.trim(),
        mode: draft.mode,
        reference: draft.reference.trim(),
        notes: draft.notes.trim(),
      }
      if (current) {
        const stale = staleRecord(current.code, current, draft.expectedUpdatedAt)
        if (stale) return stale
        const updated: Debt = stampUpdate({ ...current, ...fields }, ctx)
        const next = audit({ ...db, debts: list.map((x) => (x.id === current.id ? updated : x)) }, ctx, {
          action: 'Loan edited',
          entity: 'Debt',
          entityId: updated.id,
          entityLabel: debtLabel(updated),
          field: 'Amount',
          oldValue: current.amount.toFixed(2),
          newValue: updated.amount.toFixed(2),
        })
        return ok(next, updated)
      }
      const [counted, seq] = nextSeq(db, 'debt')
      const debt: Debt = { id: ctx.newId('DBT'), code: docCode('DBT', seq), ...fields, ...stampNew(ctx) }
      const next = audit({ ...counted, debts: [...list, debt] }, ctx, {
        action: 'Loan recorded',
        entity: 'Debt',
        entityId: debt.id,
        entityLabel: debtLabel(debt),
        field: 'Amount',
        newValue: debt.amount.toFixed(2),
      })
      return ok(next, debt)
    },
)

/** A loan can be removed only while nothing is paid from it or back to it. */
export const deleteDebt = command(
  'deleteDebt',
  (id: string): Op<null> =>
    (db, ctx) => {
      const denied = requireCapability(ctx, 'billing')
      if (denied) return denied
      const debt = (db.debts ?? []).find((x) => x.id === id)
      if (!debt) return fail('This loan no longer exists.')
      const linked = (db.cashbook ?? []).filter((m) => m.paidFromDebtId === id || m.repaysDebtId === id)
      if (linked.length) return fail(`${linked.length} money-out entr${linked.length === 1 ? 'y uses' : 'ies use'} this loan (${linked.map((m) => m.code).slice(0, 5).join(', ')}). Change or delete those first.`)
      const next = audit({ ...db, debts: db.debts.filter((x) => x.id !== id) }, ctx, {
        action: 'Loan deleted',
        entity: 'Debt',
        entityId: debt.id,
        entityLabel: debtLabel(debt),
        oldValue: `${debt.date}, ${debt.amount.toFixed(2)}`,
      })
      return ok(next, null)
    },
)
