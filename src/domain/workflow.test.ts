import { describe, expect, it } from 'vitest'
import { ADMIN, BILLING_ONLY, NOW, PROCESS_UNITS, RETIRED_UNIT, UNIT, ctxFor, must, seedMaster, seedResources } from '../test/fixtures'
import type { ProductionOrder, VertexDB } from '../lib/types'
import { saveMaterial, materialToDraft, deleteProduct, setProductActive } from './master'
import { cancelPlan, savePlan, submitPlan } from './planning'
import type { PlanDraft } from './planning'
import { finalizeCosting, openCosting } from './orderCosting'
import { assignProcessResources, completeProcess, reportProcessProblem, startProcess } from './production'
import { confirmDispatch, confirmDispatchReceived } from './dispatch'
import type { DispatchRequest } from './dispatch'
import { saveCompanyProfile } from './system'
import { DELIVERY_PENDING_MESSAGE, consolidatedStatement, invoiceDownloadBlock, orderBalance, orderInvoiceSummary, receivedInvoices } from '../lib/billing'
import { toPaise } from '../lib/costing'

const admin = (n = 0) => ctxFor(ADMIN[n])
const billingOnly = () => ctxFor(BILLING_ONLY)
const retiredUnit = () => ctxFor(RETIRED_UNIT)
const unit = (n: number) => ctxFor(UNIT(n))

function plan(db: VertexDB, customerId: string, productId: string, processUnits: Record<string, string>, quantity = 1000): PlanDraft {
  void db
  return {
    customerId,
    productId,
    quantity,
    orderDate: '2026-09-15',
    deliveryDate: '2026-10-10',
    priority: 'Normal',
    customerRef: 'PO-1',
    dimensions: '200 × 150 mm',
    options: '',
    instructions: '',
    processUnits,
  }
}

/** Master → plan → costing → production order, with a person and machine per unit. */
function toProduction(processUnits: Record<string, string> = PROCESS_UNITS, quantity = 1000) {
  const seeded = seedMaster()
  const resources = seedResources(seeded.db)
  let db = resources.db
  const p = must(savePlan(plan(db, seeded.customerId, seeded.productId, processUnits, quantity))(db, admin()))
  db = must(submitPlan(p.value.id)(p.db, admin())).db
  const c = must(openCosting(p.value.id)(db, admin()))
  const f = must(finalizeCosting(c.value.id)(c.db, admin()))
  return { ...seeded, ...resources, db: f.db, planId: p.value.id, costingId: c.value.id, order: f.value.order }
}

/** Every job process of an order, in execution order. */
const processes = (order: { stages: Array<{ processes: Array<{ id: string; unitId: string; name: string }> }> }) =>
  order.stages.flatMap((s) => s.processes)

const unitNo = (unitId: string) => Number(unitId.slice(1))

describe('planning', () => {
  it('requires a unit for every PROCESS before costing, and names the stage it belongs to', () => {
    const { db, customerId, productId } = seedMaster()
    // Only the first process of the first stage is allocated.
    const p = must(savePlan(plan(db, customerId, productId, { 'pr-plate': 'U1' }))(db, admin()))
    const r = submitPlan(p.value.id)(p.db, admin())
    expect(r.ok).toBe(false)
    if (!r.ok) {
      const messages = r.issues?.map((i) => i.message) ?? []
      expect(messages.join(' ')).toMatch(/Offset print/)
      expect(messages.join(' ')).toMatch(/Die cutting \(st-cut\)/)
      // The allocated process is not reported as missing.
      expect(messages.some((m) => m.includes('Plate making'))).toBe(false)
    }
  })

  it('does not require an operator or machine to send a plan to costing', () => {
    const { db, customerId, productId } = seedMaster()
    const p = must(savePlan(plan(db, customerId, productId, PROCESS_UNITS))(db, admin()))
    // No people or machines exist at all in this database.
    expect(p.db.people).toHaveLength(0)
    expect(p.db.machines).toHaveLength(0)
    expect(submitPlan(p.value.id)(p.db, admin()).ok).toBe(true)
  })

  it('cannot edit a plan once it is ready for costing, and cannot cancel one in production', () => {
    const { db, planId } = toProduction()
    const current = db.plans.find((p) => p.id === planId)!
    expect(current.status).toBe('In Production')
    expect(savePlan({ ...plan(db, current.customerId, current.productId, current.processUnits), id: planId })(db, admin()).ok).toBe(false)
    expect(cancelPlan(planId, 'x')(db, admin()).ok).toBe(false)
  })

  it('blocks deleting a product referenced by a plan but allows deactivation', () => {
    const { db, productId } = toProduction()
    expect(deleteProduct(productId)(db, admin()).ok).toBe(false)
    expect(setProductActive(productId, false)(db, admin()).ok).toBe(true)
  })
})

