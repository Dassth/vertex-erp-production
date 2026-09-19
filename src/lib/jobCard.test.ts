import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { writeFileSync } from 'node:fs'
import type { TDocumentDefinitions } from 'pdfmake/interfaces'
import { ADMIN, PROCESS_UNITS, UNIT, ctxFor, must, seedMaster, seedResources } from '../test/fixtures'
import { savePlan, setPlanPinned, submitPlan } from '../domain/planning'
import { finalizeCosting, openCosting } from '../domain/orderCosting'
import { assignProcessResources, completeProcess } from '../domain/production'
import { confirmDispatch } from '../domain/dispatch'
import { saveCompanyProfile } from '../domain/system'
import { jobCard } from './jobCard'
import { FONT_FAMILY, jobCardDefinition } from './pdfDocs'
import { matchesFilter, sortPlans } from './planList'
import type { Plan, Priority, VertexDB } from './types'

/** One plan all the way through: costed, produced, dispatched; plus a draft plan. */
function workflow() {
  const seeded = seedMaster()
  const res = seedResources(seeded.db)
  let db: VertexDB = res.db
  const draft = (priority: Priority, quantity: number) =>
    must(
      savePlan({ customerId: seeded.customerId, productId: seeded.productId, quantity, orderDate: '2026-09-15', deliveryDate: '2026-10-10', priority, customerRef: 'PO-7781', dimensions: '200 x 150 x 60 mm', options: 'Gold foil logo', instructions: 'Pack 50 per carton', processUnits: PROCESS_UNITS })(db, ctxFor()),
    )
  const plan = draft('Urgent', 1000)
  db = must(submitPlan(plan.value.id)(plan.db, ctxFor())).db
  const costing = must(openCosting(plan.value.id)(db, ctxFor()))
  const f = must(finalizeCosting(costing.value.id)(costing.db, ctxFor()))
  db = f.db
  const order = f.value.order
  for (const pr of order.stages.flatMap((s) => s.processes)) {
    const u = ctxFor(UNIT(Number(pr.unitId.slice(1))))
    db = must(assignProcessResources(order.id, pr.id, { responsiblePersonId: res.personOf(pr.unitId), machineId: res.machineOf(pr.unitId), noMachineRequired: false })(db, u)).db
    db = must(completeProcess(order.id, pr.id)(db, u)).db
  }
  db = must(saveCompanyProfile({ name: 'Vertex Print Pack', address: 'Sivakasi', phone: '', email: '', gstin: '33AMQPA8484N1ZE', invoicePrefix: 'INV', bankDetails: '', invoiceTerms: '' })(db, ctxFor())).db
  db = must(confirmDispatch({ requestId: 'r1', orderId: order.id, date: '2026-09-18', quantity: 400, deliveryAddress: 'Warehouse', transporter: 'Fast Freight', vehicleNo: '', notes: '' })(db, ctxFor(ADMIN[0]))).db
  const second = draft('Low', 500)
  return { db: second.db, planId: plan.value.id, draftId: second.value.id }
}

