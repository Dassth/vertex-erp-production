import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { writeFileSync } from 'node:fs'
import type { TDocumentDefinitions } from 'pdfmake/interfaces'
import { FONT_FAMILY, reportTableDefinition } from '../lib/pdfDocs'
import type { Invoice, VertexDB } from '../lib/types'
import { buildEmptyDB } from '../lib/defaults'
import { normalizeDB } from '../lib/db'
import { balances, entriesOfMonth, monthReportTable, summarise, sumDue, toCollect, toPay } from '../lib/cashbook'
import { ADMIN, RETIRED_UNIT, ctxFor, must } from '../test/fixtures'
import { savePurchaseBill } from './purchases'
import { deleteMoneyEntry, saveMoneyEntry } from './cashbook'
import type { MoneyDraft } from './cashbook'

/* Income & expenses: money in, money out, and what is still due either way. */

const admin = () => ctxFor(ADMIN[0])

/** A database with one ₹11,800 sales invoice and one ₹5,900 purchase bill. */
function books(): { db: VertexDB; invoiceId: string; billId: string } {
  const invoice = { id: 'INV-1', number: 'INV/2026-27/0001', issueDate: '2026-09-10', total: 11800, customer: { company: 'Apex Industries' } } as unknown as Invoice
  const base = { ...buildEmptyDB(new Date('2026-09-01T09:00:00')), invoices: [invoice] }
  const bill = must(
    savePurchaseBill({
      id: '',
      supplierName: 'Paper Corporation',
      supplierGstin: '',
      supplierAddress: '',
      supplierInvoiceNo: 'G/41',
      date: '2026-09-05',
      lines: [{ id: 'l1', description: 'Art board', hsn: '4810', quantity: 100, uom: 'Nos', rate: 50, gstPct: 18 }],
      supplyType: 'none',
      roundOff: true,
      notes: '',
    })(base, admin()),
  )
  return { db: bill.db, invoiceId: 'INV-1', billId: bill.value.id }
}

const draft = (over: Partial<MoneyDraft>): MoneyDraft => ({
  id: '',
  direction: 'in',
  date: '2026-09-12',
  amount: 0,
  mode: 'upi',
  category: 'Customer payment',
  party: '',
  invoiceId: null,
  purchaseId: null,
  reference: '',
  notes: '',
  ...over,
})

describe('money in against a sales invoice', () => {
  it('records part payments, never more than is due, and clears the invoice when paid', () => {
    const { db: start, invoiceId } = books()
    expect(sumDue(toCollect(start))).toBe(11800)

    const first = must(saveMoneyEntry(draft({ amount: 5000, invoiceId }))(start, admin()))
    expect(first.value).toMatchObject({ code: 'RCT-0001', direction: 'in', party: 'Apex Industries', amount: 5000 })
    expect(toCollect(first.db)[0]).toMatchObject({ total: 11800, settled: 5000, due: 6800 })

    const over = saveMoneyEntry(draft({ amount: 6800.01, invoiceId }))(first.db, admin())
    expect(over.ok).toBe(false)
    if (!over.ok) expect(over.fieldErrors?.amount).toMatch(/Only ₹6,800.00 is still due on INV\/2026-27\/0001/)

    const rest = must(saveMoneyEntry(draft({ amount: 6800, invoiceId, mode: 'cheque', reference: 'CHQ 104233' }))(first.db, admin()))
    expect(rest.value.code).toBe('RCT-0002')
    expect(toCollect(rest.db)).toEqual([])
    expect(toCollect(rest.db, true)[0].due).toBe(0)
  })

  it('lets an edit keep its own amount without counting it twice', () => {
    const { db: start, invoiceId } = books()
    const paid = must(saveMoneyEntry(draft({ amount: 11800, invoiceId }))(start, admin()))
    const edited = must(saveMoneyEntry(draft({ ...paid.value, id: paid.value.id, amount: 11000, expectedUpdatedAt: paid.value.updatedAt }))(paid.db, admin()))
    expect(edited.value.code).toBe('RCT-0001')
    expect(toCollect(edited.db)[0].due).toBe(800)
    // Direction is fixed once recorded.
    expect(saveMoneyEntry(draft({ ...edited.value, id: edited.value.id, direction: 'out' }))(edited.db, admin()).ok).toBe(false)
  })
})