describe('costing finalization', () => {
  it('refuses to finalize while a material price is missing', () => {
    const seeded = seedMaster(undefined, { sheetPrice: null })
    let db = seeded.db
    const p = must(savePlan(plan(db, seeded.customerId, seeded.productId, PROCESS_UNITS))(db, admin()))
    db = must(submitPlan(p.value.id)(p.db, admin())).db
    const c = must(openCosting(p.value.id)(db, admin()))
    const r = finalizeCosting(c.value.id)(c.db, admin())
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.issues?.[0].message).toMatch(/Price missing/)
    expect(c.db.orders).toHaveLength(0)
  })

  it('creates exactly one production order on repeated confirmation', () => {
    const { db, costingId, order } = toProduction()
    const again = must(finalizeCosting(costingId)(db, admin()))
    expect(again.value.created).toBe(false)
    expect(again.value.order.id).toBe(order.id)
    expect(again.db.orders).toHaveLength(1)
    expect(must(openCosting(order.planId)(again.db, admin())).value.id).toBe(costingId)
  })

  it('schedules every process, each carrying its own unit and its parent stage id', () => {
    const { order } = toProduction({ ...PROCESS_UNITS, 'pr-print': 'U2' })
    expect(processes(order).map((pr) => [pr.name, pr.unitId])).toEqual([
      ['Plate making', 'U1'],
      ['Offset print', 'U2'],
      ['Die cut', 'U2'],
      ['Pasting', 'U1'],
      ['Packing', 'U1'],
    ])
    // Processes of one stage may sit in different units; the stage keeps its identity.
    const printing = order.stages[0]
    expect(printing.processes.map((pr) => pr.stageDefId)).toEqual(['st-print', 'st-print'])
    expect(printing.processes.map((pr) => pr.stageName)).toEqual(['Printing', 'Printing'])
    expect(new Date(printing.processes[1].plannedStart) >= new Date(printing.processes[0].plannedEnd)).toBe(true)
  })
})

