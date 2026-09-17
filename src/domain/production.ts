import type { JobProcess, JobStage, Priority, ProductionOrder, UnitId, VertexDB } from '../lib/types'
import {
  allStagesComplete,
  isProcessDone,
  isStageDone,
  processBlockers,
  recalcStage,
  refreshStageStatuses,
  rescheduleIncomplete,
} from '../lib/schedule'
import { evaluateNotifications } from '../lib/notify'
import { audit, fail, isIsoDate, notify, ok, requireCapability, command } from './common'
import type { Ctx, Op, OpFailure } from './common'

/* ---------------------------------------------------------------------------
 * Shop-floor updates belong to unit users, and only for the PROCESSES assigned
 * to their own unit. Administrators monitor; Administrator 1 may additionally
 * adjust priority, delivery date and the unit of a process that has not
 * started — never process progress.
 *
 * Process status transitions:
 *   Scheduled/Delayed ──start──▶ In Progress ──complete──▶ Completed
 *   any open status ──report problem──▶ Blocked ──start (resume)──▶ In Progress
 *
 * A process may only start once every earlier process in the order is complete,
 * and completing one process never closes another: stage completion is derived
 * from all of its processes, order completion from all of its stages.
 * ------------------------------------------------------------------------- */

interface Located {
  order: ProductionOrder
  stage: JobStage
  process: JobProcess
}

function find(db: VertexDB, orderId: string, processId: string): Located | OpFailure {
  const order = db.orders.find((o) => o.id === orderId)
  if (!order) return fail('Production order not found.')
  for (const stage of order.stages) {
    const process = stage.processes.find((p) => p.id === processId)
    if (process) return { order, stage, process }
  }
  return fail('Process not found on this order.')
}

/** Shop-floor access: the actor must be the unit this process is allocated to. */
function locate(db: VertexDB, ctx: Ctx, orderId: string, processId: string): Located | OpFailure {
  const found = find(db, orderId, processId)
  if (isFailure(found)) return found
  if (ctx.actor.role !== 'unit') return fail('Process progress is updated by the assigned production unit.')
  if (ctx.actor.unitId !== found.process.unitId)
    return fail(`This process is allocated to ${found.process.unitId}; you can only update your own unit's processes.`)
  return found
}

const isFailure = (v: Located | OpFailure): v is OpFailure => 'ok' in v

function replaceOrder(db: VertexDB, order: ProductionOrder): VertexDB {
  return { ...db, orders: db.orders.map((o) => (o.id === order.id ? order : o)) }
}

/** Write one process back and re-derive its stage; never touches other processes. */
function withProcess(order: ProductionOrder, updated: JobProcess, now: Date): ProductionOrder {
  const stages = order.stages.map((s) =>
    s.id === updated.stageId ? recalcStage({ ...s, processes: s.processes.map((p) => (p.id === updated.id ? updated : p)) }, now) : s,
  )
  return { ...order, stages }
}

function blockedMessage(order: ProductionOrder, processId: string): string | null {
  const blockers = processBlockers(order, processId)
  if (!blockers.length) return null
  const first = blockers[0]
  return `Waiting for “${first.stageName} › ${first.name}” at ${first.unitId}${blockers.length > 1 ? ` and ${blockers.length - 1} earlier process(es)` : ''}.`
}

const label = (order: ProductionOrder, process: JobProcess) => `${order.code} — ${process.stageName} › ${process.name}`

/* ------------------------------ Resource setup ---------------------------- */

export interface ProcessResources {
  responsiblePersonId: string | null
  machineId: string | null
  noMachineRequired: boolean
}

/**
 * The assigned unit allocates who performs the work and on which machine.
 * People and machines must belong to that unit; a manual process is marked
 * explicitly as needing no machine.
 */