describe('money out', () => {
  it('pays a purchase bill down to nothing and refuses to overpay it', () => {
    const { db: start, billId } = books()
    expect(sumDue(toPay(start))).toBe(5900)
    const paid = must(saveMoneyEntry(draft({ direction: 'out', category: 'Supplier payment', amount: 5900, purchaseId: billId, mode: 'bank' }))(start, admin()))
    expect(paid.value).toMatchObject({ code: 'PAY-0001', party: 'Paper Corporation' })
    expect(toPay(paid.db)).toEqual([])
    expect(saveMoneyEntry(draft({ direction: 'out', category: 'Supplier payment', amount: 1, purchaseId: billId }))(paid.db, admin()).ok).toBe(false)
  })

  it('records everyday expenses with no bill, and refuses empty or zero entries', () => {
    const { db } = books()
    const salary = must(saveMoneyEntry(draft({ direction: 'out', category: 'Salary & wages', party: 'Kumar', amount: 12000, mode: 'cash' }))(db, admin()))
    expect(salary.value.invoiceId).toBeNull()
    const bad = saveMoneyEntry(draft({ direction: 'out', category: '', amount: 0, date: 'someday' }))(db, admin())
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(Object.keys(bad.fieldErrors ?? {}).sort()).toEqual(['amount', 'category', 'date'])
    // A supplier payment needs to say whom it was paid to.
    expect(saveMoneyEntry(draft({ direction: 'out', category: 'Supplier payment', amount: 10 }))(db, admin()).ok).toBe(false)
  })
})

describe('monthly summary and balance', () => {
  it('adds up money in and out by month, category and mode, and carries the balance forward', () => {
    let { db } = books()
    const add = (over: Partial<MoneyDraft>) => (db = must(saveMoneyEntry(draft(over))(db, admin())).db)
    add({ category: 'Opening balance', party: 'Cash in hand', amount: 20000, date: '2026-08-31', mode: 'cash' })
    add({ amount: 11800, invoiceId: 'INV-1', date: '2026-09-12' })
    add({ direction: 'out', category: 'Electricity', party: 'TNEB', amount: 4321.5, date: '2026-09-14', mode: 'bank' })
    add({ direction: 'out', category: 'Salary & wages', party: 'Kumar', amount: 12000, date: '2026-09-30', mode: 'cash' })
    add({ direction: 'out', category: 'Rent', party: 'Owner', amount: 8000, date: '2026-10-01', mode: 'cash' })

    const sept = summarise(entriesOfMonth(db, '2026-09'))
    expect(sept).toMatchObject({ moneyIn: 11800, moneyOut: 16321.5, balance: -4521.5 })
    expect(sept.byCategory.map((c) => [c.direction, c.category, c.amount])).toEqual([
      ['in', 'Customer payment', 11800],
      ['out', 'Salary & wages', 12000],
      ['out', 'Electricity', 4321.5],
    ])
    expect(sept.byMode.find((m) => m.mode === 'cash')).toMatchObject({ moneyIn: 0, moneyOut: 12000 })

    expect(balances(db, '2026-09')).toEqual({ opening: 20000, closing: 15478.5 })
    expect(balances(db, '2026-10')).toEqual({ opening: 15478.5, closing: 7478.5 })
    expect(entriesOfMonth(db, '2026-09').map((e) => e.date)).toEqual(['2026-09-30', '2026-09-14', '2026-09-12'])
  })
})

