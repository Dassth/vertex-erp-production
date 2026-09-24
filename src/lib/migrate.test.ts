import { describe, expect, it } from 'vitest'
import type { VertexDB } from './types'
import { MIGRATION_ADMIN_ONLY_ACCOUNTS, MIGRATION_PROCESS_ALLOCATION, migrateToProcessAllocation } from './migrate'
import { normalizeDB } from './db'
import { buildEmptyDB } from './defaults'
import { ctxFor, must } from '../test/fixtures'
import { saveMachine, savePerson } from '../domain/resources'
import { assignProcessResources, completeProcess, startProcess } from '../domain/production'

/* Existing databases hold stage-level allocation. Migration must carry them to
   process-level allocation without resetting anything, without inventing
   history, and without rewriting confirmed documents. */

/** A database shaped the way the previous build wrote it. */
function legacyDB(): VertexDB {
  const base = buildEmptyDB(new Date('2026-09-01T09:00:00'))
  const product = {
    id: 'PRD-1',
    code: 'PRD-0001',
    name: 'Folding carton',
    category: '',
    description: '',
    hsn: '4819',
    uom: 'pcs',
    taxPct: null,
    active: true,
    version: 1,
    createdAt: '2026-09-01T09:00:00.000Z',
    createdBy: 'Administrator 1',
    updatedAt: '2026-09-01T09:00:00.000Z',
    updatedBy: 'Administrator 1',
    materials: [],
    stages: [
      {
        id: 'st-print',
        name: 'Printing',
        description: '',
        // No requiresMachine flag existed.
        processes: [
          { id: 'pr-plate', name: 'Plate making', description: '', setupHours: 1, runHoursPer1000: 0, chargeId: null, costBasis: 'per_1000', rate: 0, setupCharge: 0 },
          { id: 'pr-print', name: 'Offset print', description: '', setupHours: 1, runHoursPer1000: 2, chargeId: null, costBasis: 'per_1000', rate: 500, setupCharge: 250 },
        ],
      },
      {
        id: 'st-cut',
        name: 'Die cutting',
        description: '',
        processes: [{ id: 'pr-die', name: 'Die cut', description: '', setupHours: 0.5, runHoursPer1000: 2, chargeId: null, costBasis: 'per_hour', rate: 300, setupCharge: 0 }],
      },
    ],
  }

  const order = {
    id: 'ORD-1',
    code: 'JOB-0001',
    planId: 'PLN-1',
    costingId: 'CST-1',
    customerId: 'CUS-1',
    productId: 'PRD-1',
    customer: { id: 'CUS-1', code: 'CUS-0001', company: 'Example Traders', contactPerson: '', phone: '', email: '', billingAddress: 'Street', deliveryAddress: 'Street', gstin: '', placeOfSupply: '33', paymentTerms: '30 days' },
    productCode: 'PRD-0001',
    productName: 'Folding carton',
    hsn: '4819',
    uom: 'pcs',
    quantity: 1000,
    orderDate: '2026-09-01',
    deliveryDate: '2026-09-30',
    priority: 'Normal' as const,
    customerRef: '',
    dimensions: '',
    options: '',
    instructions: '',
    status: 'Active' as const,
    completedAt: null,
    completedQty: 0,
    createdAt: '2026-09-01T09:00:00.000Z',
    createdBy: 'Administrator 1',
    stages: [
      {
        id: 'stg-1',
        stageDefId: 'st-print',
        index: 0,
        name: 'Printing',
        description: '',
        unitId: 'U1',
        status: 'Completed' as const,
        plannedStart: '2026-09-02T04:00:00.000Z',
        plannedEnd: '2026-09-02T09:00:00.000Z',
        durationHours: 5,
        actualStart: '2026-09-02T04:10:00.000Z',
        actualEnd: '2026-09-02T08:30:00.000Z',
        updatedBy: 'Unit 1 Supervisor',
        processes: [
          { id: 'jpr-1', processDefId: 'pr-plate', name: 'Plate making', durationHours: 1, done: true, doneAt: '2026-09-02T06:00:00.000Z', doneBy: 'Unit 1 Supervisor' },
          // Closed with the stage; no individual completion was ever recorded.
          { id: 'jpr-2', processDefId: 'pr-print', name: 'Offset print', durationHours: 4, done: true, doneAt: null, doneBy: null },
        ],
      },
      {
        id: 'stg-2',
        stageDefId: 'st-cut',
        index: 1,
        name: 'Die cutting',
        description: '',
        unitId: 'U2',
        status: 'Scheduled' as const,
        plannedStart: '2026-09-03T04:00:00.000Z',
        plannedEnd: '2026-09-03T08:00:00.000Z',
        durationHours: 4,
        processes: [{ id: 'jpr-3', processDefId: 'pr-die', name: 'Die cut', durationHours: 4, done: false, doneAt: null, doneBy: null }],
      },
    ],
  }

  const plan = {
    id: 'PLN-1',
    code: 'PLN-0001',
    customerId: 'CUS-1',
    productId: 'PRD-1',
    productVersion: 1,
    quantity: 1000,
    orderDate: '2026-09-01',
    deliveryDate: '2026-09-30',
    priority: 'Normal' as const,
    customerRef: '',
    dimensions: '',
    options: '',
    instructions: '',
    stageUnits: { 'st-print': 'U1', 'st-cut': 'U2' },
    status: 'In Production' as const,
    submittedAt: '2026-09-01T10:00:00.000Z',
    submittedBy: 'Administrator 1',
    costingId: 'CST-1',
    orderId: 'ORD-1',
    createdAt: '2026-09-01T09:30:00.000Z',
    createdBy: 'Administrator 1',
    updatedAt: '2026-09-01T10:00:00.000Z',
    updatedBy: 'Administrator 1',
  }

  const invoice = { id: 'INV-1', number: 'INV/2026-27/0001', total: 21452.4, orderId: 'ORD-1' }
  const auditEntry = { id: 'aud-1', at: '2026-09-02T06:00:00.000Z', userId: 'USR-U1', user: 'Unit 1 Supervisor', role: 'unit' as const, action: 'Stage completed', entity: 'Stage' as const, entityId: 'stg-1', entityLabel: 'JOB-0001 — Printing' }

  return {
    ...base,
    // Accounts written before tiers existed — including Administrator 3 and the unit logins of that build.
    users: [
      ...base.users,
      { ...base.users[0], id: 'USR-ADM3', name: 'Administrator 3', email: 'admin3@vertex.local', initials: 'A3' },
      ...[1, 2, 3, 4].map((n) => ({ ...base.users[0], id: `USR-U${n}`, name: `Unit ${n} Supervisor`, email: `unit${n}@vertex.local`, role: 'unit' as const, unitId: `U${n}`, initials: `U${n}` })),
    ].map((u) => ({ ...u, adminTier: null })),
    products: [product],
    plans: [plan],
    orders: [order],
    invoices: [invoice],
    audit: [auditEntry],
    migrations: ['purge-legacy-demo-v1'],
  } as unknown as VertexDB
}