export const assignProcessResources = command(
  'assignProcessResources',
  (orderId: string, processId: string, resources: ProcessResources): Op<JobProcess> =>
  (db, ctx) => {
    const found = locate(db, ctx, orderId, processId)
    if (isFailure(found)) return found
    const { order, process } = found
    if (isProcessDone(process)) return fail(`${process.name} is already completed.`)

    const errors: Record<string, string> = {}
    const person = resources.responsiblePersonId ? db.people.find((p) => p.id === resources.responsiblePersonId) : null
    if (resources.responsiblePersonId && !person) errors.responsiblePersonId = 'Select a person from this unit.'
    else if (person && (!person.active || person.unitId !== process.unitId))
      errors.responsiblePersonId = `${person.name} does not belong to ${process.unitId}.`

    const machine = resources.machineId ? db.machines.find((m) => m.id === resources.machineId) : null
    if (resources.machineId && !machine) errors.machineId = 'Select a machine from this unit.'
    else if (machine && (!machine.active || machine.unitId !== process.unitId))
      errors.machineId = `${machine.name} does not belong to ${process.unitId}.`
    if (process.requiresMachine && !machine) errors.machineId = 'This process is configured to need a machine.'
    if (machine && resources.noMachineRequired) errors.machineId = 'Either choose a machine or mark the process as needing none.'

    if (Object.keys(errors).length) return fail(Object.values(errors)[0], { fieldErrors: errors })

    const stamp = ctx.now.toISOString()
    const updated: JobProcess = {
      ...process,
      responsiblePersonId: person?.id ?? null,
      machineId: machine?.id ?? null,
      noMachineRequired: !machine && resources.noMachineRequired,
      assignedBy: ctx.actor.name,
      assignedAt: stamp,
      updatedBy: ctx.actor.name,
      updatedAt: stamp,
    }
    const next = audit(replaceOrder(db, withProcess(order, updated, ctx.now)), ctx, {
      action: 'Process resources assigned',
      entity: 'Process',
      entityId: processId,
      entityLabel: label(order, process),
      field: 'Responsible person / machine',
      oldValue: `${process.responsiblePersonId ?? '—'} / ${process.machineId ?? (process.noMachineRequired ? 'No machine' : '—')}`,
      newValue: `${person?.name ?? '—'} / ${machine?.name ?? (updated.noMachineRequired ? 'No machine required' : '—')}`,
    })
    return ok(next, updated)
  },
)

/* ------------------------------ Process progress -------------------------- */

export const startProcess = command(
  'startProcess',
  (orderId: string, processId: string): Op<JobProcess> =>
  (db, ctx) => {
    const found = locate(db, ctx, orderId, processId)
    if (isFailure(found)) return found
    const { order, process } = found
    if (isProcessDone(process)) return fail(`${process.name} is already completed.`)
    if (process.status === 'In Progress') return ok(db, process)
    const blocked = blockedMessage(order, processId)
    if (blocked) return fail(blocked)
    if (!process.responsiblePersonId)
      return fail('Assign a responsible person before starting this process.', {
        fieldErrors: { responsiblePersonId: 'Assign a responsible person before starting.' },
      })
    if (process.requiresMachine && !process.machineId)
      return fail('This process needs a machine before it can start.', { fieldErrors: { machineId: 'Select the machine.' } })

    const stamp = ctx.now.toISOString()
    const resumed = process.status === 'Blocked'
    const updated: JobProcess = {
      ...process,
      status: 'In Progress',
      actualStart: process.actualStart ?? stamp,
      problem: undefined,
      updatedBy: ctx.actor.name,
      updatedAt: stamp,
    }
    let next = replaceOrder(db, withProcess(order, updated, ctx.now))
    next = audit(next, ctx, {
      action: resumed ? 'Process resumed after problem' : 'Process started',
      entity: 'Process',
      entityId: processId,
      entityLabel: label(order, process),
      field: 'Status',
      oldValue: process.status,
      newValue: 'In Progress',
      reason: resumed ? `Problem cleared: ${process.problem ?? ''}` : undefined,
    })
    next = notify(next, ctx, {
      key: `${orderId}:${processId}:started:${stamp}`,
      title: `${order.code} — ${process.name} ${resumed ? 'resumed' : 'started'}`,
      message: `${ctx.actor.name} (${process.unitId}) ${resumed ? 'resumed' : 'started'} ${process.stageName} › ${process.name}.`,
      level: 'info',
      audience: 'admin',
      unitId: process.unitId,
      orderId,
    })
    return ok(next, updated)
  },
)

