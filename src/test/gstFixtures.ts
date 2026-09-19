import { buildEmptyDB } from '../lib/defaults'
import type { Invoice, PurchaseBill, VertexDB } from '../lib/types'

/* August 2026 rows taken from the auditor's Annexure-I, used by the GST report tests. */
const VERTEX = '33AMQPA8484N1ZE'
const stamp = { createdAt: '', createdBy: '', updatedAt: '', updatedBy: '' }
const bill = (p: Partial<PurchaseBill>): PurchaseBill => ({
  id: p.code ?? 'P', code: 'PUR-0001', supplierName: 'S', supplierGstin: '', supplierAddress: '', supplierInvoiceNo: '', date: '2026-08-10',
  lines: [], supplyType: 'auto', roundOff: true, notes: '', ...stamp, ...p,
})

export function sampleDb(): VertexDB {
  const db = buildEmptyDB(new Date('2026-09-01'))
  db.company = { ...db.company, name: 'Vertex Print Pack', gstin: VERTEX }
  db.purchases = [
    // Rows from the August 2026 Annexure-I
    bill({ code: 'PUR-0001', supplierName: 'Ramana Agencies, Sivakasi', supplierGstin: '33AAAAA0000A1Z5', supplierInvoiceNo: '140', date: '2026-08-22',
      lines: [{ id: 'a', description: 'Board', hsn: '4810', quantity: 1, uom: 'Kgs', rate: 31618, gstPct: 18 }] }),
    bill({ code: 'PUR-0002', supplierName: 'Unittex India, Delhi', supplierGstin: '07AACPJ3197R1Z3', supplierInvoiceNo: '1679', date: '2026-08-13',
      lines: [{ id: 'b', description: 'Film', hsn: '4820', quantity: 1, uom: 'Nos', rate: 18400, gstPct: 18 }] }),
    bill({ code: 'PUR-0003', supplierName: 'Arunachalam Trading', supplierGstin: '33AAAAA0000A1Z5', supplierInvoiceNo: '77', date: '2026-08-19',
      lines: [{ id: 'c', description: 'Corrugated boxes', hsn: '48191010', quantity: 1, uom: 'Nos', rate: 55000, gstPct: 5 }] }),
    bill({ code: 'PUR-0004', date: '2026-07-31', lines: [{ id: 'd', description: 'July', hsn: '4802', quantity: 1, uom: 'Nos', rate: 100, gstPct: 18 }] }),
  ]
  const inv = (number: string, customer: string, gstin: string, taxable: number, split: Partial<Invoice>): Invoice =>
    ({
      id: number, number, issueDate: '2026-08-20', productName: 'Box', customer: { company: customer, gstin, placeOfSupply: '' },
      lines: [{ description: 'Box', hsn: '48192020', quantity: 100, uom: 'pcs', rate: taxable / 100, amount: taxable }],
      taxableValue: taxable, taxPct: 18, taxAmount: taxable * 0.18, cgst: null, sgst: null, igst: null, total: taxable * 1.18, ...split,
    }) as unknown as Invoice
  db.invoices = [
    inv('INV/2026-27/0081', 'Lalchand Jewellers', '21AABFL2810N1ZN', 23450, { igst: 4221 }),
    inv('INV/2026-27/0082', 'Beautys Trays', '33ACJPA1039Q2ZM', 10000, { cgst: 900, sgst: 900 }),
  ]
  return db
}

