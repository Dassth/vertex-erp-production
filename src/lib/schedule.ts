import type {
  JobHealth,
  JobProcess,
  JobStage,
  Priority,
  ProcessStatus,
  ProductStage,
  ProductionOrder,
  StageStatus,
  UnitId,
} from './types'
import { isSameDay, parseISO } from 'date-fns'
import { addWorkingHours, alignForward, subWorkingHours, workingHoursBetween } from './workhours'

/* ---------------------------------------------------------------------------
 * Scheduling engine — driven by the product's own stages and processes.
 *
 *   process hours = setup hours + run hours per 1,000 × qty ÷ 1,000
 *   stage window  = first process start → last process end
 *
 * The PROCESS is the unit of work: it carries the unit allocation, the schedule
 * window and the status. Processes run strictly in their configured order
 * (stage by stage, process by process) inside working hours. A stage may span
 * several units, so a stage has no unit of its own — read its processes.
 *
 * Stage status is DERIVED from its processes, and order completion is derived
 * from its stages, so finishing one process can never silently close another.
 * ------------------------------------------------------------------------- */

export const PRIORITY_BUFFER: Record<Priority, number> = { Urgent: 0.35, High: 0.65, Normal: 1, Low: 1.35 }
export const PRIORITY_ORDER: Record<Priority, number> = { Urgent: 0, High: 1, Normal: 2, Low: 3 }
export const PRIORITIES: Priority[] = ['Low', 'Normal', 'High', 'Urgent']

export const COMPLETED_STATUSES: StageStatus[] = ['Completed', 'Completed by Progression']

export function isStageDone(stage: Pick<JobStage, 'status'>): boolean {
  return COMPLETED_STATUSES.includes(stage.status)
}

export function isProcessDone(process: Pick<JobProcess, 'status'>): boolean {
  return process.status === 'Completed'
}

/** Unmeasured times (null) schedule as zero; costing readiness reports them. */
export function processHours(p: { setupHours: number | null; runHoursPer1000: number | null }, quantity: number): number {
  return Math.max(0, p.setupHours ?? 0) + (Math.max(0, p.runHoursPer1000 ?? 0) * quantity) / 1000
}

export function stageHours(stage: ProductStage, quantity: number): number {
  const total = stage.processes.reduce((s, p) => s + processHours(p, quantity), 0)
  return Number(Math.max(0.5, total).toFixed(2))
}

/** Every process of an order, in execution order. */
export function allProcesses(order: Pick<ProductionOrder, 'stages'>): JobProcess[] {
  return order.stages.flatMap((s) => s.processes)
}

/** The units a stage actually spans — a stage is not owned by one unit. */
export function stageUnitIds(stage: JobStage): UnitId[] {
  return [...new Set(stage.processes.map((p) => p.unitId).filter(Boolean))]
}

/* ------------------------------ Derived status ---------------------------- */

export function deriveStageStatus(stage: JobStage, now: Date = new Date()): StageStatus {
  const processes = stage.processes
  if (!processes.length) return stage.status
  if (processes.every(isProcessDone)) return 'Completed'
  if (processes.some((p) => p.status === 'Blocked')) return 'Blocked'
  if (processes.some((p) => p.status === 'In Progress')) return 'In Progress'
  // Part of the stage is finished: work has started even if nothing is running now.
  if (processes.some(isProcessDone)) return 'In Progress'
  const open = processes.filter((p) => !isProcessDone(p))
  if (open.some((p) => new Date(p.plannedEnd).getTime() < now.getTime())) return 'Delayed'
  return 'Scheduled'
}