export interface CompleteProcessResult {
  process: JobProcess
  stageCompleted: boolean
  orderCompleted: boolean
}

export const completeProcess = command(
  'completeProcess',
  (orderId: string, processId: string): Op<CompleteProcessResult> =>
  (db, ctx) => {
    const found = locate(db, ctx, orderId, processId)
    if (isFailure(found)) return found
    const { order, process } = found
    if (isProcessDone(process))
      return ok(db, { process, stageCompleted: isStageDone(found.stage), orderCompleted: order.status === 'Completed' })
    const blocked = blockedMessage(order, processId)
    if (blocked) return fail(blocked)
    if (!process.responsiblePersonId)
      return fail('Record the responsible person before completing this process.', {
        fieldErrors: { responsiblePersonId: 'Assign a responsible person.' },
      })

    const stamp = ctx.now.toISOString()
    const updated: JobProcess = {
      ...process,
      status: 'Completed',
      actualStart: process.actualStart ?? stamp,
      actualEnd: stamp,
      problem: undefined,
      done: true,
      doneAt: stamp,
      doneBy: ctx.actor.name,
      updatedBy: ctx.actor.name,
      updatedAt: stamp,
    }
    const workedOrder = withProcess(order, updated, ctx.now)
    const stage = workedOrder.stages.find((s) => s.id === process.stageId)!
    const stageCompleted = isStageDone(stage)
    const orderCompleted = allStagesComplete(workedOrder.stages)
    const updatedOrder: ProductionOrder = {
      ...workedOrder,
      status: orderCompleted ? 'Completed' : workedOrder.status,
      completedAt: orderCompleted ? stamp : workedOrder.completedAt,
      completedQty: orderCompleted ? workedOrder.quantity : workedOrder.completedQty,
    }

    let next = replaceOrder(db, updatedOrder)
    next = audit(next, ctx, {
      action: 'Process completed',
      entity: 'Process',
      entityId: processId,
      entityLabel: label(order, process),
      field: 'Status',
      oldValue: process.status,
      newValue: 'Completed',
    })
    if (stageCompleted) {
      next = audit(next, ctx, {
        action: 'Stage completed',
        entity: 'Stage',
        entityId: stage.id,
        entityLabel: `${order.code} — ${stage.name}`,
        field: 'Status',
        newValue: 'Completed',
        reason: 'All required processes of this stage are complete.',
      })
      next = notify(next, ctx, {
        key: `${orderId}:${stage.id}:stage-completed`,
        title: `${order.code} — ${stage.name} completed`,
        message: `Every process in ${stage.name} is closed.`,
        level: 'success',
        audience: 'admin',
        orderId,
      })
    }
    next = notify(next, ctx, {
      key: `${orderId}:${processId}:completed`,
      title: `${order.code} — ${process.name} completed`,
      message: `${ctx.actor.name} (${process.unitId}) closed ${process.stageName} › ${process.name}.`,
      level: 'success',
      audience: 'admin',
      unitId: process.unitId,
      orderId,
    })

    const following = updatedOrder.stages.flatMap((s) => s.processes).find((p) => !isProcessDone(p))
    if (following && following.unitId !== process.unitId && !processBlockers(updatedOrder, following.id).length) {
      next = notify(next, ctx, {
        key: `${orderId}:${following.id}:ready`,
        title: `${order.code} — ${following.name} ready for ${following.unitId}`,
        message: `${process.stageName} › ${process.name} is complete. ${following.stageName} › ${following.name} can start.`,
        level: 'info',
        audience: 'unit',
        unitId: following.unitId,
        orderId,
      })
    }
    if (orderCompleted) {
      next = audit(next, ctx, {
        action: 'Production completed',
        entity: 'Production Order',
        entityId: orderId,
        entityLabel: `${order.code} — ${order.customer.company}`,
        field: 'Completed quantity',
        newValue: String(order.quantity),
      })
      next = notify(next, ctx, {
        key: `${orderId}:ready-dispatch`,
        title: `${order.code} ready for dispatch`,
        message: `All stages closed for ${order.customer.company}. ${order.quantity.toLocaleString('en-IN')} ${order.uom} available in Dispatch.`,
        level: 'success',
        audience: 'admin',
        orderId,
      })
    }
    return ok(next, { process: updated, stageCompleted, orderCompleted })
  },
)