describe('deleting and access', () => {
  it('deletes an entry, which puts the invoice back to collect, and audits both', () => {
    const { db: start, invoiceId } = books()
    const paid = must(saveMoneyEntry(draft({ amount: 11800, invoiceId }))(start, admin()))
    const gone = must(deleteMoneyEntry(paid.value.id)(paid.db, admin()))
    expect(gone.db.cashbook).toEqual([])
    expect(sumDue(toCollect(gone.db))).toBe(11800)
    expect(gone.db.audit.slice(0, 2).map((a) => a.action)).toEqual(['Receipt deleted', 'Money received'])
  })

  it('is open to both administrators and closed to a leftover unit account', () => {
    const { db, invoiceId } = books()
    expect(saveMoneyEntry(draft({ amount: 100, invoiceId }))(db, ctxFor(ADMIN[1])).ok).toBe(true)
    expect(saveMoneyEntry(draft({ amount: 100, invoiceId }))(db, ctxFor(RETIRED_UNIT)).ok).toBe(false)
  })

  it('gives an older database an empty book on load', () => {
    const old = { ...buildEmptyDB(new Date('2026-09-01T09:00:00')) } as Partial<VertexDB>
    delete old.cashbook
    const counters = { ...old.counters } as Record<string, number>
    delete counters.receipt
    delete counters.payment
    const loaded = normalizeDB({ ...old, counters } as VertexDB)
    expect(loaded.cashbook).toEqual([])
    expect(loaded.counters).toMatchObject({ receipt: 0, payment: 0 })
  })
})

describe('the month report', () => {
  it('has the same rows for Excel and PDF, with balances, and renders as a PDF', async () => {
    let { db } = books()
    const add = (over: Partial<MoneyDraft>) => (db = must(saveMoneyEntry(draft(over))(db, admin())).db)
    add({ category: 'Opening balance', party: 'Cash in hand', amount: 20000, date: '2026-08-31', mode: 'cash' })
    add({ amount: 11800, invoiceId: 'INV-1', date: '2026-09-12' })
    add({ direction: 'out', category: 'Electricity', party: 'TNEB', amount: 4321.5, date: '2026-09-14', mode: 'bank', reference: 'UTR 99812' })

    const table = monthReportTable(db, '2026-09')
    expect(table.heading[1]).toBe('Income & expenses — September 2026')
    expect(table.rows.map((r) => r.kind)).toEqual(['total', 'row', 'row', 'grand', 'total', 'total'])
    expect(table.rows[0].cells).toEqual(['Balance brought forward', '', '', '', '', '', '', 20000, null])
    expect(table.rows[1].cells).toEqual(['12 Sep 2026', 'RCT-0002', 'In', 'Customer payment', 'Apex Industries', 'UPI', 'INV/2026-27/0001', 11800, null])
    expect(table.rows[3].cells.slice(-2)).toEqual([11800, 4321.5])
    expect(table.rows[5].cells).toEqual(['Balance at month end', '', '', '', '', '', '', 27478.5, null])

    const mod = (await import('pdfmake')) as unknown as { default?: PdfMake } & PdfMake
    const pdfmake = mod.default ?? mod
    const dir = path.resolve(__dirname, '../assets/fonts')
    const regular = path.join(dir, 'NotoSansTamil-Regular.ttf')
    const bold = path.join(dir, 'NotoSansTamil-Bold.ttf')
    pdfmake.addFonts({ [FONT_FAMILY]: { normal: regular, bold, italics: regular, bolditalics: bold } })
    pdfmake.setUrlAccessPolicy(() => false)
    pdfmake.setLocalAccessPolicy((p) => path.resolve(p).startsWith(dir))
    const { updatedAt: _u, updatedBy: _b, ...company } = { ...db.company, name: 'Vertex Print Pack' }
    void _u
    void _b
    const pdf = await pdfmake.createPdf(reportTableDefinition(table, company, new Date('2026-09-30T18:00:00'))).getBuffer()
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF')
    if (process.env.PDF_OUT) writeFileSync(process.env.PDF_OUT.replace('.pdf', '-income-expenses.pdf'), pdf)
  })
})

interface PdfMake {
  addFonts(f: unknown): void
  setUrlAccessPolicy(cb: (u: string) => boolean): void
  setLocalAccessPolicy(cb: (p: string) => boolean): void
  createPdf(def: TDocumentDefinitions): { getBuffer(): Promise<Buffer> }
}