describe('migration to process-level allocation', () => {
  it('gives every process its parent stage’s unit, in plans and in orders', () => {
    const db = migrateToProcessAllocation(legacyDB())
    expect(db.plans[0].processUnits).toEqual({ 'pr-plate': 'U1', 'pr-print': 'U1', 'pr-die': 'U2' })
    // The legacy stage map is kept for reference, not deleted.
    expect(db.plans[0].stageUnits).toEqual({ 'st-print': 'U1', 'st-cut': 'U2' })

    const processes = db.orders[0].stages.flatMap((s) => s.processes)
    expect(processes.map((p) => [p.name, p.unitId])).toEqual([
      ['Plate making', 'U1'],
      ['Offset print', 'U1'],
      ['Die cut', 'U2'],
    ])
    // Each process knows which stage it belongs to.
    expect(processes.map((p) => p.stageDefId)).toEqual(['st-print', 'st-print', 'st-cut'])
    expect(processes.map((p) => p.stageId)).toEqual(['stg-1', 'stg-1', 'stg-2'])
    expect(processes.map((p) => p.stageName)).toEqual(['Printing', 'Printing', 'Die cutting'])
  })

  it('marks migrated work as historical and never invents operators, machines or timings', () => {
    const db = migrateToProcessAllocation(legacyDB())
    const processes = db.orders[0].stages.flatMap((s) => s.processes)
    for (const p of processes) {
      expect(p.historical).toBe(true)
      expect(p.responsiblePersonId).toBeNull()
      expect(p.machineId).toBeNull()
      expect(p.noMachineRequired).toBe(false)
    }
    // The one real completion timestamp is kept; the missing one is not fabricated.
    expect(processes[0].actualEnd).toBe('2026-09-02T06:00:00.000Z')
    expect(processes[0].doneBy).toBe('Unit 1 Supervisor')
    expect(processes[1].actualEnd).toBeUndefined()
    expect(processes[1].doneBy).toBeNull()
    // Planned windows are inherited from the stage they genuinely came from.
    expect(processes[2].plannedStart).toBe('2026-09-03T04:00:00.000Z')
    expect(processes[2].plannedEnd).toBe('2026-09-03T08:00:00.000Z')
    expect(processes[2].status).toBe('Scheduled')
    expect(processes[0].status).toBe('Completed')
  })

  it('retires Administrator 3 and every unit login on load, keeping their history', () => {
    const legacy = legacyDB()
    expect(legacy.users.map((u) => u.id)).toEqual(['USR-ADM1', 'USR-ADM2', 'USR-ADM3', 'USR-U1', 'USR-U2', 'USR-U3', 'USR-U4'])
    const db = normalizeDB(legacy)
    expect(db.users.map((u) => [u.id, u.adminTier])).toEqual([
      ['USR-ADM1', 'full'],
      ['USR-ADM2', 'operations'],
    ])
    expect(db.migrations.filter((m) => m === MIGRATION_ADMIN_ONLY_ACCOUNTS)).toHaveLength(1)
    // The unit's past work still names who did it.
    expect(db.audit.some((a) => a.userId === 'USR-U1' && a.user === 'Unit 1 Supervisor')).toBe(true)
    expect(db.orders[0].stages[0].processes[0].doneBy).toBe('Unit 1 Supervisor')
    // Idempotent: a second load changes nothing.
    expect(JSON.stringify(normalizeDB(JSON.parse(JSON.stringify(db))))).toBe(JSON.stringify(db))
  })

  it('assigns administrator tiers and defaults product processes to manual', () => {
    const db = migrateToProcessAllocation(legacyDB())
    expect(db.users.find((u) => u.id === 'USR-ADM1')!.adminTier).toBe('full')
    expect(db.users.find((u) => u.id === 'USR-ADM2')!.adminTier).toBe('operations')
    expect(db.users.find((u) => u.id === 'USR-ADM3')!.adminTier).toBe('billing')
    expect(db.users.find((u) => u.id === 'USR-U1')!.adminTier).toBeNull()
    for (const process of db.products[0].stages.flatMap((s) => s.processes)) expect(process.requiresMachine).toBe(false)
  })

  it('preserves issued documents, plans, audit entries and the existing migration record', () => {
    const before = legacyDB()
    const db = migrateToProcessAllocation(before)
    expect(db.invoices).toEqual(before.invoices)
    expect(db.audit).toEqual(before.audit)
    expect(db.orders[0].code).toBe('JOB-0001')
    expect(db.orders[0].quantity).toBe(1000)
    expect(db.plans[0].status).toBe('In Production')
    expect(db.migrations).toContain('purge-legacy-demo-v1')
    expect(db.migrations).toContain(MIGRATION_PROCESS_ALLOCATION)
  })

  it('is idempotent — a second pass changes nothing and does not re-mark records', () => {
    const once = migrateToProcessAllocation(legacyDB())
    const twice = migrateToProcessAllocation(once)
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once))
    expect(twice.migrations.filter((m) => m === MIGRATION_PROCESS_ALLOCATION)).toHaveLength(1)
  })

  it('runs automatically when a stored database is normalised on load', () => {
    const db = normalizeDB(legacyDB())
    expect(db.migrations).toContain(MIGRATION_PROCESS_ALLOCATION)
    expect(db.orders[0].stages[1].processes[0].unitId).toBe('U2')
    expect(db.people).toEqual([])
    expect(db.machines).toEqual([])
  })
})