/** Recompute a stage window and status from the processes it contains. */
export function recalcStage(stage: JobStage, now: Date = new Date()): JobStage {
  if (!stage.processes.length) return stage
  const starts = stage.processes.map((p) => p.plannedStart).sort()
  const ends = stage.processes.map((p) => p.plannedEnd).sort()
  const actualStarts = stage.processes.map((p) => p.actualStart).filter(Boolean).sort() as string[]
  const actualEnds = stage.processes.map((p) => p.actualEnd).filter(Boolean).sort() as string[]
  const status = deriveStageStatus(stage, now)
  const complete = status === 'Completed'
  return {
    ...stage,
    status,
    plannedStart: starts[0] ?? stage.plannedStart,
    plannedEnd: ends[ends.length - 1] ?? stage.plannedEnd,
    durationHours: Number(stage.processes.reduce((s, p) => s + p.durationHours, 0).toFixed(2)),
    actualStart: actualStarts[0] ?? stage.actualStart,
    actualEnd: complete ? (actualEnds[actualEnds.length - 1] ?? stage.actualEnd) : undefined,
    problem: stage.processes.find((p) => p.problem)?.problem,
  }
}

export function recalcStages(stages: JobStage[], now: Date = new Date()): JobStage[] {
  return stages.map((s) => recalcStage(s, now))
}

/** True when every process of every stage is complete. */
export function allStagesComplete(stages: JobStage[]): boolean {
  return stages.length > 0 && stages.every((s) => s.processes.every(isProcessDone))
}

/* -------------------------------- Dependencies ---------------------------- */

/* ---------------------------------------------------------------------------
 * EXECUTION ORDER — the rule, stated once.
 *
 * A product configures no dependency graph: it is an ordered list of stages,
 * each holding an ordered list of processes. The enforced rule is therefore the
 * only order the data actually expresses — a single chain:
 *
 *     stage 1 process 1 → stage 1 process 2 → stage 2 process 1 → …
 *
 * A process may start only when EVERY earlier process in that chain is
 * complete, whichever unit each one belongs to, and the planner lays the
 * windows out end to end in the same order.
 *
 * KNOWN MISMATCH (deliberate, not a regression to fix here): allocating two
 * processes of one stage to different units does NOT let them run at the same
 * time — the later one still waits. Before process-level allocation, processes
 * inside a stage were ticked off in any order, so that freedom is narrower now.
 * Genuine parallel execution needs an explicit dependency model on the product
 * (for example "runs after" per process) and is out of scope here.
 * ------------------------------------------------------------------------- */

/** Processes that must finish before this one may start, in execution order. */
export function processBlockers(order: Pick<ProductionOrder, 'stages'>, processId: string): JobProcess[] {
  const sequence = allProcesses(order)
  const at = sequence.findIndex((p) => p.id === processId)
  if (at < 0) return []
  return sequence.slice(0, at).filter((p) => !isProcessDone(p))
}

export function isProcessReady(order: Pick<ProductionOrder, 'stages'>, processId: string): boolean {
  return processBlockers(order, processId).length === 0
}

/* ------------------------------ Plan building ----------------------------- */

interface PlanSpread {
  factor: number
  slackPerHour: number
}

function planSpread(available: number, required: number): PlanSpread {
  if (required <= 0) return { factor: 1, slackPerHour: 0 }
  if (available <= required) return { factor: Math.max(0.35, available / required), slackPerHour: 0 }
  return { factor: 1, slackPerHour: Math.min(6, (available - required) / required) }
}

function planAnchor(orderDate: string, now: Date): Date {
  const booked = parseISO(orderDate)
  return alignForward(isSameDay(booked, now) && now > booked ? now : booked < now ? now : booked)
}

export function deliveryMoment(deliveryDate: string): Date {
  const d = parseISO(deliveryDate)
  d.setHours(18, 0, 0, 0)
  return d
}

export interface BuildStagesInput {
  stages: ProductStage[]
  /** Production unit for every product process id. */
  processUnits: Record<string, UnitId>
  quantity: number
  orderDate: string
  deliveryDate: string
  priority: Priority
  bufferHours: number
  now: Date
  newId: (prefix: string) => string
}

