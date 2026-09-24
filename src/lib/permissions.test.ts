import { describe, expect, it } from 'vitest'
import type { User } from './types'
import { canOpenPath, capabilitiesOf, landingPath, seedTierFor } from './permissions'
import { buildEmptyDB, DEFAULT_USERS } from './defaults'
import { BILLING_ONLY, RETIRED_UNIT, ctxFor, must, seedMaster, seedResources, PROCESS_UNITS } from '../test/fixtures'
import { savePlan, submitPlan } from '../domain/planning'
import { finalizeCosting, openCosting } from '../domain/orderCosting'
import { saveProduct } from '../domain/master'
import { confirmDispatch } from '../domain/dispatch'
import { saveCompanyProfile } from '../domain/system'
import { savePerson } from '../domain/resources'
import { assignProcessResources, completeProcess, setOrderPriority, startProcess } from '../domain/production'

/* The permission matrix, checked in both layers: what the interface offers
   (capabilities, routes, landings) and what the domain actually commits.
   Two administrators; production units have no accounts. */

const account = (id: string): User => DEFAULT_USERS.find((u) => u.id === id)!
const ADMIN1 = account('USR-ADM1')
const ADMIN2 = account('USR-ADM2')

describe('permission matrix', () => {
  it('seeds exactly two administrators, each with its own tier, and no unit accounts', () => {
    expect(DEFAULT_USERS.map((u) => u.id)).toEqual(['USR-ADM1', 'USR-ADM2'])
    expect(ADMIN1.adminTier).toBe('full')
    expect(ADMIN2.adminTier).toBe('operations')
    expect(seedTierFor('USR-ADM2', 'admin')).toBe('operations')
    expect(seedTierFor('USR-U1', 'unit')).toBeNull()
  })

  it('gives Administrator 1 the whole workflow, including shop-floor work', () => {
    const caps = capabilitiesOf(ADMIN1)
    expect(caps).toEqual(
      expect.arrayContaining(['master', 'planning', 'costing', 'production.monitor', 'production.work', 'dispatch', 'billing', 'administration']),
    )
  })

  it('limits Administrator 2 to running production, dispatch and billing', () => {
    expect(capabilitiesOf(ADMIN2).sort()).toEqual(['billing', 'dispatch', 'production.monitor', 'production.work', 'units.monitor'])
    expect(capabilitiesOf(ADMIN2)).not.toContain('master')
    expect(capabilitiesOf(ADMIN2)).not.toContain('planning')
    expect(capabilitiesOf(ADMIN2)).not.toContain('costing')
    // No route into internal cost or profit figures either.
    expect(capabilitiesOf(ADMIN2)).not.toContain('costing.internals')
    expect(capabilitiesOf(ADMIN2)).not.toContain('administration')
  })

  it('gives a leftover unit account from an older database nothing at all', () => {
    expect(capabilitiesOf(RETIRED_UNIT)).toEqual([])
    for (const path of ['/units', '/production', '/billing', '/settings']) expect(canOpenPath(RETIRED_UNIT, path)).toBe(false)
  })

  it('opens the Units screens to both administrators', () => {
    for (const admin of [ADMIN1, ADMIN2]) {
      expect(canOpenPath(admin, '/units')).toBe(true)
      expect(canOpenPath(admin, '/units/U1')).toBe(true)
    }
  })

  it('lands every account on a page it may open', () => {
    expect(landingPath(ADMIN1)).toBe('/home')
    expect(landingPath(ADMIN2)).toBe('/home')
    expect(landingPath(null)).toBe('/login')
    // Recovery can never loop: the landing page is always allowed.
    for (const user of [ADMIN1, ADMIN2, RETIRED_UNIT]) expect(canOpenPath(user, landingPath(user))).toBe(true)
  })

  it('refuses restricted routes, including deep links and sub-paths', () => {
    const blockedForAdmin2 = ['/master', '/master/products', '/master/products/PRD-1', '/planning', '/planning/PLN-1', '/costing', '/costing/PLN-1', '/settings']
    for (const path of blockedForAdmin2) expect(canOpenPath(ADMIN2, path)).toBe(false)
    for (const path of ['/production', '/dispatch', '/billing', '/invoices']) expect(canOpenPath(ADMIN2, path)).toBe(true)

    // The retired billing-only tier still reaches billing and nothing else.
    for (const path of [...blockedForAdmin2, '/production', '/dispatch']) expect(canOpenPath(BILLING_ONLY, path)).toBe(false)
    expect(canOpenPath(BILLING_ONLY, '/billing')).toBe(true)

    // Personal account actions stay available to every administrator.
    for (const user of [ADMIN1, ADMIN2]) expect(canOpenPath(user, '/account')).toBe(true)
  })
})

