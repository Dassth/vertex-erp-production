import { describe, expect, it } from 'vitest'
import { invoiceFileName } from './format'

describe('invoiceFileName', () => {
  it('turns path separators in an invoice number into dashes', () => {
    expect(invoiceFileName('INV/2026/0007')).toBe('INV-2026-0007.pdf')
    expect(invoiceFileName(String.raw`INV\2026\0007`)).toBe('INV-2026-0007.pdf')
    expect(invoiceFileName('INV-2026-0007')).toBe('INV-2026-0007.pdf')
  })
})
