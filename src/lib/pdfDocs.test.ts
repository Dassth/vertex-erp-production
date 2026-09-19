import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { createHash } from 'node:crypto'
import type { TDocumentDefinitions } from 'pdfmake/interfaces'
import { FONT_FAMILY, gstReportDefinition, invoiceDefinition, purchaseBillDefinition, statementDefinition, workListDefinition } from './pdfDocs'
import { consolidatedStatement } from './billing'
import type { Invoice, ProductionOrder } from './types'

/* Renders real PDF bytes with pdfmake's Node build and the same embedded fonts
   the browser uses. */

const FONT_DIR = path.resolve(__dirname, '../assets/fonts')

interface ServerPdfMake {
  addFonts(f: unknown): void
  setUrlAccessPolicy(cb: (u: string) => boolean): void
  setLocalAccessPolicy(cb: (p: string) => boolean): void
  createPdf(def: TDocumentDefinitions): { getBuffer(): Promise<Buffer> }
}

async function render(def: TDocumentDefinitions): Promise<Buffer> {
  const mod = (await import('pdfmake')) as unknown as { default?: ServerPdfMake } & ServerPdfMake
  const pdfmake = mod.default ?? mod
  const regular = path.join(FONT_DIR, 'NotoSansTamil-Regular.ttf')
  const bold = path.join(FONT_DIR, 'NotoSansTamil-Bold.ttf')
  pdfmake.addFonts({ [FONT_FAMILY]: { normal: regular, bold, italics: regular, bolditalics: bold } })
  pdfmake.setUrlAccessPolicy(() => false)
  pdfmake.setLocalAccessPolicy((p) => path.resolve(p).startsWith(FONT_DIR))
  return pdfmake.createPdf(def).getBuffer()
}

const pageCount = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Type \/Page\b(?!s)/g) ?? []).length

const TAMIL_COMPANY = 'ஸ்ரீ லட்சுமி பேக்கேஜிங் டிரேடர்ஸ்'
const TAMIL_ADDRESS = 'எண் 12, காந்தி சாலை,\nகோயம்புத்தூர் – 641 001,\nதமிழ்நாடு'

const company = {
  name: 'Vertex Print Pack',
  address: 'Factory Road, Industrial Area,\nExample City 600010',
  phone: '+91 00000 11111',
  email: 'billing@example.com',
  gstin: '33AAAAA0000A1Z5',
  invoicePrefix: 'INV',
  bankDetails: 'Example Bank · A/c 000000000',
  invoiceTerms: 'Subject to local jurisdiction.',
}
const customer = {
  id: 'CUS-1',
  code: 'CUS-0001',
  company: TAMIL_COMPANY,
  contactPerson: 'பொன்னுசாமி',
  phone: '+91 00000 00000',
  email: 'accounts@example.com',
  billingAddress: TAMIL_ADDRESS,
  deliveryAddress: 'கிடங்கு 4, லாஜிஸ்டிக்ஸ் பார்க்,\nExample City 600002',
  gstin: '33ABCDE1234F1Z5',
  placeOfSupply: '33',
  paymentTerms: '30 நாட்கள் / 30 days from invoice',
}

function invoice(seq: number, thisQty: number, previous: number, lines = 1): Invoice {
  const subtotal = Math.round(11.06 * thisQty * 100) / 100
  const tax = Math.round(subtotal * 18) / 100
  return {
    id: `inv-${seq}`,
    number: `INV/2026-27/000${seq}`,
    issueDate: '2026-09-15',
    orderId: 'ord-1',
    dispatchId: `d-${seq}`,
    requestId: `r-${seq}`,
    company,
    customer,
    deliveryAddress: customer.deliveryAddress,
    refs: { orderCode: 'JOB-0001', planCode: 'PLN-0001', costingCode: 'CST-0001', dispatchCode: `DSP-000${seq}`, customerRef: 'PO-7781' },
    productName: 'Premium rigid gift box',
    lines: Array.from({ length: lines }, (_, i) => ({
      description: `பிரீமியம் ரிஜிட் பரிசுப் பெட்டி — Premium rigid gift box, 200 × 150 × 60 mm${lines > 1 ? `, line ${i + 1}` : ''}`,
      hsn: '4819',
      quantity: thisQty,
      uom: 'pcs',
      rate: 11.06,
      amount: subtotal,
    })),
    subtotal,
    discount: 0,
    taxableValue: subtotal,
    taxLabel: 'GST',
    taxPct: 18,
    taxAmount: tax,
    cgst: tax / 2,
    sgst: tax / 2,
    igst: null,
    total: Math.round((subtotal + tax) * 100) / 100,
    partial: { seq, orderedQty: 1000, previouslyDispatched: previous, thisQty, remainingAfter: 1000 - previous - thisQty, isFinal: false, isSingleFull: false },
    paymentTerms: customer.paymentTerms,
    transporter: 'Example Logistics',
    vehicleNo: 'TN 00 AA 0000',
    notes: 'முதல் தொகுதி — கவனமாக கையாளவும். First lot, handle with care.',
    allocationNote: '',
    createdAt: `2026-09-1${4 + seq}T10:00:00.000Z`,
    createdBy: 'Administrator 1',
  }
}

