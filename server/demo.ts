/* ---------------------------------------------------------------------------
 * A demo dataset for trying Settings → Import on an installed copy: a small
 * printing & packaging business mid-month — materials, products, customers,
 * orders in every state (finished and billed, in production, waiting for
 * costing), invoices, and money in and out. Built only through the domain
 * commands, so it is exactly what the app itself would have saved.
 *
 *   DEMO_BACKUP_OUT=release\VertexERP-demo-data.zip npx vitest run server/demo.test.ts
 * ------------------------------------------------------------------------- */

import type { Ctx, OpResult } from '../src/domain/common'
import { blankMaterialDraft, saveCustomer, saveMaterial, saveProduct } from '../src/domain/master'
import type { ProductDraft } from '../src/domain/master'
import { saveMachine, savePerson } from '../src/domain/resources'
import { savePlan, submitPlan } from '../src/domain/planning'
import { finalizeCosting, openCosting } from '../src/domain/orderCosting'
import { assignProcessResources, completeProcess, finishOrderProduction, startProcess } from '../src/domain/production'
import { confirmDispatch } from '../src/domain/dispatch'
import { saveCompanyProfile } from '../src/domain/system'
import { saveMoneyEntry } from '../src/domain/cashbook'
import type { MoneyDraft } from '../src/domain/cashbook'
import { buildEmptyDB } from '../src/lib/defaults'
import type { ProductProcess, ProductStage, VertexDB } from '../src/lib/types'

const ADMIN1 = { id: 'USR-ADM1', name: 'Administrator 1', role: 'admin' as const, unitId: null, adminTier: 'full' as const }

function must<T>(r: OpResult<T>): { db: VertexDB; value: T } {
  if (!r.ok) throw new Error(`Demo data: ${r.error} ${JSON.stringify(r.fieldErrors ?? r.issues ?? '')}`)
  return { db: r.db, value: r.value }
}

const proc = (id: string, name: string, over: Partial<ProductProcess> = {}): ProductProcess => ({
  id,
  name,
  description: '',
  setupHours: 1,
  runHoursPer1000: 2,
  chargeId: null,
  costBasis: 'per_1000',
  rate: 450,
  setupCharge: 300,
  requiresMachine: false,
  ...over,
})

