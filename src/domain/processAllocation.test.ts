import { describe, expect, it } from 'vitest'
import type { ProductStage, VertexDB } from '../lib/types'
import { ADMIN, UNIT, ctxFor, must, seedResources } from '../test/fixtures'
import { buildEmptyDB } from '../lib/defaults'
import { blankMaterialDraft, saveCustomer, saveMaterial, saveProduct } from './master'
import { savePlan, submitPlan } from './planning'
import { finalizeCosting, openCosting } from './orderCosting'
import { assignProcessResources, completeProcess, startProcess } from './production'
import { unitWork } from '../lib/selectors'
import { isStageDone } from '../lib/schedule'

/* The journey the revised requirements describe: one stage holding three
   processes, each allocated to a different unit. */

const admin = () => ctxFor(ADMIN[0])
/** Units have no accounts: Administrator 2 records unit n's work. */
const unit = (_n: number) => ctxFor(UNIT(_n))

const STAGE: ProductStage = {
  id: 'STG-001',
  name: 'Printing',
  description: '',
  processes: [
    { id: 'PRC-001', name: 'Plate preparation', description: '', setupHours: 1, runHoursPer1000: 0, chargeId: null, costBasis: 'fixed', rate: 0, setupCharge: 0, requiresMachine: false },
    { id: 'PRC-002', name: 'Offset printing', description: '', setupHours: 1, runHoursPer1000: 2, chargeId: null, costBasis: 'per_1000', rate: 500, setupCharge: 250, requiresMachine: true },
    { id: 'PRC-003', name: 'Print inspection', description: '', setupHours: 0.5, runHoursPer1000: 1, chargeId: null, costBasis: 'per_1000', rate: 100, setupCharge: 0, requiresMachine: false },
  ],
}

/** One product, one stage, three processes — then a plan allocating each to its own unit. */
function oneStageThreeProcesses() {
  let db: VertexDB = buildEmptyDB(new Date('2026-09-16T09:00:00'))
  const resources = seedResources(db)
  db = resources.db
  const material = must(saveMaterial({ ...blankMaterialDraft('sheet'), name: 'Board', price: 20, sheetLengthMm: 1000, sheetWidthMm: 700, edgeMarginMm: 5, cutGapMm: 3 })(db, admin()))
  db = material.db
  const product = must(
    saveProduct({
      code: '',
      name: 'Printed carton',
      category: '',
      description: '',
      hsn: '4819',
      uom: 'pcs',
      taxPct: null,
      stages: [STAGE],
      materials: [
        { id: 'bom-1', materialId: material.value.id, stageId: 'STG-001', processId: 'PRC-002', qtyPerPiece: 0, piecesPerProduct: 1, cutLengthMm: 200, cutWidthMm: 150, rotationAllowed: true, upsOverride: null, upsOverrideReason: '', note: '' },
      ],
    })(db, admin()),
  )
  db = product.db
  const customer = must(
    saveCustomer({ code: '', company: 'Example Traders', contactPerson: '', phone: '', email: '', billingAddress: 'Street', deliveryAddress: 'Street', gstin: '', placeOfSupply: '33', paymentTerms: '30 days', notes: '' })(db, admin()),
  )
  db = customer.db
  return { ...resources, db, productId: product.value.id, customerId: customer.value.id }
}

const planDraft = (customerId: string, productId: string, processUnits: Record<string, string>) => ({
  customerId,
  productId,
  quantity: 1000,
  orderDate: '2026-09-16',
  deliveryDate: '2026-10-16',
  priority: 'Normal' as const,
  customerRef: '',
  dimensions: '',
  options: '',
  instructions: '',
  processUnits,
})

