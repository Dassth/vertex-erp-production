import { describe, expect, it } from 'vitest'
import { purchaseTotals, resolveSupply, retaxInvoice } from './gst'
import type { Invoice, PurchaseLine } from './types'

const VERTEX = '33AMQPA8484N1ZE'
const line = (p: Partial<PurchaseLine>): PurchaseLine => ({ id: 'l', description: 'x', hsn: '', quantity: 1, uom: 'Nos', rate: 0, gstPct: 18, ...p })

describe('supply type', () => {
  it('same state → intra, other state → inter, unknown → null', () => {
    expect(resolveSupply('auto', '33ACCPS0708D1Z5', VERTEX)).toBe('intra')
    expect(resolveSupply('auto', VERTEX, '21AABFL2810N1ZN')).toBe('inter')
    expect(resolveSupply('auto', '', VERTEX)).toBeNull()
    expect(resolveSupply('inter', '', VERTEX)).toBe('inter')
  })
})

describe('purchase bill totals', () => {
  it('matches the Paper Corporation bill: 9.56 kg @ 80, CGST 9 % + SGST 9 %, rounded to ₹902', () => {
    const t = purchaseTotals(
      { lines: [line({ hsn: '48102900', quantity: 9.56, rate: 80 })], supplyType: 'auto', supplierGstin: '33ACCPS0708D1Z5', roundOff: true },
      VERTEX,
    )
    expect(t.taxable).toBe(764.8)
    expect(t.cgst).toBe(68.83)
    expect(t.sgst).toBe(68.83)
    expect(t.igst).toBe(0)
    expect(t.roundOff).toBe(-0.46)
    expect(t.net).toBe(902)
  })

  it('works out tax per line when goods carry different rates', () => {
    const t = purchaseTotals(
      { lines: [line({ hsn: 'A', quantity: 10, rate: 100, gstPct: 18 }), line({ hsn: 'B', quantity: 1, rate: 1000, gstPct: 5 })], supplyType: 'inter', supplierGstin: '', roundOff: false },
      VERTEX,
    )
    expect(t.igst).toBe(230)
    expect(t.summary.map((g) => g.tax)).toEqual([180, 50])
    expect(t.net).toBe(2230)
  })
})

describe('sales invoice GST edit', () => {
  it('matches invoice 81: ₹23,450 to Odisha at IGST 18 % = ₹4,221', () => {
    const inv = {
      lines: [{ description: 'Deluxe plate', hsn: '', quantity: 1, uom: 'Nos', rate: 23450, amount: 23450 }],
      taxableValue: 23450,
      taxLabel: 'GST',
      taxPct: 12,
      taxAmount: 2814,
      cgst: 1407,
      sgst: 1407,
      igst: null,
      total: 26264,
      company: { gstin: VERTEX },
      customer: { gstin: '21AABFL2810N1ZN', placeOfSupply: '' },
    } as unknown as Invoice
    const out = retaxInvoice(inv, { taxPct: 18, supplyType: 'auto', hsn: ['48192020'], taxLabel: 'GST' })
    expect(out.igst).toBe(4221)
    expect(out.cgst).toBeNull()
    expect(out.total).toBe(27671)
    expect(out.lines[0].hsn).toBe('48192020')
  })
})

describe('local CGST / SGST split', () => {
  const inv = {
    lines: [{ description: 'Box', hsn: '48192020', quantity: 1, uom: 'Nos', rate: 1000, amount: 1000 }],
    taxableValue: 1000, taxLabel: 'GST', taxPct: 18, taxAmount: 180, cgst: 90, sgst: 90, igst: null, total: 1180,
    company: { gstin: VERTEX }, customer: { gstin: '33AABFL2810N1ZN', placeOfSupply: '' },
  } as unknown as Invoice

  it('accepts uneven CGST and SGST rates and adds them up', () => {
    const out = retaxInvoice(inv, { taxPct: 18, supplyType: 'intra', cgstPct: 6, sgstPct: 12, hsn: ['48192020'], taxLabel: 'GST' })
    expect(out.cgst).toBe(60)
    expect(out.sgst).toBe(120)
    expect(out.taxPct).toBe(18)
    expect(out.total).toBe(1180)
    expect([out.cgstPct, out.sgstPct]).toEqual([6, 12])
  })

  it('local without split prints one GST line', () => {
    const out = retaxInvoice(inv, { taxPct: 5, supplyType: 'none', hsn: ['48191010'], taxLabel: 'GST' })
    expect([out.cgst, out.sgst, out.igst]).toEqual([null, null, null])
    expect(out.taxAmount).toBe(50)
  })
})
