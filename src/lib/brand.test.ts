import { describe, expect, it } from 'vitest'
import AdmZip from 'adm-zip'
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces'
import { POWERED_BY, watermarkOn } from './brand'
import { gstReportTable, monthlyGstReport } from './gstReport'
import { invoiceTable, purchaseBillTable } from './docTables'
import { tableCsv, tableXlsx } from './reportTable'
import { invoiceDefinition, jobCardDefinition, purchaseBillDefinition } from './pdfDocs'
import { sampleDb } from '../test/gstFixtures'
import type { Invoice, PurchaseBill } from './types'
import type { JobCard } from './jobCard'

const COMPANY = { name: 'Vertex Print Pack', address: 'Sivakasi', phone: '', email: '', gstin: '33AMQPA8484N1ZE', invoicePrefix: 'INV', bankDetails: '', invoiceTerms: '' }

const INVOICE = {
  number: 'INV/2026-27/0001',
  issueDate: '2026-09-18',
  company: COMPANY,
  customer: { company: 'Lalchand Jewellers', billingAddress: '', gstin: '', placeOfSupply: '', contactPerson: '', phone: '', email: '', paymentTerms: '' },
  deliveryAddress: 'Warehouse',
  refs: { orderCode: 'CUS-0001-20260915-01', planCode: 'PLN-0001', costingCode: 'CST-0001', dispatchCode: 'DSP-0001', customerRef: '' },
  productName: 'Box',
  lines: [{ description: 'Box', hsn: '48192020', quantity: 100, uom: 'pcs', rate: 10, amount: 1000 }],
  subtotal: 1000, discount: 0, taxableValue: 1000, taxLabel: 'GST', taxPct: 18, taxAmount: 180, cgst: null, sgst: null, igst: 180, total: 1180,
  partial: { seq: 1, orderedQty: 100, previouslyDispatched: 0, thisQty: 100, remainingAfter: 0, isFinal: true, isSingleFull: true },
  paymentTerms: '', transporter: '', vehicleNo: '', notes: '', allocationNote: '', createdAt: '2026-09-18T10:00:00.000Z', createdBy: 'A',
} as unknown as Invoice

const CARD = {
  mode: 'live', asOf: '2026-09-20T10:00:00.000Z', progress: { done: 0, running: 0, total: 0 },
  plan: { code: 'PLN-0001', priority: 'Normal', status: 'Draft', quantity: 100, orderDate: '2026-09-15', deliveryDate: '2026-10-01', customerRef: '', dimensions: '', options: '', instructions: '' },
  customer: { code: 'CUS-0001', company: 'Lalchand Jewellers', contact: '', gstin: '', address: '' },
  product: { code: 'PRD-0001', name: 'Box', hsn: '', uom: 'pcs', category: '' },
  orderCode: null, costing: 'Not costed yet', productionStatus: 'Draft', processes: [], materials: [], materialsNote: '', dispatches: [],
} as unknown as JobCard

/** The footer of a document, as text — where the mark would appear. */
function footerText(def: TDocumentDefinitions): string {
  const build = def.footer as (page: number, count: number) => Content
  return JSON.stringify(build(1, 1))
}

describe('who may carry the mark', () => {
  it('is on unless the company switches it off', () => {
    expect(watermarkOn({})).toBe(true)
    expect(watermarkOn({ documentWatermark: true })).toBe(true)
    expect(watermarkOn({ documentWatermark: false })).toBe(false)
  })

  it('marks in-house tables and leaves customer tables alone', () => {
    const db = sampleDb()
    expect(purchaseBillTable(db.purchases[2], COMPANY).internal).toBe(true)
    expect(invoiceTable(INVOICE).internal).toBeUndefined()
    expect(gstReportTable(monthlyGstReport(db, '2026-08'), 'Vertex', 'sales').internal).toBeUndefined()
  })

  it('only writes the mark into a file when asked', () => {
    const table = gstReportTable(monthlyGstReport(sampleDb(), '2026-08'), 'Vertex Print Pack', 'purchases')
    expect(tableCsv(table)).not.toContain(POWERED_BY)
    expect(tableCsv({ ...table, watermark: true }).trimEnd().endsWith(POWERED_BY)).toBe(true)
    const sheet = (t: typeof table) => new AdmZip(Buffer.from(tableXlsx(t))).readAsText('xl/worksheets/sheet1.xml')
    expect(sheet(table)).not.toContain(POWERED_BY)
    expect(sheet({ ...table, watermark: true })).toContain(POWERED_BY)
  })
})

describe('document footers', () => {
  it('never mark a tax invoice — the customer and the department read it', () => {
    expect(footerText(invoiceDefinition(INVOICE))).not.toContain(POWERED_BY)
  })

  it('mark in-house documents only when the company wants it', () => {
    expect(footerText(jobCardDefinition(CARD, COMPANY, new Date('2026-09-20T10:00:00'), true))).toContain(POWERED_BY)
    expect(footerText(jobCardDefinition(CARD, COMPANY, new Date('2026-09-20T10:00:00'), false))).not.toContain(POWERED_BY)
    const bill = { ...sampleDb().purchases[2] } as PurchaseBill
    expect(footerText(purchaseBillDefinition(bill, COMPANY, true))).toContain(POWERED_BY)
    expect(footerText(purchaseBillDefinition(bill, COMPANY, false))).not.toContain(POWERED_BY)
  })
})