describe('domain refuses what the navigation hides', () => {
  const actor = (u: Pick<User, 'id' | 'name' | 'role' | 'unitId' | 'adminTier'>) =>
    ctxFor({ id: u.id, name: u.name, role: u.role, unitId: u.unitId, adminTier: u.adminTier })

  /** A finalized order with resources, reached entirely as Administrator 1. */
  function ready() {
    const seeded = seedMaster()
    const resources = seedResources(seeded.db)
    let db = resources.db
    const plan = must(
      savePlan({
        customerId: seeded.customerId,
        productId: seeded.productId,
        quantity: 1000,
        orderDate: '2026-09-15',
        deliveryDate: '2026-10-10',
        priority: 'Normal',
        customerRef: '',
        dimensions: '',
        options: '',
        instructions: '',
        processUnits: PROCESS_UNITS,
      })(db, actor(ADMIN1)),
    )
    db = must(submitPlan(plan.value.id)(plan.db, actor(ADMIN1))).db
    const costing = must(openCosting(plan.value.id)(db, actor(ADMIN1)))
    const finalized = must(finalizeCosting(costing.value.id)(costing.db, actor(ADMIN1)))
    return { ...seeded, ...resources, db: finalized.db, order: finalized.value.order, planId: plan.value.id }
  }

  it('blocks Administrator 2 from master, planning, costing and staff mutations', () => {
    const { db, planId, order } = ready()
    const product = db.products[0]
    const draft = {
      id: product.id,
      code: product.code,
      name: 'Renamed by Admin 2',
      category: product.category,
      description: '',
      hsn: product.hsn,
      uom: product.uom,
      taxPct: product.taxPct,
      stages: product.stages,
      materials: product.materials,
      expectedUpdatedAt: product.updatedAt,
    }
    expect(saveProduct(draft)(db, actor(ADMIN2)).ok).toBe(false)
    expect(openCosting(planId)(db, actor(ADMIN2)).ok).toBe(false)
    expect(saveCompanyProfile({ name: 'X', address: '', phone: '', email: '', gstin: '', invoicePrefix: 'INV', bankDetails: '', invoiceTerms: '' })(db, actor(ADMIN2)).ok).toBe(false)
    expect(savePerson({ unitId: 'U1', name: 'Someone', designation: '' })(db, actor(ADMIN2)).ok).toBe(false)
    // Plan-level adjustments stay with Administrator 1.
    expect(setOrderPriority(order.id, 'Urgent')(db, actor(ADMIN2)).ok).toBe(false)
  })

  it('lets both administrators allocate and record any unit’s process', () => {
    const { db, order, personOf, machineOf } = ready()
    const first = order.stages[0].processes[0]
    const assign = assignProcessResources(order.id, first.id, {
      responsiblePersonId: personOf(first.unitId),
      machineId: machineOf(first.unitId),
      noMachineRequired: false,
    })
    for (const admin of [ADMIN1, ADMIN2]) {
      const allocated = must(assign(db, actor(admin)))
      expect(allocated.value.responsiblePersonId).toBe(personOf(first.unitId))
      const started = must(startProcess(order.id, first.id)(allocated.db, actor(admin)))
      expect(must(completeProcess(order.id, first.id)(started.db, actor(admin))).value.process.status).toBe('Completed')
    }
  })

  it('refuses shop-floor work from a leftover unit account and the retired billing tier', () => {
    const { db, order, personOf, machineOf } = ready()
    const first = order.stages[0].processes[0]
    const assign = assignProcessResources(order.id, first.id, {
      responsiblePersonId: personOf(first.unitId),
      machineId: machineOf(first.unitId),
      noMachineRequired: false,
    })
    expect(assign(db, actor(RETIRED_UNIT)).ok).toBe(false)
    expect(assign(db, actor(BILLING_ONLY)).ok).toBe(false)
    expect(setOrderPriority(order.id, 'High')(db, actor(BILLING_ONLY)).ok).toBe(false)
    const dispatch = confirmDispatch({
      requestId: 'r1',
      orderId: order.id,
      date: '2026-09-15',
      quantity: 10,
      deliveryAddress: 'X',
      transporter: '',
      vehicleNo: '',
      notes: '',
    })(db, actor(BILLING_ONLY))
    expect(dispatch.ok).toBe(false)
  })
})

describe('a fresh database', () => {
  it('starts with two tiered administrators and empty resource registers', () => {
    const db = buildEmptyDB(new Date('2026-09-16T10:00:00'))
    expect(db.users.map((u) => [u.id, u.adminTier])).toEqual([
      ['USR-ADM1', 'full'],
      ['USR-ADM2', 'operations'],
    ])
    expect(db.people).toEqual([])
    expect(db.machines).toEqual([])
  })
})