describe('three processes in one stage, allocated to three units', () => {
  it('sends the plan to costing with no operator or machine, then shows each unit only its own process', () => {
    const base = oneStageThreeProcesses()
    const allocation = { 'PRC-001': 'U1', 'PRC-002': 'U2', 'PRC-003': 'U1' }
    const plan = must(savePlan(planDraft(base.customerId, base.productId, allocation))(base.db, admin()))
    // Journey 4: no responsible person or machine is required to send to costing.
    const submitted = must(submitPlan(plan.value.id)(plan.db, admin()))
    expect(submitted.value.status).toBe('Ready for Costing')

    const costing = must(openCosting(plan.value.id)(submitted.db, admin()))
    const finalized = must(finalizeCosting(costing.value.id)(costing.db, admin()))
    const order = finalized.value.order

    // Journey 3: one stage, three processes, each carrying its parent stage id.
    expect(order.stages).toHaveLength(1)
    const [stage] = order.stages
    expect(stage.processes.map((p) => [p.name, p.unitId, p.stageDefId])).toEqual([
      ['Plate preparation', 'U1', 'STG-001'],
      ['Offset printing', 'U2', 'STG-001'],
      ['Print inspection', 'U1', 'STG-001'],
    ])

    // Journey 5: each unit sees only the processes allocated to it.
    const u1 = unitWork(finalized.db.orders, 'U1')
    const u2 = unitWork(finalized.db.orders, 'U2')
    expect([...u1.ready, ...u1.waiting].map((r) => r.process.name)).toEqual(['Plate preparation', 'Print inspection'])
    expect([...u2.ready, ...u2.waiting].map((r) => r.process.name)).toEqual(['Offset printing'])
    // Only the first process can start; the rest wait for it.
    expect(u1.ready.map((r) => r.process.name)).toEqual(['Plate preparation'])
    expect(u2.ready).toHaveLength(0)
    return { order, db: finalized.db }
  })

  it('requires a machine only where the product says so, and completes the stage from its processes', () => {
    const base = oneStageThreeProcesses()
    const plan = must(savePlan(planDraft(base.customerId, base.productId, { 'PRC-001': 'U1', 'PRC-002': 'U2', 'PRC-003': 'U1' }))(base.db, admin()))
    const submitted = must(submitPlan(plan.value.id)(plan.db, admin()))
    const costing = must(openCosting(plan.value.id)(submitted.db, admin()))
    const finalized = must(finalizeCosting(costing.value.id)(costing.db, admin()))
    const order = finalized.value.order
    const [plate, print, inspect] = order.stages[0].processes
    let db = finalized.db

    // Journey 7: a manual process runs with no machine.
    db = must(
      assignProcessResources(order.id, plate.id, { responsiblePersonId: base.personOf('U1'), machineId: null, noMachineRequired: true })(db, unit(1)),
    ).db
    db = must(completeProcess(order.id, plate.id)(db, unit(1))).db

    // Journey 6/7: the unit may declare a machine-bound process manual — it is
    // recorded as such, with the override written to the audit trail.
    const manual = must(assignProcessResources(order.id, print.id, { responsiblePersonId: base.personOf('U2'), machineId: null, noMachineRequired: true })(db, unit(2)))
    expect(manual.value.noMachineRequired).toBe(true)
    expect(manual.value.machineId).toBeNull()
    expect(manual.db.audit[0].reason).toMatch(/manual although Master expects a machine/)
    // Choosing a machine afterwards clears the manual flag.
    db = must(
      assignProcessResources(order.id, print.id, { responsiblePersonId: base.personOf('U2'), machineId: base.machineOf('U2'), noMachineRequired: false })(manual.db, unit(2)),
    ).db
    // A machine from another unit is rejected.
    expect(
      assignProcessResources(order.id, print.id, { responsiblePersonId: base.personOf('U2'), machineId: base.machineOf('U1'), noMachineRequired: false })(db, unit(2)).ok,
    ).toBe(false)
    db = must(startProcess(order.id, print.id)(db, unit(2))).db
    db = must(completeProcess(order.id, print.id)(db, unit(2))).db

    // Journey 8: two of three done — the stage is in progress, not complete.
    expect(isStageDone(db.orders[0].stages[0])).toBe(false)
    expect(db.orders[0].stages[0].status).toBe('In Progress')
    expect(db.orders[0].status).toBe('Active')

    db = must(
      assignProcessResources(order.id, inspect.id, { responsiblePersonId: base.personOf('U1'), machineId: null, noMachineRequired: true })(db, unit(1)),
    ).db
    const done = must(completeProcess(order.id, inspect.id)(db, unit(1)))
    expect(done.value.stageCompleted).toBe(true)
    expect(done.value.orderCompleted).toBe(true)
    expect(done.db.orders[0].status).toBe('Completed')
  })
})
