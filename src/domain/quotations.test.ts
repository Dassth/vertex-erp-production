import { describe, expect, it } from 'vitest'
import { ADMIN, ctxFor, must } from '../test/fixtures'
import { blankMaterialDraft, saveCustomer, saveMaterial, saveProduct } from './master'
import { buildEmptyDB } from '../lib/defaults'
import type { VertexDB } from '../lib/types'
import { quotationToPlan, quoteCosting, saveQuotation, setQuotationStatus } from './quotations'
import type { QuotationDraft } from './quotations'
import { defaultCostingInputs, finalizeCosting, openCosting, previewCosting } from './orderCosting'
import { completeProcess, startProcess } from './production'
import { confirmDispatch } from './dispatch'
import { saveCompanyProfile } from './system'
import { submitPlan, savePlan } from './planning'

/* A price for a customer before anything is planned; a plan is made only when they agree. */

const admin = () => ctxFor(ADMIN[0])

function setup() {
  let db: VertexDB = buildEmptyDB(new Date('2026-10-12T09:00:00'))
  const m = must(saveMaterial({ ...blankMaterialDraft('sheet'), name: 'Board', price: 20, sheetLengthMm: 1000, sheetWidthMm: 700, cutGapMm: 0 })(db, admin()))
  db = m.db
  const p = must(
    saveProduct({
      code: '', name: 'Sweet box', category: '', description: '', hsn: '4819', uom: 'pcs', taxPct: 18,
      stages: [{ id: 'S1', name: 'Make', description: '', processes: [{ id: 'P1', name: 'Pasting', description: '', setupHours: 1, runHoursPer1000: 0, chargeId: null, costBasis: 'per_1000', rate: 500, setupCharge: 0, requiresMachine: false }] }],
      materials: [{ id: 'b1', materialId: m.value.id, stageId: null, processId: null, qtyPerPiece: 0, piecesPerProduct: 1, cutLengthMm: 200, cutWidthMm: 175, rotationAllowed: true, upsOverride: null, upsOverrideReason: '', note: '' }],
    })(db, admin()),
  )
  db = p.db
  const c = must(saveCustomer({ code: '', company: 'Sri Sweets', contactPerson: '', phone: '', email: '', billingAddress: 'Madurai', deliveryAddress: '', gstin: '', placeOfSupply: '33', paymentTerms: '', notes: '' })(db, admin()))
  db = c.db
  const draft = (over: Partial<QuotationDraft> = {}): QuotationDraft => ({
    id: '', date: '2026-10-12', validUntil: '2026-10-26', customerId: c.value.id, productId: p.value.id, quantity: 1000, size: null,
    inputs: { ...defaultCostingInputs(db, p.value, (x) => x), profitMethod: 'markup', profitPct: 20 }, pricePerPiece: null, notes: '', ...over,
  })
  return { db, draft, materialId: m.value.id }
}

describe('quotations', () => {
  it('works the price out like a costing, numbers it and keeps the totals', () => {
    const { db, draft } = setup()
    const r = must(saveQuotation(draft())(db, admin()))
    const costing = quoteCosting(db, draft())!
    expect(r.value).toMatchObject({ code: 'QTN-0001', status: 'Draft', planId: null })
    expect(r.value.totals).toMatchObject({ sellingPerPiece: costing.sellingPerPiece, grandTotal: costing.grandTotal, taxPct: 18 })
    expect(saveQuotation(draft({ quantity: 0 }))(db, admin()).ok).toBe(false)
    expect(saveQuotation(draft({ validUntil: '2026-10-01' }))(db, admin()).ok).toBe(false)
  })

  it('takes a round price per piece typed by hand', () => {
    const { db, draft } = setup()
    const r = must(saveQuotation(draft({ pricePerPiece: 12.5 }))(db, admin()))
    expect(r.value.totals).toMatchObject({ sellingPerPiece: 12.5, totalSelling: 12500, taxableValue: 12500, taxAmount: 2250, grandTotal: 14750 })
  })

  it('makes a draft plan when the customer agrees, and its costing starts at the quoted price', () => {
    const { db, draft } = setup()
    const q = must(saveQuotation(draft({ pricePerPiece: 12.5 }))(db, admin()))
    const sent = must(setQuotationStatus(q.value.id, 'Sent')(q.db, admin()))
    const made = must(quotationToPlan(q.value.id)(sent.db, admin()))
    expect(made.value.plan).toMatchObject({ status: 'Draft', quantity: 1000, customerRef: 'QTN-0001', quotationId: q.value.id })
    expect(made.value.quotation).toMatchObject({ status: 'Accepted', planId: made.value.plan.id })
    expect(quotationToPlan(q.value.id)(made.db, admin()).ok).toBe(false)
    expect(saveQuotation(draft({ id: q.value.id, expectedUpdatedAt: made.value.quotation.updatedAt }))(made.db, admin()).ok).toBe(false)

    const plan = made.value.plan
    const allocated = must(savePlan({ ...plan, processUnits: { P1: 'U1' }, expectedUpdatedAt: plan.updatedAt })(made.db, admin()))
    expect(allocated.value.quotationId).toBe(q.value.id)
    const submitted = must(submitPlan(plan.id)(allocated.db, admin()))
    const costing = must(openCosting(plan.id)(submitted.db, admin()))
    expect(previewCosting(costing.db, costing.value)!.sellingPerPiece).toBe(12.5)
  })
})

