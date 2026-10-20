import { describe, expect, it } from 'vitest'
import { allocateInvoice, financialYear, invoiceNumber, rupeesInWords, splitTax } from './billing'
import type { BillingTotals, PreviousInvoice } from './billing'
import { toPaise } from './costing'

function invoiceSeries(totals: BillingTotals, quantities: number[]) {
  const issued: PreviousInvoice[] = []
  const all = quantities.map((q) => {
    const a = allocateInvoice(totals, issued, q)
    issued.push({ subtotal: a.subtotal, discount: a.discount, taxAmount: a.taxAmount, partial: { thisQty: a.quantity } })
    return a
  })
  const sum = (k: 'subtotal' | 'discount' | 'taxAmount' | 'total') => all.reduce((s, a) => s + toPaise(a[k]), 0)
  return { all, sum }
}

describe('partial dispatch invoice allocation', () => {
  const totals: BillingTotals = { quantity: 1000, sellingPerPiece: 5.6, totalSelling: 5600, discountAmount: 99.99, taxPct: 18, taxAmount: 990, }

  it('bills 100 + 200 + 700 and reconciles exactly to the order totals', () => {
    // order tax: (5600 − 99.99) × 18 % = 990.0018 → 990.00
    const { all, sum } = invoiceSeries(totals, [100, 200, 700])
    expect(all[0].subtotal).toBe(560)
    expect(all[0].discount).toBe(10) // 99.99 × 100/1000 = 9.999 → 10.00
    expect(all[0].isFinal).toBe(false)
    expect(all[1].remainingAfter).toBe(700)
    expect(all[2].isFinal).toBe(true)
    expect(sum('subtotal')).toBe(toPaise(5600))
    expect(sum('discount')).toBe(toPaise(99.99))
    expect(sum('taxAmount')).toBe(toPaise(990))
    expect(sum('total')).toBe(toPaise(5600 - 99.99 + 990))
  })

  it('absorbs rounding on the final dispatch for awkward splits', () => {
    const odd: BillingTotals = { quantity: 1000, sellingPerPiece: 1.37, totalSelling: 1370, discountAmount: 13.7, taxPct: 12, taxAmount: 162.76 }
    const { all, sum } = invoiceSeries(odd, [333, 333, 334])
    expect(all.every((a) => a.taxAmount >= 0)).toBe(true)
    expect(sum('taxAmount')).toBe(toPaise(162.76))
    expect(sum('total')).toBe(toPaise(1370 - 13.7 + 162.76))
  })

  it('a single full dispatch equals the costing totals', () => {
    const a = allocateInvoice(totals, [], 1000)
    expect(a.isSingleFull).toBe(true)
    expect(a.total).toBeCloseTo(5600 - 99.99 + 990, 2)
  })

  it('refuses to bill more than the ordered quantity', () => {
    expect(() => allocateInvoice(totals, [{ subtotal: 5040, discount: 90, taxAmount: 891, partial: { thisQty: 900 } }], 101)).toThrow(/Only 100/)
    expect(() => allocateInvoice(totals, [], 0)).toThrow(/whole number/)
  })
})

describe('tax split, numbering and words', () => {
  it('splits intra-state tax into CGST/SGST and inter-state into IGST', () => {
    const company = { gstin: '33ABCDE1234F1Z5' }
    // Registered, same state: CGST = half rounded to the paisa, SGST = the rest.
    expect(splitTax(100.01, company, { gstin: '33PQRSX9876K1Z2' })).toEqual({ supply: 'intra', cgst: 50.01, sgst: 50, igst: null })
    // Registered, other state (29 Karnataka): IGST.
    expect(splitTax(100, company, { gstin: '29PQRSX9876K1Z2' })).toEqual({ supply: 'inter', cgst: null, sgst: null, igst: 100 })
    // Nothing known: no split, and the caller must not issue the invoice.
    expect(splitTax(100, { gstin: '' }, { gstin: '' })).toEqual({ supply: null, cgst: null, sgst: null, igst: null })
  })

  it('treats an unregistered (URD) buyer in the same state as intra-state, from the Place of supply in any spelling', () => {
    const company = { gstin: '33AAAAA0000A1Z5' }
    for (const pos of ['Tamil Nadu', 'tamilnadu', 'TN', '33', '33 - Tamil Nadu']) expect(splitTax(35472.6, company, { gstin: '', placeOfSupply: pos })).toEqual({ supply: 'intra', cgst: 17736.3, sgst: 17736.3, igst: null })
    expect(splitTax(100, company, { gstin: '', placeOfSupply: 'Karnataka' })).toMatchObject({ supply: 'inter', igst: 100 })
    // No GSTIN on the company: its State decides.
    expect(splitTax(100, { gstin: '', stateCode: '33' }, { placeOfSupply: 'Tamil Nadu' })).toMatchObject({ supply: 'intra', cgst: 50, sgst: 50 })
    // Place of supply missing: a state named in the delivery address is used.
    expect(splitTax(100, company, { gstin: '', placeOfSupply: '', deliveryAddress: '12 Mount Road, Chennai, Tamil Nadu 600002' })).toMatchObject({ supply: 'intra' })
  })

  it('always adds CGST and SGST up to the tax exactly, for odd-paisa totals', () => {
    const company = { gstin: '33AAAAA0000A1Z5' }
    for (const tax of [0.01, 0.03, 1.01, 99.99, 12345.67, 35472.61]) {
      const s = splitTax(tax, company, { gstin: '33PQRSX9876K1Z2' })
      expect(Math.round((s.cgst! + s.sgst!) * 100)).toBe(Math.round(tax * 100))
      expect(Math.abs(Math.round(s.cgst! * 100) - Math.round(s.sgst! * 100))).toBeLessThanOrEqual(1)
    }
  })
  it('numbers invoices by Indian financial year', () => {
    expect(financialYear('2026-09-15')).toBe('2026-27')
    expect(financialYear('2027-03-31')).toBe('2026-27')
    expect(invoiceNumber('INV', '2027-04-01', 7)).toBe('INV/2027-28/0007')
  })
  it('writes amounts in Indian words', () => {
    expect(rupeesInWords(125000.5)).toBe('Rupees One Lakh Twenty Five Thousand and Fifty Paise Only')
    expect(rupeesInWords(6608)).toBe('Rupees Six Thousand Six Hundred Eight Only')
  })
})

describe('HSN hint', () => {
  it('flags an HSN outside chapter 48 for a box, and says nothing otherwise', async () => {
    const { hsnHint } = await import('./gst')
    expect(hsnHint('0823', 'Sweet Box 150x150x40mm TOP & BOTTOM RIGID')).toMatch(/4819/)
    expect(hsnHint('48192020', 'Sweet Box')).toBeNull()
    expect(hsnHint('', 'Sweet Box')).toBeNull()
    expect(hsnHint('998912', 'Lamination job work')).toBeNull()
  })
})