export const reportProcessProblem = command(
  'reportProcessProblem',
  (orderId: string, processId: string, problem: string): Op<JobProcess> =>
  (db, ctx) => {
    const found = locate(db, ctx, orderId, processId)
    if (isFailure(found)) return found
    const { order, process } = found
    if (!problem.trim()) return fail('Describe the problem.', { fieldErrors: { problem: 'Describe the problem.' } })
    if (isProcessDone(process)) return fail(`${process.name} is already completed.`)
    const stamp = ctx.now.toISOString()
    const updated: JobProcess = {
      ...process,
      status: 'Blocked',
      problem: problem.trim(),
      updatedBy: ctx.actor.name,
      updatedAt: stamp,
    }
    let next = replaceOrder(db, withProcess(order, updated, ctx.now))
    next = audit(next, ctx, {
      action: 'Problem reported',
      entity: 'Process',
      entityId: processId,
      entityLabel: label(order, process),
      field: 'Status',
      oldValue: process.status,
      newValue: 'Blocked',
      reason: problem.trim(),
    })
    next = notify(next, ctx, {
      key: `${orderId}:${processId}:blocked:${stamp}`,
      title: `Problem reported — ${order.code}`,
      message: `${process.unitId} reported a problem in ${process.stageName} › ${process.name}: ${problem.trim()}`,
      level: 'danger',
      audience: 'admin',
      unitId: process.unitId,
      orderId,
    })
    return ok(next, updated)
  },
)

export const saveProcessNote = command(
  'saveProcessNote',
  (orderId: string, processId: string, note: string): Op<JobProcess> =>
  (db, ctx) => {
    const found = locate(db, ctx, orderId, processId)
    if (isFailure(found)) return found
    const { order, process } = found
    const updated: JobProcess = {
      ...process,
      note: note.trim() || undefined,
      updatedBy: ctx.actor.name,
      updatedAt: ctx.now.toISOString(),
    }
    const next = audit(replaceOrder(db, withProcess(order, updated, ctx.now)), ctx, {
      action: 'Process note saved',
      entity: 'Process',
      entityId: processId,
      entityLabel: label(order, process),
      field: 'Note',
      oldValue: process.note,
      newValue: note.trim() || '(cleared)',
    })
    return ok(next, updated)
  },
)

/* ------------------------------ Admin adjustments ------------------------- */
/* Production is monitoring-only. These change the PLAN behind an order, so they
   need the planning capability (Administrator 1), not merely monitoring. */

export const setOrderPriority = command(
  'setOrderPriority',
  (orderId: string, priority: Priority): Op<ProductionOrder> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'planning')
    if (denied) return denied
    const order = db.orders.find((o) => o.id === orderId)
    if (!order) return fail('Production order not found.')
    if (order.priority === priority) return ok(db, order)
    const updated = { ...order, priority }
    return ok(
      audit(replaceOrder(db, updated), ctx, {
        action: 'Priority changed',
        entity: 'Production Order',
        entityId: orderId,
        entityLabel: order.code,
        field: 'Priority',
        oldValue: order.priority,
        newValue: priority,
      }),
      updated,
    )
  },
)

