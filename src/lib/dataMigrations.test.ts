import { describe, expect, it } from 'vitest'
import type { Customer, Invoice, VertexDB } from './types'
import { buildEmptyDB } from './defaults'
import { MIGRATION_GST_STATE_SPLIT, migrateGstStateSplit, pendingDataMigrations } from './dataMigrations'
import { normalizeDB } from './db'

/* The GST state migration fixes only the tax split of issued invoices — never their totals. */

function oldDB(): VertexDB {
  const db = buildEmptyDB(new Date('2026-10-01T09:00:00'))
  const customer = (id: string, over: Partial<Customer>): Customer =>
    ({ id, code: id, company: `Buyer ${id}`, contactPerson: '', phone: '', email: '', billingAddress: 'Chennai', deliveryAddress: '', gstin: '', unregistered: true, placeOfSupply: '', paymentTerms: '', notes: '', active: true, createdAt: '', createdBy: '', updatedAt: '', updatedBy: '', ...over }) as Customer
  const invoice = (id: string, c: Customer, over: Partial<Invoice>): Invoice =>
    ({
      id,
      number: `DEMO/2026-27/${id}`,
      issueDate: '2026-10-05',
      company: { ...db.company, gstin: '33AAAAA0000A1Z5' },
      customer: { id: c.id, code: c.code, company: c.company, contactPerson: '', phone: '', email: '', billingAddress: c.billingAddress, deliveryAddress: '', gstin: c.gstin, unregistered: c.unregistered, placeOfSupply: c.placeOfSupply, paymentTerms: '' },
      deliveryAddress: 'Chennai',
      lines: [{ description: 'Box', hsn: '4819', quantity: 1000, uom: 'pcs', rate: 197.07, amount: 197070 }],
      subtotal: 197070,
      discount: 0,
      taxableValue: 197070,
      taxLabel: 'GST',
      taxPct: 18,
      taxAmount: 35472.6,
      cgst: null,
      sgst: null,
      igst: null,
      total: 232542.6,
      ...over,
    }) as Invoice
  const urd = customer('C1', { placeOfSupply: 'Tamil Nadu' })
  const karnataka = customer('C2', { unregistered: false, gstin: '29ABCDE1234F1Z5', placeOfSupply: 'Karnataka' })
  const unknown = customer('C3', { placeOfSupply: 'Somewhere' })
  return {
    ...db,
    migrations: [],
    company: { ...db.company, gstin: '33AAAAA0000A1Z5', stateCode: undefined },
    customers: [urd, karnataka, unknown],
    invoices: [
      invoice('0005', urd, {}),
      // Whole tax wrongly under IGST for an intra-state sale.
      invoice('0004', urd, { igst: 35472.6 }),
      invoice('0006', karnataka, { cgst: 17736.3, sgst: 17736.3 }),
      invoice('0007', unknown, {}),
      // Tax type chosen by hand in Billing: left alone.
      invoice('0008', urd, { supplyType: 'none' }),
    ],
  }
}

describe('GST state migration', () => {
  it('splits URD intra-state invoices into CGST + SGST and other-state ones into IGST, keeping every total', () => {
    const before = oldDB()
    const after = migrateGstStateSplit(before, new Date('2026-10-18T10:00:00'))
    const inv = (n: string) => after.invoices.find((i) => i.number.endsWith(n))!
    expect(inv('0005')).toMatchObject({ cgst: 17736.3, sgst: 17736.3, igst: null, cgstPct: 9, sgstPct: 9 })
    expect(inv('0004')).toMatchObject({ cgst: 17736.3, sgst: 17736.3, igst: null })
    expect(inv('0006')).toMatchObject({ cgst: null, sgst: null, igst: 35472.6 })
    // State unknown: not guessed.
    expect(inv('0007')).toMatchObject({ cgst: null, sgst: null, igst: null })
    expect(inv('0008')).toEqual(before.invoices[4])
    for (const [i, b] of before.invoices.entries()) {
      const a = after.invoices[i]
      expect([a.taxableValue, a.taxAmount, a.total, a.lines, a.subtotal, a.discount]).toEqual([b.taxableValue, b.taxAmount, b.total, b.lines, b.subtotal, b.discount])
    }
    expect(after.audit.filter((e) => e.action === 'Invoice GST split corrected')).toHaveLength(3)
  })

  it('stores Place of supply as a state code, fills the company State and keeps text it cannot match', () => {
    const after = migrateGstStateSplit(oldDB())
    expect(after.company.stateCode).toBe('33')
    expect(after.customers.map((c) => c.placeOfSupply)).toEqual(['33', '29', 'Somewhere'])
  })

  it('runs once and is recorded', () => {
    const once = migrateGstStateSplit(oldDB())
    expect(once.migrations).toContain(MIGRATION_GST_STATE_SPLIT)
    expect(pendingDataMigrations(once)).toEqual([])
    expect(migrateGstStateSplit(once)).toBe(once)
    expect(normalizeDB(once).audit.length).toBe(once.audit.length)
    // A new database starts migrated, with nothing logged.
    expect(pendingDataMigrations(buildEmptyDB())).toEqual([])
  })
})