describe('production workflow across units', () => {
  /** Allocate the unit's own person (and machine when needed) to a process. */
  const resource = (db: VertexDB, order: ProductionOrder, processId: string, personOf: (u: string) => string, machineOf: (u: string) => string) => {
    const target = processes(order).find((pr) => pr.id === processId)!
    return must(
      assignProcessResources(order.id, processId, {
        responsiblePersonId: personOf(target.unitId),
        machineId: machineOf(target.unitId),
        noMachineRequired: false,
      })(db, unit(unitNo(target.unitId))),
    ).db
  }

  it('administrators record every unit’s work; a leftover unit account cannot', () => {
    const { db, order, personOf, machineOf } = toProduction()
    const first = processes(order)[0]
    const ready = resource(db, order, first.id, personOf, machineOf)
    expect(startProcess(order.id, first.id)(ready, retiredUnit()).ok).toBe(false)
    expect(startProcess(order.id, first.id)(ready, billingOnly()).ok).toBe(false)
    expect(startProcess(order.id, first.id)(ready, admin()).ok).toBe(true)
    expect(startProcess(order.id, first.id)(ready, admin(1)).ok).toBe(true)
  })

  it('refuses to start before a responsible person is allocated', () => {
    const { db, order } = toProduction()
    const first = processes(order)[0]
    const r = startProcess(order.id, first.id)(db, unit(1))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/responsible person/i)
  })

  it('accepts a manual process with no machine, and lets a unit declare a machine-bound one manual', () => {
    const { db, order, personOf } = toProduction()
    const manual = processes(order)[0]
    const assigned = must(
      assignProcessResources(order.id, manual.id, { responsiblePersonId: personOf(manual.unitId), machineId: null, noMachineRequired: true })(db, unit(1)),
    )
    expect(assigned.value.noMachineRequired).toBe(true)
    expect(startProcess(order.id, manual.id)(assigned.db, unit(1)).ok).toBe(true)

    // A machine-bound process still refuses an empty allocation, but the unit
    // may declare it manual: they are the ones running it.
    const machineBound = { ...assigned.db }
    machineBound.orders = machineBound.orders.map((o) => ({
      ...o,
      stages: o.stages.map((st) => ({ ...st, processes: st.processes.map((pr) => (pr.id === manual.id ? { ...pr, requiresMachine: true } : pr)) })),
    }))
    const denied = assignProcessResources(order.id, manual.id, { responsiblePersonId: personOf(manual.unitId), machineId: null, noMachineRequired: false })(
      machineBound,
      unit(1),
    )
    expect(denied.ok).toBe(false)
    if (!denied.ok) expect(denied.error).toMatch(/machine/i)

    const declaredManual = must(
      assignProcessResources(order.id, manual.id, { responsiblePersonId: personOf(manual.unitId), machineId: null, noMachineRequired: true })(machineBound, unit(1)),
    )
    expect(declaredManual.value.noMachineRequired).toBe(true)
  })

  it('completing one process never completes another, and the stage closes only when all of its processes are done', () => {
    const { db, order, personOf, machineOf } = toProduction()
    const [plate, print] = processes(order)
    let next = resource(db, order, plate.id, personOf, machineOf)
    next = must(completeProcess(order.id, plate.id)(next, unit(1))).db

    const printing = next.orders[0].stages[0]
    expect(printing.processes[0].status).toBe('Completed')
    // The sibling process is untouched and the stage is still open.
    expect(printing.processes[1].status).toBe('Scheduled')
    expect(printing.processes[1].id).toBe(print.id)
    expect(printing.status).toBe('In Progress')
    expect(next.orders[0].status).toBe('Active')

    next = resource(next, order, print.id, personOf, machineOf)
    const closed = must(completeProcess(order.id, print.id)(next, unit(1)))
    expect(closed.value.stageCompleted).toBe(true)
    expect(closed.db.orders[0].stages[0].status).toBe('Completed')
    // Later stages are still open, so the order is not complete.
    expect(closed.value.orderCompleted).toBe(false)
  })

  it('holds a process until every earlier process is complete', () => {
    const { db, order, personOf, machineOf } = toProduction()
    const die = processes(order)[2]
    const ready = resource(db, order, die.id, personOf, machineOf)
    const r = startProcess(order.id, die.id)(ready, unit(2))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Waiting for/)
  })

  it('completes the order only when the last process finishes, making it dispatchable', () => {
    const { db: start, order, personOf, machineOf } = toProduction()
    let db = start
    const all = processes(order)

    db = resource(db, order, all[0].id, personOf, machineOf)
    db = must(completeProcess(order.id, all[0].id)(db, unit(1))).db
    db = resource(db, order, all[1].id, personOf, machineOf)
    db = must(reportProcessProblem(order.id, all[1].id, 'Plate damaged')(db, unit(1))).db
    expect(db.orders[0].stages[0].processes[1].status).toBe('Blocked')
    expect(db.orders[0].stages[0].status).toBe('Blocked')
    db = must(startProcess(order.id, all[1].id)(db, unit(1))).db
    db = must(completeProcess(order.id, all[1].id)(db, unit(1))).db

    for (const pr of all.slice(2, -1)) {
      db = resource(db, order, pr.id, personOf, machineOf)
      db = must(completeProcess(order.id, pr.id)(db, unit(unitNo(pr.unitId)))).db
      expect(db.orders[0].status).toBe('Active')
    }

    const lastProcess = all[all.length - 1]
    db = resource(db, order, lastProcess.id, personOf, machineOf)
    const last = must(completeProcess(order.id, lastProcess.id)(db, unit(unitNo(lastProcess.unitId))))
    expect(last.value.orderCompleted).toBe(true)
    expect(last.db.orders[0].status).toBe('Completed')
    expect(orderBalance(last.db.orders[0], []).remainingQty).toBe(1000)
  })
})

