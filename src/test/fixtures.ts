import type { Ctx, OpResult } from '../domain/common'
import type { ProductDraft } from '../domain/master'
import { blankMaterialDraft, saveCustomer, saveMaterial, saveProduct } from '../domain/master'
import { saveMachine, savePerson } from '../domain/resources'
import type { ProductProcess, ProductStage, VertexDB } from '../lib/types'
import { buildEmptyDB } from '../lib/defaults'

export const NOW = new Date('2026-09-15T10:00:00')

/** The three administrators carry different access tiers (see lib/permissions). */
const TIERS = ['full', 'operations', 'billing'] as const
export const ADMIN = [1, 2, 3].map((n) => ({
  id: `USR-ADM${n}`,
  name: `Administrator ${n}`,
  role: 'admin' as const,
  unitId: null,
  adminTier: TIERS[n - 1],
}))
export const UNIT = (n: number) => ({ id: `USR-U${n}`, name: `Unit ${n} Supervisor`, role: 'unit' as const, unitId: `U${n}` })

let seq = 0
export function ctxFor(actor: Ctx['actor'] = ADMIN[0], now: Date = NOW): Ctx {
  return { actor, now, newId: (p) => `${p}-${++seq}` }
}

export function must<T>(r: OpResult<T>): { db: VertexDB; value: T } {
  if (!r.ok) throw new Error(`Operation failed: ${r.error} ${JSON.stringify(r.fieldErrors ?? r.issues ?? '')}`)
  return { db: r.db, value: r.value }
}

function process(id: string, name: string, over: Partial<ProductProcess> = {}): ProductProcess {
  return { id, name, description: '', setupHours: 1, runHoursPer1000: 2, chargeId: null, costBasis: 'per_1000', rate: 500, setupCharge: 250, requiresMachine: false, ...over }
}

/** A product with 3 stages / 5 processes, one sheet material and one quantity material. */
export function seedMaster(start: VertexDB = buildEmptyDB(NOW), opts: { sheetPrice?: number | null } = {}) {
  const ctx = ctxFor()
  let db = start
  const sheet = must(
    saveMaterial({
      ...blankMaterialDraft('sheet'),
      name: 'Art board 300 GSM',
      price: opts.sheetPrice === undefined ? 12 : opts.sheetPrice,
      sheetLengthMm: 1000,
      sheetWidthMm: 700,
      edgeMarginMm: 5,
      cutGapMm: 3,
      wastagePct: 5,
    })(db, ctx),
  )
  db = sheet.db
  const glue = must(
    saveMaterial({ ...blankMaterialDraft('quantity'), name: 'PVA adhesive', uom: 'kg', price: 200, wastagePct: 10, purchaseMultiple: 0.5 })(db, ctx),
  )
  db = glue.db

  const stages: ProductStage[] = [
    { id: 'st-print', name: 'Printing', description: '', processes: [process('pr-plate', 'Plate making', { costBasis: 'fixed', rate: 0, setupCharge: 0, runHoursPer1000: 0 }), process('pr-print', 'Offset print')] },
    { id: 'st-cut', name: 'Die cutting', description: '', processes: [process('pr-die', 'Die cut', { costBasis: 'per_hour', rate: 300, setupCharge: 0, setupHours: 0.5, runHoursPer1000: 2 })] },
    { id: 'st-pack', name: 'Pasting & packing', description: '', processes: [process('pr-paste', 'Pasting', { rate: 0, setupCharge: 0 }), process('pr-pack', 'Packing', { rate: 0, setupCharge: 0 })] },
  ]
  const draft: ProductDraft = {
    code: '',
    name: 'Folding carton',
    category: 'Carton',
    description: '',
    hsn: '4819',
    uom: 'pcs',
    taxPct: null,
    stages,
    materials: [
      { id: 'bom-sheet', materialId: sheet.value.id, stageId: 'st-print', processId: 'pr-print', qtyPerPiece: 0, piecesPerProduct: 2, cutLengthMm: 200, cutWidthMm: 150, rotationAllowed: true, upsOverride: null, upsOverrideReason: '', note: '' },
      { id: 'bom-glue', materialId: glue.value.id, stageId: 'st-pack', processId: 'pr-paste', qtyPerPiece: 0.004, piecesPerProduct: 1, cutLengthMm: null, cutWidthMm: null, rotationAllowed: false, upsOverride: null, upsOverrideReason: '', note: '' },
    ],
  }
  const product = must(saveProduct(draft)(db, ctx))
  db = product.db
  const customer = must(
    saveCustomer({
      code: '',
      company: 'Example Traders',
      contactPerson: 'Purchase desk',
      phone: '+91 00000 00000',
      email: 'accounts@example.com',
      billingAddress: 'Billing street, City',
      deliveryAddress: 'Warehouse road, City',
      gstin: '33ABCDE1234F1Z5',
      placeOfSupply: '33',
      paymentTerms: '30 days',
      notes: '',
    })(db, ctx),
  )
  db = customer.db
  return { db, sheetId: sheet.value.id, glueId: glue.value.id, productId: product.value.id, customerId: customer.value.id }
}

/** Every process of the seeded product, allocated to one unit each. */
export const PROCESS_UNITS = {
  'pr-plate': 'U1',
  'pr-print': 'U1',
  'pr-die': 'U2',
  'pr-paste': 'U1',
  'pr-pack': 'U1',
}

/**
 * One responsible person and one machine per unit. Units allocate these to
 * their processes before starting work.
 */
export function seedResources(db: VertexDB): { db: VertexDB; personOf: (unitId: string) => string; machineOf: (unitId: string) => string } {
  let next = db
  const people: Record<string, string> = {}
  const machines: Record<string, string> = {}
  for (const unit of next.units) {
    const person = must(savePerson({ unitId: unit.id, name: `${unit.shortName} operator`, designation: 'Operator' })(next, ctxFor()))
    next = person.db
    people[unit.id] = person.value.id
    const machine = must(saveMachine({ unitId: unit.id, code: '', name: `${unit.shortName} machine` })(next, ctxFor()))
    next = machine.db
    machines[unit.id] = machine.value.id
  }
  return { db: next, personOf: (unitId) => people[unitId], machineOf: (unitId) => machines[unitId] }
}