export const reviseDeliveryDate = command(
  'reviseDeliveryDate',
  (orderId: string, deliveryDate: string, reason: string): Op<ProductionOrder> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'planning')
    if (denied) return denied
    const order = db.orders.find((o) => o.id === orderId)
    if (!order) return fail('Production order not found.')
    if (order.status === 'Completed') return fail('Production is already complete.')
    if (!isIsoDate(deliveryDate)) return fail('Enter a valid delivery date.', { fieldErrors: { deliveryDate: 'Enter a valid date.' } })
    if (deliveryDate < order.orderDate)
      return fail('Delivery cannot be before the order date.', { fieldErrors: { deliveryDate: 'Delivery cannot be before the order date.' } })
    if (!reason.trim()) return fail('Record the reason for the change.', { fieldErrors: { reason: 'Record the reason for the change.' } })
    const updated = { ...order, deliveryDate, stages: rescheduleIncomplete(order, deliveryDate, db.settings.bufferHours, ctx.now) }
    let next = audit(replaceOrder(db, updated), ctx, {
      action: 'Delivery date revised',
      entity: 'Production Order',
      entityId: orderId,
      entityLabel: order.code,
      field: 'Delivery date',
      oldValue: order.deliveryDate,
      newValue: deliveryDate,
      reason: reason.trim(),
    })
    const affected = new Set(
      order.stages.flatMap((s) => s.processes).filter((p) => !isProcessDone(p)).map((p) => p.unitId),
    )
    for (const unitId of affected) {
      next = notify(next, ctx, {
        key: `${orderId}:replan:${deliveryDate}:${unitId}`,
        title: `${order.code} re-planned`,
        message: `Delivery moved from ${order.deliveryDate} to ${deliveryDate}. Your pending process times were updated.`,
        level: 'warn',
        audience: 'unit',
        unitId,
        orderId,
      })
    }
    return ok(next, updated)
  },
)

/**
 * Move one process to another unit. Person and machine belong to the old unit,
 * so they are cleared and the new unit must allocate its own resources.
 */
export const reassignProcessUnit = command(
  'reassignProcessUnit',
  (orderId: string, processId: string, unitId: UnitId, reason: string): Op<ProductionOrder> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'planning')
    if (denied) return denied
    const found = find(db, orderId, processId)
    if (isFailure(found)) return found
    const { order, process } = found
    if (!db.units.some((u) => u.id === unitId)) return fail('Select an existing production unit.')
    if (process.unitId === unitId) return ok(db, order)
    if (isProcessDone(process) || process.status === 'In Progress' || process.actualStart)
      return fail('Only a process that has not started can move to another unit.')
    if (!reason.trim()) return fail('Record the reason for the change.', { fieldErrors: { reason: 'Record the reason for the change.' } })

    const cleared = !!(process.responsiblePersonId || process.machineId)
    const updatedProcess: JobProcess = {
      ...process,
      unitId,
      // Resources belong to the previous unit — the new unit must re-allocate.
      responsiblePersonId: null,
      machineId: null,
      noMachineRequired: false,
      assignedBy: undefined,
      assignedAt: undefined,
      updatedBy: ctx.actor.name,
      updatedAt: ctx.now.toISOString(),
    }
    const updated = withProcess(order, updatedProcess, ctx.now)
    let next = audit(replaceOrder(db, updated), ctx, {
      action: 'Process unit re-assigned',
      entity: 'Process',
      entityId: processId,
      entityLabel: label(order, process),
      field: 'Production unit',
      oldValue: process.unitId,
      newValue: unitId,
      reason: `${reason.trim()}${cleared ? ' (responsible person and machine cleared for re-assignment)' : ''}`,
    })
    next = notify(next, ctx, {
      key: `${orderId}:${processId}:assigned:${unitId}:${ctx.now.getTime()}`,
      title: `${order.code} — ${process.name} assigned to ${unitId}`,
      message: `${process.stageName} › ${process.name} moved from ${process.unitId} to your unit. Assign a responsible person${process.requiresMachine ? ' and machine' : ''} before starting.`,
      level: 'info',
      audience: 'unit',
      unitId,
      orderId,
    })
    return ok(next, updated)
  },
)

/* ------------------------------- Clock sweep ------------------------------ */

/** Refresh Delayed/Scheduled against the clock and raise schedule alerts. Returns the same object when nothing changed. */
export function sweepSchedules(db: VertexDB, now: Date): VertexDB {
  let changed = false
  const orders = db.orders.map((o) => {
    if (o.status === 'Completed') return o
    const stages = refreshStageStatuses(o, now)
    if (stages === o.stages) return o
    changed = true
    return { ...o, stages }
  })
  const fresh = evaluateNotifications(orders, new Set(db.notifications.map((n) => n.key)), now)
  if (!changed && !fresh.length) return db
  return { ...db, orders, notifications: [...fresh, ...db.notifications].slice(0, 300) }
}
