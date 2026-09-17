import type { ProductionUnit, UnitId, UnitMachine, UnitPerson, VertexDB } from '../lib/types'
import { audit, docCode, fail, nextSeq, ok, requireCapability, sameText, stampNew, stampUpdate, validationFailure, command } from './common'
import type { Op } from './common'

/* ---------------------------------------------------------------------------
 * Units, responsible people and machines.
 *
 * These are execution resources, not Master data: Master stays exactly
 * Products, Costing and Customers. They live under administration (Admin 1)
 * and are referenced by production processes.
 *
 * A responsible person is a plain record — performing work never requires a
 * login account. Renaming a person, machine or unit updates the register only;
 * confirmed history keeps the names recorded on it at the time.
 * ------------------------------------------------------------------------- */

export interface PersonDraft {
  id?: string
  unitId: UnitId
  name: string
  designation: string
}

export interface MachineDraft {
  id?: string
  unitId: UnitId
  code: string
  name: string
}

export const savePerson = command(
  'savePerson',
  (draft: PersonDraft): Op<UnitPerson> =>
  (db, ctx) => {
    const denied = ctx.actor.role === 'unit' && ctx.actor.unitId === draft.unitId && !draft.id
      ? null : requireCapability(ctx, 'administration')
    if (denied) return denied
    const errors: Record<string, string> = {}
    if (!draft.name.trim()) errors.name = 'Enter the person’s name.'
    if (!db.units.some((u) => u.id === draft.unitId)) errors.unitId = 'Select the unit this person works in.'
    const clash = db.people.find((p) => p.id !== draft.id && p.unitId === draft.unitId && sameText(p.name, draft.name))
    if (clash) errors.name = `${clash.name} already exists in this unit.`
    if (Object.keys(errors).length) return validationFailure(errors)

    const existing = draft.id ? db.people.find((p) => p.id === draft.id) : undefined
    if (draft.id && !existing) return fail('Person not found.')
    if (existing) {
      const updated = stampUpdate({ ...existing, unitId: draft.unitId, name: draft.name.trim(), designation: draft.designation.trim() }, ctx)
      return ok(
        audit({ ...db, people: db.people.map((p) => (p.id === existing.id ? updated : p)) }, ctx, {
          action: 'Person updated',
          entity: 'Resource',
          entityId: updated.id,
          entityLabel: `${updated.name} (${updated.unitId})`,
        }),
        updated,
      )
    }
    const [counted, seq] = nextSeq(db, 'person')
    const person: UnitPerson = {
      id: ctx.newId('PER'),
      unitId: draft.unitId,
      name: draft.name.trim(),
      designation: draft.designation.trim(),
      active: true,
      ...stampNew(ctx),
    }
    return ok(
      audit({ ...counted, people: [...counted.people, person] }, ctx, {
        action: 'Person added',
        entity: 'Resource',
        entityId: person.id,
        entityLabel: `${person.name} (${person.unitId})`,
        newValue: docCode('PER', seq),
      }),
      person,
    )
  },
)

export const setPersonActive = command(
  'setPersonActive',
  (personId: string, active: boolean): Op<UnitPerson> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'administration')
    if (denied) return denied
    const person = db.people.find((p) => p.id === personId)
    if (!person) return fail('Person not found.')
    if (person.active === active) return ok(db, person)
    const updated = stampUpdate({ ...person, active }, ctx)
    return ok(
      audit({ ...db, people: db.people.map((p) => (p.id === personId ? updated : p)) }, ctx, {
        action: active ? 'Person reactivated' : 'Person deactivated',
        entity: 'Resource',
        entityId: personId,
        entityLabel: `${person.name} (${person.unitId})`,
      }),
      updated,
    )
  },
)