export function buildJobStages(input: BuildStagesInput): JobStage[] {
  const durations = input.stages.map((s) => s.processes.map((p) => Math.max(0.25, processHours(p, input.quantity))))
  const required = durations.flat().reduce((a, b) => a + b, 0)
  const start = planAnchor(input.orderDate, input.now)
  const planEnd = subWorkingHours(deliveryMoment(input.deliveryDate), input.bufferHours * PRIORITY_BUFFER[input.priority])
  const { factor, slackPerHour } = planSpread(workingHoursBetween(start, planEnd), required)

  let cursor = start
  let first = true
  return input.stages.map((stage, si) => {
    const stageId = input.newId('stg')
    const processes: JobProcess[] = stage.processes.map((p, pi) => {
      const dur = Number(Math.max(0.25, durations[si][pi] * factor).toFixed(2))
      const gap = first ? 0 : dur * slackPerHour
      first = false
      const plannedStart = gap > 0 ? addWorkingHours(cursor, gap) : cursor
      const plannedEnd = addWorkingHours(plannedStart, dur)
      cursor = plannedEnd
      return {
        id: input.newId('jpr'),
        processDefId: p.id,
        stageId,
        stageDefId: stage.id,
        stageName: stage.name,
        name: p.name,
        index: pi,
        unitId: input.processUnits[p.id],
        status: 'Scheduled' as ProcessStatus,
        durationHours: dur,
        plannedStart: plannedStart.toISOString(),
        plannedEnd: plannedEnd.toISOString(),
        responsiblePersonId: null,
        machineId: null,
        requiresMachine: !!p.requiresMachine,
        noMachineRequired: false,
        done: false,
        doneAt: null,
        doneBy: null,
      }
    })
    return {
      id: stageId,
      stageDefId: stage.id,
      index: si,
      name: stage.name,
      description: stage.description,
      status: 'Scheduled' as StageStatus,
      plannedStart: processes[0]?.plannedStart ?? start.toISOString(),
      plannedEnd: processes[processes.length - 1]?.plannedEnd ?? start.toISOString(),
      durationHours: Number(processes.reduce((s, p) => s + p.durationHours, 0).toFixed(2)),
      processes,
    }
  })
}

/** Re-plan unfinished processes for a revised delivery date. Finished work keeps its record. */
export function rescheduleIncomplete(
  order: ProductionOrder,
  newDeliveryDate: string,
  bufferHours: number,
  now: Date,
): JobStage[] {
  const pending = allProcesses(order).filter((p) => !isProcessDone(p))
  if (!pending.length) return order.stages
  const doneEnds = allProcesses(order)
    .filter(isProcessDone)
    .map((p) => p.actualEnd)
    .filter(Boolean)
    .sort() as string[]
  const anchor = doneEnds.length ? new Date(doneEnds[doneEnds.length - 1]) : now
  const start = alignForward(anchor > now ? anchor : now)
  const planEnd = subWorkingHours(deliveryMoment(newDeliveryDate), bufferHours * PRIORITY_BUFFER[order.priority])
  const required = pending.reduce((s, p) => s + Math.max(0.25, p.durationHours), 0)
  const { factor, slackPerHour } = planSpread(workingHoursBetween(start, planEnd), required)

  const windows = new Map<string, { plannedStart: string; plannedEnd: string; durationHours: number }>()
  let cursor = start
  pending.forEach((p, i) => {
    const dur = Number(Math.max(0.25, Math.max(0.25, p.durationHours) * factor).toFixed(2))
    const gap = i === 0 ? 0 : dur * slackPerHour
    const windowStart = gap > 0 ? addWorkingHours(cursor, gap) : cursor
    const plannedEnd = addWorkingHours(windowStart, dur)
    const keepStart = p.status === 'In Progress' && p.actualStart ? new Date(p.actualStart) : windowStart
    windows.set(p.id, { plannedStart: keepStart.toISOString(), plannedEnd: plannedEnd.toISOString(), durationHours: dur })
    cursor = plannedEnd
  })

  return recalcStages(
    order.stages.map((stage) => ({
      ...stage,
      processes: stage.processes.map((p) => {
        const w = windows.get(p.id)
        if (!w) return p
        return { ...p, ...w, status: p.status === 'Delayed' ? ('Scheduled' as ProcessStatus) : p.status }
      }),
    })),
    now,
  )
}

/* ------------------------------- Job metrics ------------------------------ */