describe('PDF documents (pdfmake + embedded Noto Sans Tamil)', () => {
  it('renders a Tamil + English invoice without replacing any characters', async () => {
    const def = invoiceDefinition(invoice(1, 100, 0))
    const json = JSON.stringify(def)
    expect(json).toContain(TAMIL_COMPANY)
    expect(json).toContain('கோயம்புத்தூர்')
    expect(json).not.toMatch(/\?\?\?/)
    for (const expected of ['TAX INVOICE', 'INV/2026-27/0001', 'DSP-0001 (#1)', 'JOB-0001', '₹ 11.06', '₹ 1,106.00', '₹ 99.54', '₹ 1,305.08', 'balance 900']) expect(json).toContain(expected)
    // Customer documents never carry internal costing — check every printed text run.
    const printed: string[] = []
    const collect = (node: unknown) => {
      if (typeof node === 'string') printed.push(node)
      else if (Array.isArray(node)) node.forEach(collect)
      else if (node && typeof node === 'object')
        for (const [key, value] of Object.entries(node)) if (['text', 'stack', 'columns', 'table', 'body', 'content'].includes(key)) collect(value)
    }
    collect(def.content)
    expect(printed.join(' | ')).toContain('Premium rigid gift box')
    expect(printed.join(' | ')).not.toMatch(/profit|production cost|cost per|markup|margin|₹ 9\.2/i)

    const pdf = await render(def)
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(pdf.toString('latin1')).toMatch(/\/BaseFont \/[A-Z]{6}\+NotoSansTamil/)
    expect(pageCount(pdf)).toBe(1)
  }, 30000)

  it('breaks long invoices across pages with repeated table headers', async () => {
    const def = invoiceDefinition(invoice(2, 200, 100, 70))
    const pdf = await render(def)
    expect(pageCount(pdf)).toBeGreaterThan(1)
    expect(JSON.stringify(def)).toContain('"headerRows":1')
  }, 30000)

  it('produces identical bytes for the same invoice (preview equals download)', async () => {
    const a = await render(invoiceDefinition(invoice(1, 100, 0)))
    const b = await render(invoiceDefinition(invoice(1, 100, 0)))
    expect(createHash('sha256').update(a).digest('hex')).toBe(createHash('sha256').update(b).digest('hex'))
  }, 30000)

  it('renders a consolidated statement that is explicitly not a new charge', async () => {
    const order = { id: 'ord-1', code: 'JOB-0001', quantity: 1000, uom: 'pcs', customer, productName: 'Premium rigid gift box', dimensions: '', customerRef: 'PO-7781' } as unknown as ProductionOrder
    const st = consolidatedStatement(order, [invoice(1, 100, 0), invoice(2, 200, 100)], { grandTotal: 13050.8 })
    expect(st.invoicedQty).toBe(300)
    expect(st.remainingQty).toBe(700)
    const def = statementDefinition(order, st, company, new Date('2026-09-17T09:00:00Z'))
    const json = JSON.stringify(def)
    expect(json).toContain('NOT a tax invoice')
    expect(json).toContain('CUMULATIVE INVOICE SUMMARY')
    expect(json).toContain('no additional amount is payable')
    expect(json).toContain('Total of listed invoices')
    expect(json).toContain('Order quantity not yet covered')
    expect(json).toContain('₹ 3,915.24')
    expect(json).toContain('700 pcs remain')
    expect(json).not.toContain('TAX INVOICE')
    const pdf = await render(def)
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  }, 30000)

  it('renders the landscape work list', async () => {
    const def = workListDefinition([], { title: 'Today', scope: 'Tuesday', unitName: (id) => id }, new Date('2026-09-15T10:00:00Z'))
    expect(def.pageOrientation).toBe('landscape')
    const pdf = await render(def)
    expect(pageCount(pdf)).toBe(1)
  }, 30000)
})

describe('purchase bill PDF', () => {
  it('renders a supplier bill with the GST split and round-off', async () => {
    const bill = {
      id: 'PUR1', code: 'PUR-0001', supplierName: 'Paper Corporation', supplierGstin: '33ACCPS0708D1Z5',
      supplierAddress: '14, Pettai Street, Sivakasi', supplierInvoiceNo: 'G/4147/26-27', date: '2026-09-12',
      lines: [{ id: 'l1', description: '300GSM 330*483 Gold Coin', hsn: '48102900', quantity: 9.56, uom: 'Kgs', rate: 80, gstPct: 18 }],
      supplyType: 'auto' as const, roundOff: true, notes: '',
      createdAt: '2026-09-12T10:00:00.000Z', createdBy: 'A', updatedAt: '2026-09-12T10:00:00.000Z', updatedBy: 'A',
    }
    const pdf = await render(purchaseBillDefinition(bill, { ...company, gstin: '33AMQPA8484N1ZE' }))
    expect(pageCount(pdf)).toBe(1)
    if (process.env.PDF_OUT) (await import('node:fs')).writeFileSync(process.env.PDF_OUT, pdf)
  })
})

describe('monthly GST report PDF', () => {
  it('renders the purchase and sales reports separately', async () => {
    const { sampleDb } = await import('../test/gstFixtures')
    const { monthlyGstReport } = await import('./gstReport')
    const db = sampleDb()
    const report = monthlyGstReport(db, '2026-08')
    for (const kind of ['purchases', 'sales'] as const) {
      const pdf = await render(gstReportDefinition(report, { ...company, gstin: db.company.gstin }, kind, new Date('2026-09-19T10:00:00')))
      expect(pageCount(pdf)).toBe(1)
      if (process.env.PDF_OUT) (await import('node:fs')).writeFileSync(process.env.PDF_OUT.replace('.pdf', `-${kind}.pdf`), pdf)
    }
  })
})