export const saveMachine = command(
  'saveMachine',
  (draft: MachineDraft): Op<UnitMachine> =>
  (db, ctx) => {
    const denied = ctx.actor.role === 'unit' && ctx.actor.unitId === draft.unitId && !draft.id
      ? null : requireCapability(ctx, 'administration')
    if (denied) return denied
    const errors: Record<string, string> = {}
    if (!draft.name.trim()) errors.name = 'Enter the machine name.'
    if (!db.units.some((u) => u.id === draft.unitId)) errors.unitId = 'Select the unit this machine belongs to.'
    const clash = db.machines.find((m) => m.id !== draft.id && m.unitId === draft.unitId && sameText(m.name, draft.name))
    if (clash) errors.name = `${clash.name} already exists in this unit.`
    if (Object.keys(errors).length) return validationFailure(errors)

    const existing = draft.id ? db.machines.find((m) => m.id === draft.id) : undefined
    if (draft.id && !existing) return fail('Machine not found.')
    if (existing) {
      const updated = stampUpdate({ ...existing, unitId: draft.unitId, code: draft.code.trim(), name: draft.name.trim() }, ctx)
      return ok(
        audit({ ...db, machines: db.machines.map((m) => (m.id === existing.id ? updated : m)) }, ctx, {
          action: 'Machine updated',
          entity: 'Resource',
          entityId: updated.id,
          entityLabel: `${updated.name} (${updated.unitId})`,
        }),
        updated,
      )
    }
    const [counted, seq] = nextSeq(db, 'machine')
    const machine: UnitMachine = {
      id: ctx.newId('MCH'),
      unitId: draft.unitId,
      code: draft.code.trim() || docCode('MCH', seq),
      name: draft.name.trim(),
      active: true,
      ...stampNew(ctx),
    }
    return ok(
      audit({ ...counted, machines: [...counted.machines, machine] }, ctx, {
        action: 'Machine added',
        entity: 'Resource',
        entityId: machine.id,
        entityLabel: `${machine.name} (${machine.unitId})`,
        newValue: machine.code,
      }),
      machine,
    )
  },
)

export const setMachineActive = command(
  'setMachineActive',
  (machineId: string, active: boolean): Op<UnitMachine> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'administration')
    if (denied) return denied
    const machine = db.machines.find((m) => m.id === machineId)
    if (!machine) return fail('Machine not found.')
    if (machine.active === active) return ok(db, machine)
    const updated = stampUpdate({ ...machine, active }, ctx)
    return ok(
      audit({ ...db, machines: db.machines.map((m) => (m.id === machineId ? updated : m)) }, ctx, {
        action: active ? 'Machine reactivated' : 'Machine deactivated',
        entity: 'Resource',
        entityId: machineId,
        entityLabel: `${machine.name} (${machine.unitId})`,
      }),
      updated,
    )
  },
)

export interface UnitDraft {
  id: UnitId
  name: string
  shortName: string
  speciality: string
  dailyCapacityJobs: number
}

/** Rename or re-describe a unit. Existing allocations keep pointing at the same id. */
export const saveUnit = command(
  'saveUnit',
  (draft: UnitDraft): Op<ProductionUnit> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'administration')
    if (denied) return denied
    const unit = db.units.find((u) => u.id === draft.id)
    if (!unit) return fail('Unit not found.')
    const errors: Record<string, string> = {}
    if (!draft.name.trim()) errors.name = 'Enter the unit name.'
    if (!Number.isFinite(draft.dailyCapacityJobs) || draft.dailyCapacityJobs < 1) errors.dailyCapacityJobs = 'Capacity must be at least 1 job.'
    if (Object.keys(errors).length) return validationFailure(errors)
    const updated: ProductionUnit = {
      ...unit,
      name: draft.name.trim(),
      shortName: draft.shortName.trim() || draft.name.trim(),
      speciality: draft.speciality.trim(),
      dailyCapacityJobs: Math.round(draft.dailyCapacityJobs),
    }
    return ok(
      audit({ ...db, units: db.units.map((u) => (u.id === unit.id ? updated : u)) }, ctx, {
        action: 'Unit updated',
        entity: 'Resource',
        entityId: unit.id,
        entityLabel: updated.name,
        oldValue: unit.name,
        newValue: updated.name,
      }),
      updated,
    )
  },
)

/** People and machines of one unit that may still be chosen. */
export function activePeople(db: Pick<VertexDB, 'people'>, unitId: UnitId): UnitPerson[] {
  return db.people.filter((p) => p.unitId === unitId && p.active)
}

export function activeMachines(db: Pick<VertexDB, 'machines'>, unitId: UnitId): UnitMachine[] {
  return db.machines.filter((m) => m.unitId === unitId && m.active)
}