/** Drive an order through every process, allocating resources on the way. */
export function finishAllProcesses(db: VertexDB, order: ProductionOrder, personOf: (u: string) => string, machineOf: (u: string) => string): VertexDB {
  let next = db
  for (const pr of processes(order)) {
    next = must(
      assignProcessResources(order.id, pr.id, { responsiblePersonId: personOf(pr.unitId), machineId: machineOf(pr.unitId), noMachineRequired: false })(
        next,
        unit(unitNo(pr.unitId)),
      ),
    ).db
    next = must(completeProcess(order.id, pr.id)(next, unit(unitNo(pr.unitId)))).db
  }
  return next
}
function completedOrder(quantity = 1000) {
  const base = toProduction(PROCESS_UNITS, quantity)
  let db = finishAllProcesses(base.db, base.order, base.personOf, base.machineOf)
  db = must(
    saveCompanyProfile({ name: 'Vertex Print Pack', address: 'Factory road', phone: '', email: '', gstin: '33AAAAA0000A1Z5', invoicePrefix: 'INV', bankDetails: '', invoiceTerms: '' })(db, admin()),
  ).db
  return { ...base, db }
}

const req = (orderId: string, requestId: string, quantity: number, date = '2026-09-15'): DispatchRequest => ({
  requestId,
  orderId,
  date,
  quantity,
  deliveryAddress: 'Warehouse road, City',
  transporter: '',
  vehicleNo: '',
  notes: '',
})

