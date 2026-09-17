/* ---------------------------------------------------------------------------
 * Browser persistence (localStorage) with a one-time legacy demo purge.
 *
 * LIMITATION: data lives in this browser profile only. It is not shared between
 * devices or browsers, has no server-side backup, and is limited by the
 * browser's storage quota. Two tabs of the same browser stay in step through
 * the `storage` event; separate computers do not.
 *
 * MIGRATION (runs once):
 *   • A schema-v2 database under DB_KEY is always loaded as-is and is NEVER
 *     reset on reload or sign-in.
 *   • If no v2 database exists but the legacy v1 key does, that legacy store is
 *     the old auto-seeded demo dataset. It is removed and replaced with an empty
 *     v2 database; the purge is recorded in the audit log and in `migrations`.
 *   • If neither exists, an empty v2 database is created.
 *   • An unreadable v2 database is copied to a backup key before a fresh one is
 *     created, so nothing is silently discarded.
 * ------------------------------------------------------------------------- */

import type { AuditEntry, VertexDB } from './types'
import { DB_VERSION, DEFAULT_USERS, buildEmptyDB, defaultCompany, defaultSettings, emptyCounters } from './defaults'
import { migrateToProcessAllocation } from './migrate'

export const DB_KEY = 'vertex-erp-db-v2'
export const LEGACY_DB_KEY = 'vertex-erp-db-v1'
export const LEGACY_EXTRA_KEYS = ['vertex-erp-session-v1', 'vertex-erp-tour-seen-v1']
export const MIGRATION_PURGE_DEMO = 'purge-legacy-demo-v1'
const SESSION_KEY = 'vertex-erp-session-v2'

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type LoadEvent = 'loaded' | 'created' | 'migrated-legacy-demo' | 'recovered-unreadable'

export interface LoadOutcome {
  db: VertexDB
  event: LoadEvent
}

function systemAudit(now: Date, action: string, label: string, detail?: string): AuditEntry {
  return {
    id: `aud-${now.getTime().toString(36)}-sys`,
    at: now.toISOString(),
    userId: 'system',
    user: 'System',
    role: 'system',
    action,
    entity: 'System',
    entityId: 'database',
    entityLabel: label,
    newValue: detail,
  }
}

function isV2(value: unknown): value is VertexDB {
  const v = value as Partial<VertexDB> | null
  return (
    !!v &&
    v.version === DB_VERSION &&
    Array.isArray(v.products) &&
    Array.isArray(v.materials) &&
    Array.isArray(v.orders) &&
    Array.isArray(v.users)
  )
}

/** Fill anything a slightly older v2 build did not write. Never removes data. */
export function normalizeDB(db: VertexDB): VertexDB {
  const users = [...db.users]
  for (const u of DEFAULT_USERS) if (!users.some((x) => x.id === u.id)) users.push({ ...u })
  const filled: VertexDB = {
    ...buildEmptyDB(new Date(db.createdAt || Date.now())),
    ...db,
    company: { ...defaultCompany(), ...db.company },
    settings: { ...defaultSettings(), ...db.settings },
    counters: { ...emptyCounters(), ...db.counters },
    migrations: db.migrations ?? [],
    users,
  }
  // Idempotent: stage-level allocation becomes process-level allocation.
  return migrateToProcessAllocation(filled)
}

function describeLegacy(raw: string): string {
  try {
    const legacy = JSON.parse(raw) as Record<string, unknown>
    const count = (k: string) => (Array.isArray(legacy[k]) ? (legacy[k] as unknown[]).length : 0)
    return `Removed ${count('products')} products, ${count('materials')} materials, ${count('customers')} customers, ${count('costings')} costings, ${count('orders')} production orders and ${count('manualTasks')} planner tasks from the legacy demo store.`
  } catch {
    return 'Removed an unreadable legacy demo store.'
  }
}

export function loadDB(storage: StorageLike, now: Date = new Date()): LoadOutcome {
  const raw = safeGet(storage, DB_KEY)

  if (raw !== null) {
    let parsed: unknown = null
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = null
    }
    if (isV2(parsed)) {
      // A stray legacy key must never trigger a purge once v2 exists.
      if (safeGet(storage, LEGACY_DB_KEY) !== null) safeRemove(storage, LEGACY_DB_KEY)
      return { db: normalizeDB(parsed), event: 'loaded' }
    }
    const backupKey = `${DB_KEY}-unreadable-${now.getTime()}`
    try {
      storage.setItem(backupKey, raw)
    } catch {
      /* quota — the original key is left untouched below only if backup failed */
      return { db: buildEmptyDB(now), event: 'recovered-unreadable' }
    }
    const fresh = buildEmptyDB(now)
    fresh.migrations = [MIGRATION_PURGE_DEMO]
    fresh.audit = [systemAudit(now, 'Unreadable database preserved', 'Local database', `Previous data copied to ${backupKey}.`)]
    saveDB(fresh, storage)
    return { db: fresh, event: 'recovered-unreadable' }
  }

  const legacy = safeGet(storage, LEGACY_DB_KEY)
  const fresh = buildEmptyDB(now)
  fresh.migrations = [MIGRATION_PURGE_DEMO]
  if (legacy !== null) {
    fresh.audit = [systemAudit(now, 'Legacy demo data removed', 'Schema v1 → v2 migration', describeLegacy(legacy))]
    saveDB(fresh, storage)
    safeRemove(storage, LEGACY_DB_KEY)
    for (const k of LEGACY_EXTRA_KEYS) safeRemove(storage, k)
    return { db: fresh, event: 'migrated-legacy-demo' }
  }
  saveDB(fresh, storage)
  return { db: fresh, event: 'created' }
}

export function saveDB(db: VertexDB, storage: StorageLike): boolean {
  try {
    storage.setItem(DB_KEY, JSON.stringify(db))
    return true
  } catch {
    return false
  }
}

export function parseStoredDB(raw: string | null): VertexDB | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return isV2(parsed) ? normalizeDB(parsed) : null
  } catch {
    return null
  }
}

function safeGet(storage: StorageLike, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function safeRemove(storage: StorageLike, key: string) {
  try {
    storage.removeItem(key)
  } catch {
    /* ignore */
  }
}

/* Sessions are per tab, so an admin and a unit user can work side by side in
   two tabs of the same browser. */
export function loadSession(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

export function saveSession(userId: string | null): void {
  try {
    if (userId) sessionStorage.setItem(SESSION_KEY, userId)
    else sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}
