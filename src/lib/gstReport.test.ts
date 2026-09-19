import { describe, expect, it } from 'vitest'
import { gstReportCsv, monthlyGstReport } from './gstReport'
import { sampleDb } from '../test/gstFixtures'

describe('monthly GST report', () => {
  const r = monthlyGstReport(sampleDb(), '2026-08')

  it('groups purchases like the Annexure: local by rate, then inter-state', () => {
    expect(r.label).toBe('AUG/2026')
    expect(r.purchases.sections.map((s) => s.title)).toEqual(['GST 5% LOCAL PURCHASE', 'GST 18% LOCAL PURCHASE', 'GST 18% PURCHASE'])
    const five = r.purchases.sections[0]
    expect([five.taxable, five.cgst, five.sgst, five.total]).toEqual([55000, 1375, 1375, 57750])
    expect(r.purchases.sections[2].igst).toBe(3312)
    expect(r.purchases.taxable).toBe(105018) // July bill left out
  })

  it('groups sales into inter-state and local and keeps saved amounts', () => {
    expect(r.sales.sections.map((s) => s.title)).toEqual(['GST 18% SALES', 'GST 18% LOCAL SALES'])
    expect(r.sales.igst).toBe(4221)
    expect(r.sales.cgst).toBe(900)
    expect(r.sales.hsn).toHaveLength(1)
    expect(r.sales.hsn[0]).toMatchObject({ hsn: '48192020', quantity: 200, taxable: 33450, tax: 6021 })
  })

  it('exports each register as its own CSV with the materials bought', () => {
    const purchases = gstReportCsv(r, 'Vertex Print Pack', 'purchases')
    expect(purchases).toContain('Total for GST 5% LOCAL PURCHASE')
    expect(purchases).toContain('Corrugated boxes (1 Nos)')
    expect(purchases).not.toContain('INV/2026-27')
    const sales = gstReportCsv(r, 'Vertex Print Pack', 'sales')
    expect(sales).toContain('48192020')
    expect(sales).not.toContain('Ramana')
  })

  it('picks up an edited bill straight away', () => {
    const db = sampleDb()
    db.purchases[0] = { ...db.purchases[0], lines: [{ ...db.purchases[0].lines[0], rate: 10000 }] }
    expect(monthlyGstReport(db, '2026-08').purchases.sections[1].taxable).toBe(10000)
  })
})

describe('invoice full edit flows into the report', () => {
  it('recalculates the invoice and the sales report from the edited lines', async () => {
    const { applyInvoiceDraft, invoiceToDraft, validateInvoiceDraft } = await import('../domain/purchases')
    const db = sampleDb()
    const base = db.invoices[1]
    const inv = {
      ...base,
      company: db.company,
      customer: { ...base.customer, contactPerson: '', billingAddress: 'Sivakasi', phone: '', email: '' },
      refs: { customerRef: '' },
      discount: 0,
      subtotal: 10000,
      taxLabel: 'GST',
      transporter: '',
      vehicleNo: '',
      notes: '',
      paymentTerms: '',
      deliveryAddress: '',
    } as unknown as typeof base
    const draft = invoiceToDraft(inv)
    draft.lines = [{ ...draft.lines[0], quantity: 200, rate: 60 }]
    draft.tax = { ...draft.tax, supplyType: 'intra', cgstPct: 2.5, sgstPct: 2.5 }
    expect(validateInvoiceDraft(draft)).toEqual({})
    const edited = applyInvoiceDraft(inv, draft)
    expect([edited.taxableValue, edited.cgst, edited.sgst, edited.total]).toEqual([12000, 300, 300, 12600])
    db.invoices[1] = edited
    const local = monthlyGstReport(db, '2026-08').sales.sections.find((s) => s.title.includes('LOCAL'))!
    expect(local.title).toBe('GST 5% LOCAL SALES')
    expect(local.rows[0]).toMatchObject({ sourceId: inv.id, taxable: 12000, cgstPct: 2.5, total: 12600 })
  })
})