describe('job card', () => {
  it('covers the plan from customer to dispatch, with no prices', () => {
    const { db, planId } = workflow()
    const card = jobCard(db, planId)!
    expect(card.orderCode).toMatch(/^CUS-0001-20260915-0\d$/)
    expect(card.plan.priority).toBe('Urgent')
    expect(card.processes.length).toBeGreaterThan(0)
    expect(card.processes.every((p) => p.done)).toBe(true)
    expect(card.processes[0].resource).not.toBe('—')
    expect(card.materials.length).toBeGreaterThan(0)
    expect(card.dispatches).toHaveLength(1)
    expect(card.dispatches[0].invoice).toMatch(/^INV\//)
    expect(card.productionStatus).toMatch(/^Completed/)
  })

  it('has a plan version without people, status or dispatches', () => {
    const { db, planId } = workflow()
    const card = jobCard(db, planId, 'plan')!
    expect(card.mode).toBe('plan')
    expect(card.processes.every((p) => !p.person && !p.status && !p.actual)).toBe(true)
    expect(card.dispatches).toHaveLength(0)
    expect(card.processes[0].unit).not.toBe('')
  })

  it('shows staff role and experience, and machine make and age, on the live version', () => {
    const { db, planId } = workflow()
    db.people = db.people.map((p) => ({ ...p, designation: 'Operator', experienceYears: 6 }))
    db.machines = db.machines.map((m) => ({ ...m, make: 'Heidelberg', model: 'SM 74', installedYear: 2018 }))
    const card = jobCard(db, planId, 'live', new Date('2026-09-19T10:00:00'))!
    expect(card.processes[0].person).toMatch(/Operator · 6 yrs exp\./)
    expect(card.processes[0].machine).toMatch(/Heidelberg SM 74 · 8 yrs old/)
    expect(card.progress.done).toBe(card.progress.total)
  })

  it('renders a PDF', async () => {
    const { db, planId } = workflow()
    db.people = db.people.map((p) => ({ ...p, designation: 'Operator', experienceYears: 6 }))
    db.machines = db.machines.map((m) => ({ ...m, make: 'Heidelberg', model: 'SM 74', installedYear: 2018 }))
    const order = db.orders[0]
    db.orders = [{ ...order, stages: order.stages.map((s, i) => (i === 0 ? { ...s, processes: s.processes.map((p, j) => (j === 0 ? { ...p, note: 'Plates checked twice', problem: 'Registration drift on first 50 sheets' } : p)) } : s)) }, ...db.orders.slice(1)]
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
    for (const mode of ['plan', 'live'] as const) {
      const pdf = await pdfmake.createPdf(jobCardDefinition(jobCard(db, planId, mode, new Date('2026-09-19T10:00:00'))!, company, new Date('2026-09-19T10:00:00'))).getBuffer()
      expect(pdf.subarray(0, 4).toString()).toBe('%PDF')
      expect(pdf.toString('latin1')).not.toMatch(/₹/)
      if (process.env.PDF_OUT) writeFileSync(process.env.PDF_OUT.replace('.pdf', `-jobcard-${mode}.pdf`), pdf)
    }
  })
})

interface PdfMake {
  addFonts(f: unknown): void
  setUrlAccessPolicy(cb: (u: string) => boolean): void
  setLocalAccessPolicy(cb: (p: string) => boolean): void
  createPdf(def: TDocumentDefinitions): { getBuffer(): Promise<Buffer> }
}

describe('plan list order', () => {
  const p = (id: string, priority: Priority, updatedAt: string, extra: Partial<Plan> = {}) => ({ id, priority, updatedAt, createdAt: updatedAt, deliveryDate: '2026-10-01', status: 'Draft', ...extra }) as Plan

  it('keeps pinned plans on top, most recently pinned first', () => {
    const plans = [p('a', 'Low', '2026-09-19'), p('b', 'Normal', '2026-09-01', { pinned: true, pinnedAt: '2026-09-10' }), p('c', 'Urgent', '2026-09-18'), p('d', 'Low', '2026-08-01', { pinned: true, pinnedAt: '2026-09-15' })]
    expect(sortPlans(plans).map((x) => x.id)).toEqual(['d', 'b', 'a', 'c'])
    expect(sortPlans(plans, 'priority').map((x) => x.id)).toEqual(['d', 'b', 'c', 'a'])
  })

  it('filters by priority', () => {
    const plans = [p('a', 'Urgent', ''), p('b', 'High', ''), p('c', 'Normal', '')]
    expect(plans.filter((x) => matchesFilter(x, 'high')).map((x) => x.id)).toEqual(['a', 'b'])
    expect(plans.filter((x) => matchesFilter(x, 'urgent')).map((x) => x.id)).toEqual(['a'])
  })

  it('pinning does not touch the plan edit timestamp', () => {
    const { db, draftId } = workflow()
    const before = db.plans.find((x) => x.id === draftId)!
    const after = must(setPlanPinned(draftId, true)(db, ctxFor())).value
    expect(after.pinned).toBe(true)
    expect(after.updatedAt).toBe(before.updatedAt)
  })
})
