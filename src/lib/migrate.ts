/* ---------------------------------------------------------------------------
 * Schema-compatible migration to process-level allocation.
 *
 * Runs on every load (it is idempotent) and never resets or discards data:
 *
 *   • Administrator accounts receive their access tier.
 *   • Product processes gain the "machine required" flag, defaulting to off so
 *     existing manual work keeps running.
 *   • Plans inherit a unit for each PROCESS from the unit their parent STAGE
 *     was assigned to.
 *   • Production orders do the same for every job process, and are marked
 *     `historical`: their per-process progress, operator, machine and timings
 *     were never captured, so the screens say "not recorded" instead of
 *     inventing them. Planned windows are inherited from the parent stage,
 *     which is where they genuinely came from.
 *
 * Costing snapshots, issued invoices, dispatches and audit entries are copied
 * through untouched — confirmed history is never rewritten.
 * ------------------------------------------------------------------------- */

import type { JobProcess, JobStage, Plan, ProductionOrder, UnitId, VertexDB } from './types'
import { seedTierFor } from './permissions'
import { RETIRED_USER_IDS } from './defaults'

export const MIGRATION_PROCESS_ALLOCATION = 'process-level-allocation-v1'
export const MIGRATION_ADMIN_ONLY_ACCOUNTS = 'admin-only-accounts-v1'

/** A process record written before allocation moved to process level. */
type LegacyProcess = Partial<JobProcess> & Pick<JobProcess, 'id' | 'processDefId' | 'name'>

function migrateProcess(
  raw: LegacyProcess,
  stage: JobStage,
  index: number,
  fallbackUnit: UnitId,
): JobProcess {
  if (raw.stageId && raw.unitId && raw.status) return raw as JobProcess
  const done = raw.done ?? false
  return {
    id: raw.id,
    processDefId: raw.processDefId,
    stageId: stage.id,
    stageDefId: stage.stageDefId,
    stageName: stage.name,
    name: raw.name,
    index: raw.index ?? index,
    unitId: raw.unitId ?? fallbackUnit,
    status: raw.status ?? (done ? 'Completed' : stage.status === 'Blocked' ? 'Blocked' : 'Scheduled'),
    durationHours: raw.durationHours ?? 0,
    // The stage's own planned window is the only timing these records ever had.
    plannedStart: raw.plannedStart ?? stage.plannedStart,
    plannedEnd: raw.plannedEnd ?? stage.plannedEnd,
    actualStart: raw.actualStart,
    actualEnd: raw.actualEnd ?? raw.doneAt ?? undefined,
    responsiblePersonId: raw.responsiblePersonId ?? null,
    machineId: raw.machineId ?? null,
    requiresMachine: raw.requiresMachine ?? false,
    noMachineRequired: raw.noMachineRequired ?? false,
    updatedBy: raw.updatedBy,
    updatedAt: raw.updatedAt,
    note: raw.note,
    problem: raw.problem,
    done,
    doneAt: raw.doneAt ?? null,
    doneBy: raw.doneBy ?? null,
    historical: true,
  }
}

function migrateOrder(order: ProductionOrder): ProductionOrder {
  let touched = false
  const stages = order.stages.map((stage) => {
    const fallbackUnit = stage.unitId ?? stage.processes[0]?.unitId ?? ''
    const processes = stage.processes.map((p, i) => {
      const migrated = migrateProcess(p as LegacyProcess, stage, i, fallbackUnit)
      if (migrated !== p) touched = true
      return migrated
    })
    return touched ? { ...stage, processes } : stage
  })
  return touched ? { ...order, stages } : order
}

function migratePlan(plan: Plan, db: VertexDB): Plan {
  if (plan.processUnits && Object.keys(plan.processUnits).length) return plan
  const product = db.products.find((p) => p.id === plan.productId)
  const processUnits: Record<string, UnitId> = {}
  const stageUnits = plan.stageUnits ?? {}
  if (product) {
    for (const stage of product.stages) {
      const unitId = stageUnits[stage.id]
      if (!unitId) continue
      for (const process of stage.processes) processUnits[process.id] = unitId
    }
  }
  return { ...plan, processUnits }
}

export function migrateToProcessAllocation(db: VertexDB): VertexDB {
  const users = db.users.map((u) => (u.adminTier || u.role !== 'admin' ? u : { ...u, adminTier: seedTierFor(u.id, u.role) }))
  const products = db.products.map((product) => ({
    ...product,
    stages: product.stages.map((stage) => ({
      ...stage,
      processes: stage.processes.map((p) => (typeof p.requiresMachine === 'boolean' ? p : { ...p, requiresMachine: false })),
    })),
  }))
  const withProducts = { ...db, users, products }
  return {
    ...withProducts,
    plans: withProducts.plans.map((plan) => migratePlan(plan, withProducts)),
    orders: withProducts.orders.map(migrateOrder),
    migrations: db.migrations.includes(MIGRATION_PROCESS_ALLOCATION)
      ? db.migrations
      : [...db.migrations, MIGRATION_PROCESS_ALLOCATION],
  }
}

/**
 * Units no longer sign in and there is no Administrator 3: those accounts are
 * removed. Their names stay on every audit entry and process they touched;
 * only the ability to sign in as them goes. Idempotent.
 */
export function retireUnitAccounts(db: VertexDB): VertexDB {
  const users = db.users.filter((u) => u.role === 'admin' && !RETIRED_USER_IDS.has(u.id))
  if (users.length === db.users.length && db.migrations.includes(MIGRATION_ADMIN_ONLY_ACCOUNTS)) return db
  return {
    ...db,
    users,
    migrations: db.migrations.includes(MIGRATION_ADMIN_ONLY_ACCOUNTS) ? db.migrations : [...db.migrations, MIGRATION_ADMIN_ONLY_ACCOUNTS],
  }
}