describe('migrated records accept new execution detail', () => {
  const admin = () => ctxFor({ id: 'USR-ADM1', name: 'Administrator 1', role: 'admin' as const, unitId: null, adminTier: 'full' as const })
  /** Units have no accounts: Administrator 2 records Unit 2's work. */
  const unit2 = () => ctxFor({ id: 'USR-ADM2', name: 'Administrator 2', role: 'admin' as const, unitId: null, adminTier: 'operations' as const })

  /** Migrated database plus one person and one machine for Unit 2. */
  function migratedWithResources() {
    let db = migrateToProcessAllocation(legacyDB())
    const person = must(savePerson({ unitId: 'U2', name: 'K. Raja', designation: 'Operator' })(db, admin()))
    db = person.db
    const machine = must(saveMachine({ unitId: 'U2', code: '', name: 'Die cutter' })(db, admin()))
    db = machine.db
    return { db, personId: person.value.id, machineId: machine.value.id }
  }

  it('lets an administrator record person, machine and real timings on an UNFINISHED migrated process', () => {
    const base = migratedWithResources()
    const open = base.db.orders[0].stages[1].processes[0]
    expect(open.historical).toBe(true)
    expect(open.status).toBe('Scheduled')

    let db = must(
      assignProcessResources('ORD-1', open.id, { responsiblePersonId: base.personId, machineId: base.machineId, noMachineRequired: false })(base.db, unit2()),
    ).db
    db = must(startProcess('ORD-1', open.id)(db, unit2())).db
    const finished = must(completeProcess('ORD-1', open.id)(db, unit2()))
    const after = finished.db.orders[0].stages[1].processes[0]

    // New detail is recorded in full…
    expect(after.responsiblePersonId).toBe(base.personId)
    expect(after.machineId).toBe(base.machineId)
    expect(after.status).toBe('Completed')
    expect(after.actualStart).toBeTruthy()
    expect(after.actualEnd).toBeTruthy()
    expect(after.doneBy).toBe('Administrator 2')
    // …while the record keeps its provenance, which is not a lock.
    expect(after.historical).toBe(true)
    expect(finished.db.orders[0].stages[1].status).toBe('Completed')
  })

  it('keeps "never recorded" distinct from "recorded after migration"', () => {
    const base = migratedWithResources()
    const printing = base.db.orders[0].stages[0].processes
    // Old work: one process had a real completion stamp, the other never did.
    expect(printing[0].doneBy).toBe('Unit 1 Supervisor')
    expect(printing[0].actualEnd).toBe('2026-09-02T06:00:00.000Z')
    expect(printing[1].actualEnd).toBeUndefined()
    expect(printing[1].doneBy).toBeNull()
    expect(printing.every((p) => p.responsiblePersonId === null && p.machineId === null)).toBe(true)

    // New work on the open process does not touch any of that.
    const open = base.db.orders[0].stages[1].processes[0]
    const db = must(
      assignProcessResources('ORD-1', open.id, { responsiblePersonId: base.personId, machineId: base.machineId, noMachineRequired: false })(base.db, unit2()),
    ).db
    expect(JSON.stringify(db.orders[0].stages[0])).toBe(JSON.stringify(base.db.orders[0].stages[0]))
  })

  it('a reload neither repeats the migration nor overwrites progress recorded since', () => {
    const base = migratedWithResources()
    const open = base.db.orders[0].stages[1].processes[0]
    let db = must(
      assignProcessResources('ORD-1', open.id, { responsiblePersonId: base.personId, machineId: base.machineId, noMachineRequired: false })(base.db, unit2()),
    ).db
    db = must(startProcess('ORD-1', open.id)(db, unit2())).db
    const started = db.orders[0].stages[1].processes[0]

    // normalizeDB is what a page load runs.
    const reloaded = normalizeDB(JSON.parse(JSON.stringify(db)))
    const after = reloaded.orders[0].stages[1].processes[0]
    expect(after.responsiblePersonId).toBe(base.personId)
    expect(after.machineId).toBe(base.machineId)
    expect(after.status).toBe('In Progress')
    expect(after.actualStart).toBe(started.actualStart)
    expect(reloaded.migrations.filter((m) => m === MIGRATION_PROCESS_ALLOCATION)).toHaveLength(1)
    // Confirmed history is still byte-identical.
    expect(JSON.stringify(reloaded.invoices)).toBe(JSON.stringify(db.invoices))
    expect(JSON.stringify(reloaded.orders[0].stages[0])).toBe(JSON.stringify(db.orders[0].stages[0]))
  })
})