describe('dispatch and billing', () => {
  it('cannot dispatch before production completes', () => {
    const { db, order } = toProduction()
    const r = confirmDispatch(req(order.id, 'r0', 10))(db, admin())
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/still in production/)
  })

  it('dispatches 100 then 200, leaves 700, and never bills a request twice', () => {
    const { db: start, order } = completedOrder()
    const first = must(confirmDispatch(req(order.id, 'req-1', 100))(start, admin(0)))
    expect(first.value.invoice.lines[0].quantity).toBe(100)
    expect(first.value.invoice.number).toBe('INV/2026-27/0001')

    const replay = must(confirmDispatch(req(order.id, 'req-1', 100))(first.db, admin(0)))
    expect(replay.value.duplicate).toBe(true)
    expect(replay.db).toBe(first.db)
    expect(replay.db.invoices).toHaveLength(1)

    const second = must(confirmDispatch(req(order.id, 'req-2', 200, '2026-09-16'))(first.db, admin(1)))
    const balance = orderBalance(second.db.orders[0], second.db.dispatches)
    expect(balance.dispatchedQty).toBe(300)
    expect(balance.remainingQty).toBe(700)
    expect(second.db.invoices.map((i) => i.number)).toEqual(['INV/2026-27/0001', 'INV/2026-27/0002'])

    const over = confirmDispatch(req(order.id, 'req-3', 701, '2026-09-16'))(second.db, admin())
    expect(over.ok).toBe(false)
    const backdated = confirmDispatch(req(order.id, 'req-4', 10, '2026-09-14'))(second.db, admin())
    expect(backdated.ok).toBe(false)

    const final = must(confirmDispatch(req(order.id, 'req-5', 700, '2026-09-17'))(second.db, admin(1)))
    const costing = final.db.costings[0].snapshot!.result
    const statement = consolidatedStatement(final.db.orders[0], final.db.invoices, costing)
    expect(statement.fullyInvoiced).toBe(true)
    expect(statement.reconciles).toBe(true)
    expect(toPaise(statement.total)).toBe(toPaise(costing.grandTotal))
    expect(confirmDispatch(req(order.id, 'req-6', 1, '2026-09-17'))(final.db, admin()).ok).toBe(false)
  })

  it('requires a complete company profile to invoice', () => {
    const base = toProduction()
    const db = finishAllProcesses(base.db, base.order, base.personOf, base.machineOf)
    const r = confirmDispatch(req(base.order.id, 'x', 10))(db, admin())
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/company profile/i)
  })

  it('keeps issued invoices unchanged after a master price edit', () => {
    const { db: start, order, sheetId } = completedOrder()
    const issued = must(confirmDispatch(req(order.id, 'req-1', 100))(start, admin()))
    const before = JSON.stringify(issued.db.invoices[0])
    const snapshotBefore = JSON.stringify(issued.db.costings[0].snapshot)
    const material = issued.db.materials.find((m) => m.id === sheetId)!
    const edited = must(saveMaterial({ ...materialToDraft(material), price: 99 })(issued.db, admin()))
    expect(edited.db.materials.find((m) => m.id === sheetId)!.price).toBe(99)
    expect(JSON.stringify(edited.db.invoices[0])).toBe(before)
    expect(JSON.stringify(edited.db.costings[0].snapshot)).toBe(snapshotBefore)
    const next = must(confirmDispatch(req(order.id, 'req-2', 100))(edited.db, admin()))
    expect(next.value.invoice.lines[0].rate).toBe(issued.db.invoices[0].lines[0].rate)
  })
})

describe('audit attribution', () => {
  it('records each administrator separately and keeps their identities', () => {
    const { db } = completedOrder()
    // Administrator 2 operates dispatch; the retired billing-only tier may not.
    expect(confirmDispatch(req(db.orders[0].id, 'a', 10))(db, billingOnly()).ok).toBe(false)
    const r = must(confirmDispatch(req(db.orders[0].id, 'a', 10))(db, admin(1)))
    const byUser = new Set(r.db.audit.map((a) => a.userId))
    expect(byUser.has('USR-ADM1')).toBe(true)
    expect(byUser.has('USR-ADM2')).toBe(true)
    // Shop-floor work is attributed to the administrator who recorded it; no unit account exists.
    expect([...byUser].some((id) => id.startsWith('USR-U'))).toBe(false)
    expect(r.db.audit.find((a) => a.action === 'Invoice generated')?.user).toBe('Administrator 2')
    expect(NOW.getFullYear()).toBe(2026)
  })
})