/** The demo business as of `today` (orders dated in the days before it). */
export function buildDemoDB(today: Date): VertexDB {
  let seq = 0
  const at = (daysAgo: number, hour = 10) => {
    const d = new Date(today)
    d.setDate(d.getDate() - daysAgo)
    d.setHours(hour, 0, 0, 0)
    return d
  }
  const iso = (daysAgo: number) => {
    const d = at(daysAgo)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const ctx = (daysAgo = 0, hour = 10): Ctx => ({ actor: ADMIN1, now: at(daysAgo, hour), newId: (p) => `${p}-DEMO${++seq}` })

  let db = buildEmptyDB(at(20, 9))
  const run = <T>(r: (db: VertexDB, ctx: Ctx) => OpResult<T>, c: Ctx = ctx(20)) => {
    const out = must(r(db, c))
    db = out.db
    return out.value
  }

  run(
    saveCompanyProfile({
      name: 'Vertex Print Pack',
      address: 'Demo address, Sivakasi, Tamil Nadu',
      phone: '',
      email: '',
      gstin: '33AAAAA0000A1Z5',
      invoicePrefix: 'DEMO',
      bankDetails: 'Demo bank · A/c 000000000000 · IFSC DEMO0000000',
      invoiceTerms: 'Payment within 30 days. Demo data — not a real invoice.',
      documentWatermark: true,
    }),
  )

  // Materials
  const artBoard = run(saveMaterial({ ...blankMaterialDraft('sheet'), name: 'Art board 300 GSM', price: 14, sheetLengthMm: 1000, sheetWidthMm: 700, edgeMarginMm: 5, cutGapMm: 3, wastagePct: 5 }))
  const duplex = run(saveMaterial({ ...blankMaterialDraft('sheet'), name: 'Duplex board 350 GSM', price: 11.5, sheetLengthMm: 1020, sheetWidthMm: 720, edgeMarginMm: 5, cutGapMm: 3, wastagePct: 5 }))
  const glue = run(saveMaterial({ ...blankMaterialDraft('quantity'), name: 'PVA adhesive', uom: 'kg', price: 210, wastagePct: 10, purchaseMultiple: 0.5 }))
  const film = run(saveMaterial({ ...blankMaterialDraft('quantity'), name: 'BOPP lamination film', uom: 'kg', price: 260, wastagePct: 8, purchaseMultiple: 1 }))

  // Products: print → die cut → paste & pack
  const product = (name: string, category: string, hsn: string, sheetId: string, cut: [number, number], laminate: boolean) => {
    const printing: ProductStage = {
      id: 'st-print',
      name: 'Printing',
      description: '',
      processes: [proc('pr-plate', 'Plate making', { costBasis: 'fixed', rate: 900, setupCharge: 0, runHoursPer1000: 0 }), proc('pr-print', 'Offset print (4 colour)')],
    }
    if (laminate) printing.processes.push(proc('pr-lam', 'Lamination', { rate: 350, setupCharge: 150 }))
    const stages: ProductStage[] = [
      printing,
      { id: 'st-cut', name: 'Die cutting', description: '', processes: [proc('pr-die', 'Die cut', { costBasis: 'per_hour', rate: 320, setupCharge: 0, setupHours: 0.5 })] },
      { id: 'st-pack', name: 'Pasting & packing', description: '', processes: [proc('pr-paste', 'Pasting', { rate: 180, setupCharge: 0 }), proc('pr-pack', 'Packing', { rate: 90, setupCharge: 0 })] },
    ]
    const draft: ProductDraft = {
      code: '',
      name,
      category,
      description: '',
      hsn,
      uom: 'pcs',
      taxPct: null,
      stages,
      materials: [
        { id: 'bom-sheet', materialId: sheetId, stageId: 'st-print', processId: 'pr-print', qtyPerPiece: 0, piecesPerProduct: 1, cutLengthMm: cut[0], cutWidthMm: cut[1], rotationAllowed: true, upsOverride: null, upsOverrideReason: '', note: '' },
        ...(laminate
          ? [{ id: 'bom-film', materialId: film.id, stageId: 'st-print', processId: 'pr-lam', qtyPerPiece: 0.0015, piecesPerProduct: 1, cutLengthMm: null, cutWidthMm: null, rotationAllowed: false, upsOverride: null, upsOverrideReason: '', note: '' }]
          : []),
        { id: 'bom-glue', materialId: glue.id, stageId: 'st-pack', processId: 'pr-paste', qtyPerPiece: 0.003, piecesPerProduct: 1, cutLengthMm: null, cutWidthMm: null, rotationAllowed: false, upsOverride: null, upsOverrideReason: '', note: '' },
      ],
    }
    return { product: run(saveProduct(draft)), laminate }
  }
  const sweetBox = product('Sweet box 1 kg', 'Carton', '4819', duplex.id, [420, 300], false)
  const medicine = product('Medicine mono carton', 'Carton', '4819', artBoard.id, [180, 120], false)
  const jewellery = product('Jewellery gift box', 'Rigid box', '4819', artBoard.id, [260, 200], true)

  // Customers (fictional)
  const customer = (company: string, contactPerson: string, city: string) =>
    run(
      saveCustomer({
        code: '',
        company,
        contactPerson,
        phone: '+91 90000 00000',
        email: 'purchase@example.com',
        billingAddress: `Demo street, ${city}`,
        deliveryAddress: `Demo godown, ${city}`,
        gstin: '',
        placeOfSupply: '33',
        paymentTerms: '30 days',
        notes: 'Demo customer',
      }),
    )
  const sweets = customer('Sri Demo Sweets', 'Purchase desk', 'Madurai')
  const pharma = customer('Demo Pharma Pvt Ltd', 'Stores', 'Chennai')
  const jewels = customer('Demo Jewellers', 'Showroom manager', 'Coimbatore')

  // One operator and one machine per unit
  const people: Record<string, string> = {}
  const machines: Record<string, string> = {}
  for (const unit of db.units) {
    people[unit.id] = run(savePerson({ unitId: unit.id, name: `${unit.shortName} operator`, designation: 'Operator' })).id
    machines[unit.id] = run(saveMachine({ unitId: unit.id, code: '', name: `${unit.shortName} machine` })).id
  }

  const allUnits = (p: { product: { stages: ProductStage[] } }) => {
    const units = ['U1', 'U1', 'U2', 'U3', 'U4', 'U4']
    return Object.fromEntries(p.product.stages.flatMap((s) => s.processes).map((pr, i) => [pr.id, units[Math.min(i, units.length - 1)]]))
  }
  const order = (p: ReturnType<typeof product>, customerId: string, quantity: number, daysAgo: number, deliverIn: number, ref: string) => {
    const plan = run(
      savePlan({
        customerId,
        productId: p.product.id,
        quantity,
        orderDate: iso(daysAgo),
        deliveryDate: iso(daysAgo - deliverIn),
        priority: 'Normal',
        customerRef: ref,
        dimensions: '',
        options: '',
        instructions: '',
        processUnits: allUnits(p),
      }),
      ctx(daysAgo),
    )
    return plan
  }
  const toProduction = (planId: string, daysAgo: number) => {
    run(submitPlan(planId), ctx(daysAgo, 11))
    const costing = run(openCosting(planId), ctx(daysAgo, 12))
    return run(finalizeCosting(costing.id), ctx(daysAgo, 13)).order
  }

  // 1. Sweet boxes: made, dispatched in two lots, both billed; the first bill is paid.
  const p1 = order(sweetBox, sweets.id, 5000, 18, 10, 'PO-SW-101')
  const o1 = toProduction(p1.id, 18)
  run(finishOrderProduction(o1.id), ctx(12, 17))
  const d1 = run(confirmDispatch({ requestId: 'demo-d1', orderId: o1.id, date: iso(11), quantity: 3000, deliveryAddress: 'Demo godown, Madurai', transporter: 'Demo Transport', vehicleNo: 'TN 00 AA 0000', notes: '' }), ctx(11, 15))
  run(confirmDispatch({ requestId: 'demo-d2', orderId: o1.id, date: iso(8), quantity: 2000, deliveryAddress: 'Demo godown, Madurai', transporter: 'Demo Transport', vehicleNo: 'TN 00 AA 0000', notes: '' }), ctx(8, 15))

  // 2. Medicine cartons: made and fully dispatched, bill waiting for payment.
  const p2 = order(medicine, pharma.id, 20000, 14, 12, 'PO-PH-2207')
  const o2 = toProduction(p2.id, 14)
  run(finishOrderProduction(o2.id), ctx(6, 17))
  const d3 = run(confirmDispatch({ requestId: 'demo-d3', orderId: o2.id, date: iso(5), quantity: 20000, deliveryAddress: 'Demo godown, Chennai', transporter: 'Demo Logistics', vehicleNo: 'TN 00 BB 0000', notes: '' }), ctx(5, 16))

  // 3. Jewellery boxes: in production — printing done, die cutting running.
  const p3 = order(jewellery, jewels.id, 3000, 6, 14, 'PO-JW-55')
  const o3 = toProduction(p3.id, 6)
  const steps = o3.stages.flatMap((s) => s.processes)
  let day = 4
  for (const step of steps.slice(0, 4)) {
    run(assignProcessResources(o3.id, step.id, { responsiblePersonId: people[step.unitId], machineId: machines[step.unitId], noMachineRequired: false }), ctx(day, 9))
    run(startProcess(o3.id, step.id), ctx(day, 10))
    if (step !== steps[3]) run(completeProcess(o3.id, step.id), ctx(day, 16))
    day = Math.max(1, day - 1)
  }

  // 4. A new sweet box order, planned and waiting for costing.
  const p4 = order(sweetBox, sweets.id, 8000, 1, 15, 'PO-SW-118')
  run(submitPlan(p4.id), ctx(1, 11))

  // Money in and out
  const money = (daysAgo: number, d: Partial<MoneyDraft> & Pick<MoneyDraft, 'direction' | 'amount' | 'category'>) =>
    run(saveMoneyEntry({ id: '', date: iso(daysAgo), mode: 'bank', party: '', invoiceId: null, purchaseId: null, reference: '', notes: '', ...d }), ctx(daysAgo, 18))
  money(20, { direction: 'in', amount: 250000, category: 'Opening balance', notes: 'Bank balance at the start (demo)' })
  money(20, { direction: 'in', amount: 15000, category: 'Opening balance', mode: 'cash', notes: 'Cash in hand (demo)' })
  money(15, { direction: 'out', amount: 18500, category: 'Electricity', reference: 'EB bill' })
  money(10, { direction: 'out', amount: 42000, category: 'Salary & wages', mode: 'cash', notes: 'Weekly wages' })
  money(9, { direction: 'out', amount: 6500, category: 'Transport', mode: 'upi', party: 'Demo Transport' })
  money(7, { direction: 'in', amount: d1.invoice.total, category: 'Customer payment', party: sweets.company, invoiceId: d1.invoice.id, mode: 'bank', reference: 'NEFT demo' })
  money(3, { direction: 'out', amount: 42000, category: 'Salary & wages', mode: 'cash', notes: 'Weekly wages' })
  money(2, { direction: 'out', amount: 3200, category: 'Machine repair', mode: 'cash', party: 'Demo Engineering' })
  money(1, { direction: 'in', amount: 20000, category: 'Advance from customer', party: jewels.company, mode: 'upi', notes: 'Advance for PO-JW-55' })
  void d3

  return db
}
