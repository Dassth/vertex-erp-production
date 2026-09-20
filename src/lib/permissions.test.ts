import { describe, expect, it } from 'vitest'
import type { User } from './types'
import { canOpenPath, capabilitiesOf, landingPath, seedTierFor } from './permissions'
import { buildEmptyDB, DEFAULT_USERS } from './defaults'
import { ctxFor, must, seedMaster, seedResources, PROCESS_UNITS } from '../test/fixtures'
import { savePlan, submitPlan } from '../domain/planning'
import { finalizeCosting, openCosting } from '../domain/orderCosting'
import { saveProduct } from '../domain/master'
import { confirmDispatch } from '../domain/dispatch'
import { saveCompanyProfile } from '../domain/system'
import { savePerson } from '../domain/resources'
import { assignProcessResources, completeProcess, setOrderPriority } from '../domain/production'

/* The permission matrix, checked in both layers: what the interface offers
   (capabilities, routes, landings) and what the domain actually commits. */

const account = (id: string): User => DEFAULT_USERS.find((u) => u.id === id)!
const ADMIN1 = account('USR-ADM1')
const ADMIN2 = account('USR-ADM2')
const ADMIN3 = account('USR-ADM3')
const UNIT1 = account('USR-U1')

describe('permission matrix', () => {
  it('seeds each administrator with its own tier', () => {
    expect(ADMIN1.adminTier).toBe('full')
    expect(ADMIN2.adminTier).toBe('operations')
    expect(ADMIN3.adminTier).toBe('billing')
    expect(seedTierFor('USR-ADM2', 'admin')).toBe('operations')
    expect(seedTierFor('USR-U1', 'unit')).toBeNull()
  })

  it('gives Administrator 1 the whole workflow', () => {
    const caps = capabilitiesOf(ADMIN1)
    expect(caps).toEqual(
      expect.arrayContaining(['master', 'planning', 'costing', 'production.monitor', 'dispatch', 'billing', 'administration']),
    )
  })

  it('limits Administrator 2 to production monitoring, dispatch and billing', () => {
    expect(capabilitiesOf(ADMIN2).sort()).toEqual(['billing', 'dispatch', 'production.monitor', 'units.monitor'])
    expect(capabilitiesOf(ADMIN2)).not.toContain('master')
    expect(capabilitiesOf(ADMIN2)).not.toContain('planning')
    expect(capabilitiesOf(ADMIN2)).not.toContain('costing')
    // No route into internal cost or profit figures either.
    expect(capabilitiesOf(ADMIN2)).not.toContain('costing.internals')
    expect(capabilitiesOf(ADMIN2)).not.toContain('administration')
  })

  it('limits Administrator 3 to billing, plus watching the units', () => {
    expect(capabilitiesOf(ADMIN3).sort()).toEqual(['billing', 'units.monitor'])
  })

  it('lets every administrator watch the units, and no unit account', () => {
    for (const admin of [ADMIN1, ADMIN2, ADMIN3]) expect(canOpenPath(admin, '/units')).toBe(true)
    expect(canOpenPath(UNIT1, '/units')).toBe(false)
    // Watching is not working: only the unit itself reaches its own screens.
    expect(canOpenPath(ADMIN1, '/unit/staff')).toBe(false)
  })

  it('limits unit users to their own process work', () => {
    expect(capabilitiesOf(UNIT1)).toEqual(['production.work'])
  })

  it('lands every account on a page it may open', () => {
    expect(landingPath(ADMIN1)).toBe('/home')
    expect(landingPath(ADMIN2)).toBe('/home')
    expect(landingPath(ADMIN3)).toBe('/home')
    expect(landingPath(UNIT1)).toBe('/unit')
    expect(landingPath(null)).toBe('/login')
    // Recovery can never loop: the landing page is always allowed.
    for (const user of [ADMIN1, ADMIN2, ADMIN3, UNIT1]) expect(canOpenPath(user, landingPath(user))).toBe(true)
  })

  it('refuses restricted routes, including deep links and sub-paths', () => {
    const blockedForAdmin2 = ['/master', '/master/products', '/master/products/PRD-1', '/planning', '/planning/PLN-1', '/costing', '/costing/PLN-1', '/settings']
    for (const path of blockedForAdmin2) expect(canOpenPath(ADMIN2, path)).toBe(false)
    for (const path of ['/production', '/dispatch', '/billing']) expect(canOpenPath(ADMIN2, path)).toBe(true)

    for (const path of [...blockedForAdmin2, '/production', '/dispatch']) expect(canOpenPath(ADMIN3, path)).toBe(false)
    expect(canOpenPath(ADMIN3, '/billing')).toBe(true)

    // Personal account actions stay available to everyone.
    for (const user of [ADMIN2, ADMIN3, UNIT1]) expect(canOpenPath(user, '/account')).toBe(true)
    expect(canOpenPath(UNIT1, '/billing')).toBe(false)

    // Invoices: every administrator, no unit user.
    for (const user of [ADMIN1, ADMIN2, ADMIN3]) expect(canOpenPath(user, '/invoices')).toBe(true)
    expect(canOpenPath(UNIT1, '/invoices')).toBe(false)
    expect(canOpenPath(UNIT1, '/production')).toBe(true)
  })
})

describe('domain refuses what the navigation hides', () => {
  const actor = (u: User) => ctxFor({ id: u.id, name: u.name, role: u.role, unitId: u.unitId, adminTier: u.adminTier })

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

  it('blocks Administrator 2 from master, planning and costing mutations', () => {
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
    // Production is monitoring only — even plan-level adjustments are refused.
    expect(setOrderPriority(order.id, 'Urgent')(db, actor(ADMIN2)).ok).toBe(false)
  })

  it('blocks Administrator 3 from everything except reading billing', () => {
    const { db, order } = ready()
    expect(setOrderPriority(order.id, 'High')(db, actor(ADMIN3)).ok).toBe(false)
    expect(savePerson({ unitId: 'U1', name: 'Someone', designation: '' })(db, actor(ADMIN3)).ok).toBe(false)
    const dispatch = confirmDispatch({
      requestId: 'r1',
      orderId: order.id,
      date: '2026-09-15',
      quantity: 10,
      deliveryAddress: 'X',
      transporter: '',
      vehicleNo: '',
      notes: '',
    })(db, actor(ADMIN3))
    expect(dispatch.ok).toBe(false)
  })

  it('blocks administrators from shop-floor progress and units from other units’ processes', () => {
    const { db, order, personOf, machineOf } = ready()
    const first = order.stages[0].processes[0]
    const assign = assignProcessResources(order.id, first.id, {
      responsiblePersonId: personOf(first.unitId),
      machineId: machineOf(first.unitId),
      noMachineRequired: false,
    })
    // Administrators never update process progress, whatever their tier.
    expect(assign(db, actor(ADMIN1)).ok).toBe(false)
    expect(completeProcess(order.id, first.id)(db, actor(ADMIN1)).ok).toBe(false)
    // A unit may not touch another unit's process.
    expect(assign(db, actor(account('USR-U3'))).ok).toBe(false)
    const own = must(assign(db, actor(UNIT1)))
    expect(own.value.responsiblePersonId).toBe(personOf(first.unitId))
  })
})

describe('a fresh database', () => {
  it('starts with tiered administrators and empty resource registers', () => {
    const db = buildEmptyDB(new Date('2026-09-16T10:00:00'))
    expect(db.users.filter((u) => u.role === 'admin').map((u) => u.adminTier)).toEqual(['full', 'operations', 'billing'])
    expect(db.people).toEqual([])
    expect(db.machines).toEqual([])
  })
})
