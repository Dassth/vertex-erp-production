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
    expect(splitTax(100.01, '33ABCDE1234F1Z5', '33PQRSX9876K1Z2', '')).toEqual({ cgst: 50, sgst: 50.01, igst: null })
    expect(splitTax(100, '33ABCDE1234F1Z5', '29PQRSX9876K1Z2', '')).toEqual({ cgst: null, sgst: null, igst: 100 })
    expect(splitTax(100, '', '', '')).toEqual({ cgst: null, sgst: null, igst: null })
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