describe('company profile editing', () => {
  const profile = { name: 'Vertex Print Pack', address: 'Factory road', phone: '', email: '', gstin: '33AAAAA0000A1Z5', invoicePrefix: 'INV', bankDetails: '', invoiceTerms: '' }

  it('only Administrator 1 can save it — Administrator 2 and retired accounts are refused', () => {
    const { db } = completedOrder()
    for (const ctx of [admin(1), billingOnly(), retiredUnit()]) {
      const r = saveCompanyProfile({ ...profile, name: 'Hijacked', expectedUpdatedAt: db.company.updatedAt })(db, ctx)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toMatch(/does not have access/)
    }
  })

  it('explains an invalid GSTIN beside the field instead of saving', () => {
    const { db } = completedOrder()
    const r = saveCompanyProfile({ ...profile, gstin: '1234567890', expectedUpdatedAt: db.company.updatedAt })(db, admin())
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.fieldErrors?.gstin).toMatch(/15-character GSTIN.*You entered 10 characters/)
  })

  it('can be edited after invoicing: new invoices use it, issued ones and the counter are untouched', () => {
    const { db: start, order } = completedOrder()
    const first = must(confirmDispatch(req(order.id, 'req-1', 100))(start, admin()))
    const issued = JSON.stringify(first.db.invoices)

    const edited = must(
      saveCompanyProfile({ ...profile, name: 'Vertex Print Pack Pvt Ltd', address: 'New estate', expectedUpdatedAt: first.db.company.updatedAt })(first.db, admin()),
    )
    expect(edited.db.company.name).toBe('Vertex Print Pack Pvt Ltd')
    expect(JSON.stringify(edited.db.invoices)).toBe(issued)
    expect(edited.db.counters).toEqual(first.db.counters)

    // …and it can be edited again from the saved values.
    const again = must(saveCompanyProfile({ ...profile, ...edited.db.company, phone: '0422 000000', expectedUpdatedAt: edited.db.company.updatedAt })(edited.db, admin()))
    expect(again.db.company.phone).toBe('0422 000000')

    const second = must(confirmDispatch(req(order.id, 'req-2', 200, '2026-09-16'))(again.db, admin()))
    const [old, fresh] = second.db.invoices.slice().sort((a, b) => a.number.localeCompare(b.number))
    expect(old.company.name).toBe('Vertex Print Pack')
    expect(old.total).toBe(first.value.invoice.total)
    expect(fresh.company.name).toBe('Vertex Print Pack Pvt Ltd')
    expect(fresh.number).toBe('INV/2026-27/0002')
  })
})