const weightOf = (p: JobProcess) => Math.max(0.01, p.durationHours)

export function stageProgress(stage: JobStage): number {
  if (!stage.processes.length) return isStageDone(stage) ? 1 : 0
  const total = stage.processes.reduce((s, p) => s + weightOf(p), 0)
  const done = stage.processes.filter(isProcessDone).reduce((s, p) => s + weightOf(p), 0)
  const running = stage.processes.some((p) => p.status === 'In Progress')
  const frac = total ? done / total : 0
  if (frac >= 1) return 1
  return Math.min(0.95, running ? Math.max(0.1, frac) : frac)
}

export function progressPct(order: ProductionOrder): number {
  const processes = allProcesses(order)
  if (!processes.length) return 0
  const total = processes.reduce((s, p) => s + weightOf(p), 0)
  const done = processes.filter(isProcessDone).reduce((s, p) => s + weightOf(p), 0)
  return Math.round((done / total) * 100)
}

export function currentProcess(order: ProductionOrder): JobProcess | null {
  const processes = allProcesses(order)
  return processes.find((p) => p.status === 'In Progress') ?? processes.find((p) => !isProcessDone(p)) ?? null
}

export function currentStage(order: ProductionOrder): JobStage | null {
  const running = currentProcess(order)
  if (running) return order.stages.find((s) => s.id === running.stageId) ?? null
  return order.stages.find((s) => !isStageDone(s)) ?? null
}

export function nextStage(order: ProductionOrder): JobStage | null {
  const cur = currentStage(order)
  if (!cur) return null
  return order.stages.find((s) => s.index > cur.index && !isStageDone(s)) ?? null
}

export function remainingHours(order: ProductionOrder): number {
  return allProcesses(order)
    .filter((p) => !isProcessDone(p))
    .reduce((sum, p) => sum + p.durationHours, 0)
}

export function jobHealth(order: ProductionOrder, now: Date = new Date()): JobHealth {
  const pending = allProcesses(order).filter((p) => !isProcessDone(p))
  if (!pending.length) return 'Completed'
  if (pending.some((p) => p.status === 'Blocked')) return 'Delayed'
  if (pending.some((p) => new Date(p.plannedEnd).getTime() < now.getTime())) return 'Delayed'
  const deadline = deliveryMoment(order.deliveryDate)
  if (deadline.getTime() < now.getTime()) return 'Delayed'
  if (workingHoursBetween(now, deadline) < remainingHours(order)) return 'At Risk'
  if (pending.some((p) => new Date(p.plannedStart).getTime() < now.getTime() && p.status !== 'In Progress')) return 'At Risk'
  return 'On Time'
}

/** Move open processes between Scheduled and Delayed as the clock passes their window. */
export function refreshStageStatuses(order: ProductionOrder, now: Date = new Date()): JobStage[] {
  let changed = false
  const stages = order.stages.map((stage) => {
    let processChanged = false
    const processes = stage.processes.map((p) => {
      if (isProcessDone(p) || p.status === 'Blocked' || p.status === 'In Progress') return p
      const overdue = new Date(p.plannedEnd).getTime() < now.getTime()
      if (overdue && p.status !== 'Delayed') {
        processChanged = true
        return { ...p, status: 'Delayed' as ProcessStatus }
      }
      if (!overdue && p.status === 'Delayed') {
        processChanged = true
        return { ...p, status: 'Scheduled' as ProcessStatus }
      }
      return p
    })
    if (processChanged) {
      changed = true
      return recalcStage({ ...stage, processes }, now)
    }
    const status = deriveStageStatus(stage, now)
    if (status !== stage.status) {
      changed = true
      return { ...stage, status }
    }
    return stage
  })
  return changed ? stages : order.stages
}

/** First moment any process actually started, and when the order closed. */
export function productionDates(order: ProductionOrder): { startedAt: string | null; completedAt: string | null } {
  const starts = allProcesses(order).map((p) => p.actualStart).filter(Boolean).sort() as string[]
  return { startedAt: starts[0] ?? null, completedAt: order.completedAt }
}
