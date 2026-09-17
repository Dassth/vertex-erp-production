import { isSameDay, parseISO } from 'date-fns'
import type { JobHealth, JobProcess, JobStage, ProductionOrder, ProductionUnit, UnitId, VertexDB } from './types'
import {
  allProcesses,
  currentStage,
  isProcessDone,
  isStageDone,
  jobHealth,
  nextStage,
  processBlockers,
  progressPct,
  stageUnitIds,
} from './schedule'

export interface JobView {
  order: ProductionOrder
  health: JobHealth
  progress: number
  current: JobStage | null
  next: JobStage | null
  doneCount: number
  totalStages: number
  doneProcesses: number
  totalProcesses: number
}

export function toJobView(order: ProductionOrder, now = new Date()): JobView {
  const processes = allProcesses(order)
  return {
    order,
    health: jobHealth(order, now),
    progress: progressPct(order),
    current: currentStage(order),
    next: nextStage(order),
    doneCount: order.stages.filter(isStageDone).length,
    totalStages: order.stages.length,
    doneProcesses: processes.filter(isProcessDone).length,
    totalProcesses: processes.length,
  }
}

export function allJobViews(db: VertexDB, now = new Date()): JobView[] {
  return db.orders.map((o) => toJobView(o, now))
}

export interface UnitSummary {
  unit: ProductionUnit
  /** Jobs with at least one open process allocated to this unit. */
  jobsHere: number
  openProcesses: number
  readyProcesses: number
  delayedProcesses: number
  completedProcesses: number
  loadPct: number
}

export function unitSummaries(views: JobView[], units: ProductionUnit[], now = new Date()): UnitSummary[] {
  return units.map((unit) => {
    let openProcesses = 0
    let readyProcesses = 0
    let delayedProcesses = 0
    let completedProcesses = 0
    let jobsHere = 0
    for (const v of views) {
      let openHere = false
      for (const p of allProcesses(v.order)) {
        if (p.unitId !== unit.id) continue
        if (isProcessDone(p)) {
          completedProcesses += 1
          continue
        }
        openProcesses += 1
        openHere = true
        if (!processBlockers(v.order, p.id).length) readyProcesses += 1
        if (p.status === 'Blocked' || p.status === 'Delayed' || new Date(p.plannedEnd).getTime() < now.getTime()) delayedProcesses += 1
      }
      if (openHere && v.health !== 'Completed') jobsHere += 1
    }
    return {
      unit,
      jobsHere,
      openProcesses,
      readyProcesses,
      delayedProcesses,
      completedProcesses,
      loadPct: Math.min(100, Math.round((jobsHere / Math.max(1, unit.dailyCapacityJobs)) * 100)),
    }
  })
}

/** One row of shop-floor work: a process, always shown with its parent stage. */
export interface ProcessWorkRow {
  key: string
  order: ProductionOrder
  stage: JobStage
  process: JobProcess
  ready: boolean
  blockers: JobProcess[]
  overdue: boolean
}

export function processRow(order: ProductionOrder, stage: JobStage, process: JobProcess, now: Date): ProcessWorkRow {
  const blockers = processBlockers(order, process.id)
  return {
    key: `${order.id}:${process.id}`,
    order,
    stage,
    process,
    ready: !isProcessDone(process) && !blockers.length,
    blockers,
    overdue: !isProcessDone(process) && new Date(process.plannedEnd).getTime() < now.getTime(),
  }
}

function eachProcess(order: ProductionOrder, now: Date): ProcessWorkRow[] {
  return order.stages.flatMap((stage) => stage.processes.map((p) => processRow(order, stage, p, now)))
}

/** Process work for today: running, planned to touch today, or already overdue. */
export function todaysProcessWork(orders: ProductionOrder[], now = new Date()): ProcessWorkRow[] {
  const rows: ProcessWorkRow[] = []
  for (const order of orders) {
    if (order.status === 'Completed') continue
    for (const row of eachProcess(order, now)) {
      const p = row.process
      if (isProcessDone(p)) continue
      const touchesToday =
        p.status === 'In Progress' ||
        isSameDay(parseISO(p.plannedStart), now) ||
        isSameDay(parseISO(p.plannedEnd), now) ||
        (parseISO(p.plannedStart) < now && parseISO(p.plannedEnd) > now)
      if (touchesToday || row.overdue) rows.push(row)
    }
  }
  return rows.sort((a, b) => a.process.plannedStart.localeCompare(b.process.plannedStart))
}

export interface UnitWork {
  ready: ProcessWorkRow[]
  waiting: ProcessWorkRow[]
  completed: ProcessWorkRow[]
  /** Allocated work that cannot start until a person (and machine) are chosen. */
  needsResources: ProcessWorkRow[]
}

/** Everything one unit may see: only the processes allocated to that unit. */
export function unitWork(orders: ProductionOrder[], unitId: UnitId, now = new Date()): UnitWork {
  const ready: ProcessWorkRow[] = []
  const waiting: ProcessWorkRow[] = []
  const completed: ProcessWorkRow[] = []
  const needsResources: ProcessWorkRow[] = []
  for (const order of orders) {
    for (const row of eachProcess(order, now)) {
      if (row.process.unitId !== unitId) continue
      if (isProcessDone(row.process)) completed.push(row)
      else if (row.ready) ready.push(row)
      else waiting.push(row)
      if (!isProcessDone(row.process) && !processReady(row.process)) needsResources.push(row)
    }
  }
  const byStart = (a: ProcessWorkRow, b: ProcessWorkRow) => a.process.plannedStart.localeCompare(b.process.plannedStart)
  ready.sort(byStart)
  waiting.sort(byStart)
  needsResources.sort(byStart)
  completed.sort((a, b) => (b.process.actualEnd ?? '').localeCompare(a.process.actualEnd ?? ''))
  return { ready, waiting, completed: completed.slice(0, 30), needsResources }
}

/** A process may only start once its execution resources are allocated. */
export function processReady(process: JobProcess): boolean {
  if (!process.responsiblePersonId) return false
  if (process.requiresMachine && !process.machineId) return false
  return true
}

/** Units that appear in a stage, for screens that must not imply a single owner. */
export function stageUnitsLabel(stage: JobStage, unitName: (id: UnitId) => string): string {
  const ids = stageUnitIds(stage)
  if (!ids.length) return '—'
  if (ids.length === 1) return unitName(ids[0])
  return `${ids.length} units · ${ids.map(unitName).join(', ')}`
}

export const personName = (db: Pick<VertexDB, 'people'>, id: string | null): string | null =>
  id ? (db.people.find((p) => p.id === id)?.name ?? null) : null

export const machineName = (db: Pick<VertexDB, 'machines'>, id: string | null): string | null =>
  id ? (db.machines.find((m) => m.id === id)?.name ?? null) : null