describe('a quotation with rates changed for the order, all the way to the invoice', () => {
  it('keeps the quoted price per piece in the plan, the costing and the invoice, and splits GST for a URD buyer in the same state', () => {
    let { db, draft, materialId } = setup()
    db = must(saveCompanyProfile({ ...db.company, name: 'Vertex Print Pack', address: 'Sivakasi, Tamil Nadu', gstin: '33AAAAA0000A1Z5', expectedUpdatedAt: db.company.updatedAt })(db, admin())).db
    // The board is ₹15 for this order (Master ₹20), and pasting ₹450 per 1,000 (Master ₹500).
    const q = must(saveQuotation(draft({ inputs: { ...draft().inputs, materialPrices: { [materialId]: 15 }, processRates: { P1: 450 } } }))(db, admin()))
    const quoted = q.value.totals.sellingPerPiece
    expect(quoted).toBeLessThan(quoteCosting(db, draft())!.sellingPerPiece)

    const made = must(quotationToPlan(q.value.id)(q.db, admin()))
    // The plan shows the quoted material price under "Material prices for this order".
    expect(made.value.plan.materialPrices).toEqual({ [materialId]: 15 })
    const allocated = must(savePlan({ ...made.value.plan, processUnits: { P1: 'U1' }, expectedUpdatedAt: made.value.plan.updatedAt })(made.db, admin()))
    const submitted = must(submitPlan(made.value.plan.id)(allocated.db, admin()))
    const opened = must(openCosting(made.value.plan.id)(submitted.db, admin()))
    expect(previewCosting(opened.db, opened.value)!.sellingPerPiece).toBe(quoted)
    const fin = must(finalizeCosting(opened.value.id)(opened.db, admin()))
    expect(fin.value.costing.snapshot!.result.sellingPerPiece).toBe(quoted)

    // Production from the job drawer: start and complete the process — the order completes by itself.
    const order = fin.value.order
    const process = order.stages[0].processes[0]
    let next = must(startProcess(order.id, process.id)(fin.db, admin())).db
    const done = must(completeProcess(order.id, process.id)(next, admin()))
    expect(done.value.orderCompleted).toBe(true)
    next = done.db

    const dispatched = must(confirmDispatch({ requestId: 'r1', orderId: order.id, date: '2026-10-20', quantity: 600, deliveryAddress: 'Madurai', transporter: '', vehicleNo: '', notes: '' })(next, admin()))
    const invoice = dispatched.db.invoices[0]
    expect(invoice.lines[0].rate).toBe(quoted)
    expect(invoice).toMatchObject({ igst: null, cgstPct: 9, sgstPct: 9 })
    expect(Math.round((invoice.cgst! + invoice.sgst!) * 100)).toBe(Math.round(invoice.taxAmount * 100))
  })

  it('refuses to issue the invoice when the buyer’s state is not known', () => {
    let { db, draft } = setup()
    db = must(saveCompanyProfile({ ...db.company, name: 'Vertex Print Pack', address: 'Sivakasi', gstin: '33AAAAA0000A1Z5', expectedUpdatedAt: db.company.updatedAt })(db, admin())).db
    db = { ...db, customers: db.customers.map((c) => ({ ...c, placeOfSupply: '' })) }
    const q = must(saveQuotation(draft())(db, admin()))
    const made = must(quotationToPlan(q.value.id)(q.db, admin()))
    const allocated = must(savePlan({ ...made.value.plan, processUnits: { P1: 'U1' }, expectedUpdatedAt: made.value.plan.updatedAt })(made.db, admin()))
    const opened = must(openCosting(made.value.plan.id)(must(submitPlan(made.value.plan.id)(allocated.db, admin())).db, admin()))
    const fin = must(finalizeCosting(opened.value.id)(opened.db, admin()))
    const order = fin.value.order
    const p = order.stages[0].processes[0]
    const doneDb = must(completeProcess(order.id, p.id)(must(startProcess(order.id, p.id)(fin.db, admin())).db, admin())).db
    const r = confirmDispatch({ requestId: 'r2', orderId: order.id, date: '2026-10-20', quantity: 100, deliveryAddress: 'Godown', transporter: '', vehicleNo: '', notes: '' })(doneDb, admin())
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Place of supply/)
  })
})