describe('cumulative invoice summary', () => {
  const summarise = (db: VertexDB, orderId: string) => {
    const order = db.orders.find((o) => o.id === orderId)!
    const view = orderInvoiceSummary(order, db.dispatches, db.invoices)
    const st = consolidatedStatement(order, receivedInvoices(orderId, db.dispatches, db.invoices), db.costings.find((c) => c.id === order.costingId)!.snapshot!.result)
    return { view, st }
  }
  const receive = (db: VertexDB, dispatchId: string, n = 0) => must(confirmDispatchReceived(dispatchId)(db, admin(n))).db

  it('covers only shipments confirmed received: 0 → 300 → 300 → 5,300 → 7,300 of 10,000', () => {
    const { db: start, order } = completedOrder(10_000)
    let db = start

    const d1 = must(confirmDispatch(req(order.id, 'r1', 300, '2026-09-15'))(db, admin()))
    db = d1.db
    expect(summarise(db, order.id).st.invoices).toHaveLength(0)
    expect(invoiceDownloadBlock(d1.value.invoice, db.dispatches)).toBe(DELIVERY_PENDING_MESSAGE)
    expect(summarise(db, order.id).view).toMatchObject({ dispatchedQty: 300, receivedQty: 0, awaitingQty: 300, remainingQty: 9_700 })

    db = receive(db, d1.value.dispatch.id)
    expect(invoiceDownloadBlock(d1.value.invoice, db.dispatches)).toBeNull()
    expect(summarise(db, order.id).st.invoicedQty).toBe(300)

    const d2 = must(confirmDispatch(req(order.id, 'r2', 5_000, '2026-09-16'))(db, admin(1)))
    db = d2.db
    expect(summarise(db, order.id).st.invoicedQty).toBe(300)
    expect(summarise(db, order.id).view).toMatchObject({ dispatchedQty: 5_300, receivedQty: 300, awaitingQty: 5_000, remainingQty: 4_700 })

    db = receive(db, d2.value.dispatch.id, 1)
    expect(summarise(db, order.id).st.invoicedQty).toBe(5_300)

    const d3 = must(confirmDispatch(req(order.id, 'r3', 2_000, '2026-09-17'))(db, admin()))
    db = receive(d3.db, d3.value.dispatch.id)
    const { view, st } = summarise(db, order.id)
    expect(st.invoicedQty).toBe(7_300)
    expect(view).toMatchObject({ dispatchedQty: 7_300, receivedQty: 7_300, awaitingQty: 0, remainingQty: 2_700, status: 'partial' })
    // Totals are the paise-exact sum of the saved invoices; each invoice keeps its own quantity.
    expect(toPaise(st.total)).toBe(db.invoices.reduce((sum, inv) => sum + toPaise(inv.total), 0))
    expect(db.invoices.map((i) => i.partial.thisQty)).toEqual([300, 5_000, 2_000])
    expect(db.invoices.map((i) => i.number)).toEqual(['INV/2026-27/0001', 'INV/2026-27/0002', 'INV/2026-27/0003'])

    // Summarising is read-only.
    const before = JSON.stringify({ invoices: db.invoices, dispatches: db.dispatches, counters: db.counters })
    summarise(db, order.id)
    expect(JSON.stringify({ invoices: db.invoices, dispatches: db.dispatches, counters: db.counters })).toBe(before)
  })

  it('confirms each shipment separately, once, by Administrator 1 or 2 only', () => {
    const { db: start, order } = completedOrder(10_000)
    const d1 = must(confirmDispatch(req(order.id, 'r1', 300))(start, admin()))
    const d2 = must(confirmDispatch(req(order.id, 'r2', 500))(d1.db, admin()))
    let db = d2.db
    const before = { balance: orderBalance(db.orders[0], db.dispatches), invoices: JSON.stringify(db.invoices), order: JSON.stringify(db.orders[0]) }

    // The retired billing-only tier and leftover unit accounts cannot confirm.
    for (const ctx of [billingOnly(), retiredUnit()]) expect(confirmDispatchReceived(d1.value.dispatch.id)(db, ctx).ok).toBe(false)

    const r = must(confirmDispatchReceived(d1.value.dispatch.id)(db, admin(1)))
    db = r.db
    expect(r.value).toMatchObject({ receivedBy: 'Administrator 2' })
    expect(r.value.receivedAt).toBeTruthy()
    // Only that shipment; quantities, balances, invoices and the order are untouched.
    expect(db.dispatches.find((d) => d.id === d2.value.dispatch.id)!.receivedAt ?? null).toBeNull()
    expect(orderBalance(db.orders[0], db.dispatches)).toEqual(before.balance)
    expect(JSON.stringify(db.invoices)).toBe(before.invoices)
    expect(JSON.stringify(db.orders[0])).toBe(before.order)

    // A second confirmation is refused and changes nothing.
    const again = confirmDispatchReceived(d1.value.dispatch.id)(db, admin())
    expect(again.ok).toBe(false)
    if (!again.ok) expect(again.error).toMatch(/already confirmed received by Administrator 2/)
  })

  it('never marks historical shipments received and ignores current master rates', () => {
    const a = completedOrder(10_000)
    let db = must(confirmDispatch(req(a.order.id, 'a-1', 300))(a.db, admin())).db
    // A shipment saved before this feature has no receipt fields at all.
    db = { ...db, dispatches: db.dispatches.map(({ receivedAt: _r, receivedBy: _b, ...legacy }) => legacy) }
    expect(summarise(db, a.order.id).view.receivedQty).toBe(0)
    db = receive(db, db.dispatches[0].id)
    const issuedTotal = db.invoices[0].total
    const other = { ...db.orders[0], id: 'ORD-OTHER', code: 'JOB-9999' }
    db = { ...db, orders: [...db.orders, other] }
    expect(orderInvoiceSummary(other, db.dispatches, db.invoices).dispatchedQty).toBe(0)

    const material = db.materials.find((m) => m.id === a.sheetId)!
    db = must(saveMaterial({ ...materialToDraft(material), price: 999 })(db, admin())).db
    const { view, st } = summarise(db, a.order.id)
    expect(view.receivedBilled).toBe(issuedTotal)
    expect(st.total).toBe(issuedTotal)
  })
})
