import { describe, expect, it } from 'vitest'
import { buildEmptyDB } from '../lib/defaults'
import { ADMIN, BILLING_ONLY, RETIRED_UNIT, ctxFor, must } from '../test/fixtures'
import { savePerson, saveMachine, setMachineActive, setPersonActive } from './resources'

/* Units have no accounts: Administrator 1 keeps every unit's staff and machines. */

describe('unit resource creation', () => {
 it('lets Administrator 1 add a unit’s staff and machines with trimming and audit attribution', () => {
  const ctx = ctxFor(ADMIN[0])
  const p = must(savePerson({ unitId: 'U1', name: ' Kumar ', designation: '' })(buildEmptyDB(), ctx))
  expect(p.value.name).toBe('Kumar')
  const m = must(saveMachine({ unitId: 'U1', name: 'Press 1', code: '' })(p.db, ctx))
  expect(m.value.unitId).toBe('U1')
  expect(m.db.audit[0].userId).toBe(ctx.actor.id)
  expect(savePerson({ unitId: 'U1', name: 'kumar', designation: '' })(m.db, ctx).ok).toBe(false)
 })
 it('refuses staff and machine writes from every other account', () => {
  const db = buildEmptyDB()
  const p = { unitId: 'U2', name: 'Staff', designation: '' }
  const m = { unitId: 'U2', name: 'Machine', code: '' }
  for (const actor of [RETIRED_UNIT, ADMIN[1], BILLING_ONLY]) {
   expect(savePerson(p)(db, ctxFor(actor)).ok).toBe(false)
   expect(saveMachine(m)(db, ctxFor(actor)).ok).toBe(false)
  }
 })
 it('does not let a leftover unit account edit or deactivate register records', () => {
  const p = must(savePerson({ unitId: 'U2', name: 'Other unit', designation: '' })(buildEmptyDB(), ctxFor()))
  expect(savePerson({ id: p.value.id, unitId: 'U1', name: 'Moved', designation: '' })(p.db, ctxFor(RETIRED_UNIT)).ok).toBe(false)
  expect(setPersonActive(p.value.id, false)(p.db, ctxFor(RETIRED_UNIT)).ok).toBe(false)
 })
})

describe('unit staff and machine removal', () => {
 it('lets Administrator 1 remove and restore a unit’s staff and machines', () => {
  const ctx = ctxFor(ADMIN[0])
  const p = must(savePerson({ unitId: 'U1', name: 'Kumar', designation: '' })(buildEmptyDB(), ctx))
  const off = must(setPersonActive(p.value.id, false)(p.db, ctx))
  expect(off.value.active).toBe(false)
  expect(must(setPersonActive(p.value.id, true)(off.db, ctx)).value.active).toBe(true)
  const m = must(saveMachine({ unitId: 'U1', name: 'Press 1', code: '' })(p.db, ctx))
  expect(must(setMachineActive(m.value.id, false)(m.db, ctx)).value.active).toBe(false)
 })
 it('refuses to remove someone still responsible for an open process', () => {
  const ctx = ctxFor(ADMIN[0])
  const p = must(savePerson({ unitId: 'U1', name: 'Kumar', designation: '' })(buildEmptyDB(), ctx))
  const db = { ...p.db, orders: [{ code: 'JOB-1', stages: [{ processes: [{ name: 'Print', status: 'Scheduled', responsiblePersonId: p.value.id, machineId: null }] }] }] } as unknown as typeof p.db
  const r = setPersonActive(p.value.id, false)(db, ctx)
  expect(r.ok).toBe(false)
  if (!r.ok) expect(r.error).toMatch(/JOB-1 Print/)
 })
})
