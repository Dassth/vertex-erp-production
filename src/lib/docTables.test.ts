import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { writeFileSync } from 'node:fs'
import type { TDocumentDefinitions } from 'pdfmake/interfaces'
import { PROCESS_UNITS, ctxFor, must, seedMaster } from '../test/fixtures'
import { savePlan, submitPlan } from '../domain/planning'
import { finalizeCosting, openCosting } from '../domain/orderCosting'
import { sampleDb } from '../test/gstFixtures'
import { costingTable, invoiceTable, purchaseBillTable } from './docTables'
import { tableCsv } from './reportTable'
import { FONT_FAMILY, reportTableDefinition } from './pdfDocs'
import type { Invoice } from './types'

function costed() {
  const seeded = seedMaster()
  const plan = must(
    savePlan({ customerId: seeded.customerId, productId: seeded.productId, quantity: 1000, orderDate: '2026-09-15', deliveryDate: '2026-10-10', priority: 'Normal', customerRef: 'PO-7781', dimensions: '', options: '', instructions: '', processUnits: PROCESS_UNITS })(seeded.db, ctxFor()),
  )
  const submitted = must(submitPlan(plan.value.id)(plan.db, ctxFor()))
  const opened = must(openCosting(plan.value.id)(submitted.db, ctxFor()))
  const final = must(finalizeCosting(opened.value.id)(opened.db, ctxFor()))
  return { db: final.db, costing: final.db.costings.find((c) => c.id === opened.value.id)! }
}

describe('costing sheet', () => {
  it('carries materials, processes and the money build-up', () => {
    const { costing } = costed()
    const t = costingTable(costing, 'Vertex Print Pack')
    const sections = t.rows.filter((r) => r.kind === 'section').map((r) => r.cells[0])
    expect(sections).toEqual(expect.arrayContaining(['MATERIALS', 'PROCESSES', 'TOTALS']))
    const label = (name: string) => t.rows.find((r) => r.cells[1] === name)?.cells.at(-1)
    const result = costing.snapshot!.result
    expect(label('Total production cost')).toBe(result.totalCost)
    expect(label('Selling price per piece')).toBe(result.sellingPerPiece)
    expect(label('Final customer amount')).toBe(result.grandTotal)
    expect(t.heading[0]).toMatch(/INTERNAL/)
    expect(tableCsv(t)).toContain('Art board 300 GSM')
  })

  it('renders as a PDF', async () => {
    const { db, costing } = costed()
    const mod = (await import('pdfmake')) as unknown as { default?: PdfMake } & PdfMake
    const pdfmake = mod.default ?? mod
    const dir = path.resolve(__dirname, '../assets/fonts')
    const regular = path.join(dir, 'NotoSansTamil-Regular.ttf')
    const bold = path.join(dir, 'NotoSansTamil-Bold.ttf')
    pdfmake.addFonts({ [FONT_FAMILY]: { normal: regular, bold, italics: regular, bolditalics: bold } })
    pdfmake.setUrlAccessPolicy(() => false)
    pdfmake.setLocalAccessPolicy((p) => path.resolve(p).startsWith(dir))
    const { updatedAt: _u, updatedBy: _b, ...company } = db.company
    void _u
    void _b
    const pdf = await pdfmake.createPdf(reportTableDefinition(costingTable(costing, company.name), company, new Date('2026-09-20T10:00:00'))).getBuffer()
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF')
    if (process.env.PDF_OUT) writeFileSync(process.env.PDF_OUT.replace('.pdf', '-costing.pdf'), pdf)
  })
})

interface PdfMake {
  addFonts(f: unknown): void
  setUrlAccessPolicy(cb: (u: string) => boolean): void
  setLocalAccessPolicy(cb: (p: string) => boolean): void
  createPdf(def: TDocumentDefinitions): { getBuffer(): Promise<Buffer> }
}

describe('document spreadsheets', () => {
  it('turns a purchase bill into the same figures as its PDF', () => {
    const db = sampleDb()
    const { updatedAt: _u, updatedBy: _b, ...company } = db.company
    void _u
    void _b
    const t = purchaseBillTable(db.purchases[2], company)
    expect(t.heading[0]).toMatch(/PURCHASE BILL/)
    const net = t.rows.find((r) => r.cells[1] === 'Net amount')?.cells.at(-1)
    expect(net).toBe(57750)
  })

  it('turns an invoice into lines plus a tax build-up', () => {
    const inv = {
      number: 'INV/2026-27/0081',
      issueDate: '2026-08-20',
      company: { name: 'Vertex Print Pack' },
      customer: { company: 'Lalchand Jewellers' },
      refs: { orderCode: 'CUS-0001-20260915-01', dispatchCode: 'DSP-0001' },
      lines: [{ description: 'Deluxe plate', hsn: '48192020', quantity: 3150, uom: 'Nos', rate: 3, amount: 9450 }],
      subtotal: 9450, discount: 0, taxableValue: 9450, taxLabel: 'GST', taxPct: 18, taxAmount: 1701,
      cgst: null, sgst: null, igst: 1701, total: 11151,
    } as unknown as Invoice
    const t = invoiceTable(inv)
    expect(t.rows[0].cells).toEqual(['1', 'Deluxe plate', '48192020', 3150, 'Nos', 3, 9450])
    expect(t.rows.find((r) => r.cells[1] === 'IGST @ 18%')?.cells.at(-1)).toBe(1701)
    expect(t.rows.at(-1)).toMatchObject({ kind: 'grand', cells: [null, 'Invoice total', null, null, null, null, 11151] })
  })
})
