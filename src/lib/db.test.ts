import { describe, expect, it } from 'vitest'
import { DB_KEY, LEGACY_DB_KEY, MIGRATION_PURGE_DEMO, loadDB, saveDB } from './db'
import type { StorageLike } from './db'
import { NOW, seedMaster } from '../test/fixtures'

function memory(initial: Record<string, string> = {}): StorageLike & { map: Map<string, string> } {
  const map = new Map(Object.entries(initial))
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  }
}

const legacyDemo = JSON.stringify({ version: 1, products: [{}, {}], materials: [{}], customers: [{}, {}, {}], costings: [{}], orders: [{}, {}], manualTasks: [{}] })

describe('persistence migration', () => {
  it('starts empty on a fresh browser', () => {
    const s = memory()
    const { db, event } = loadDB(s, NOW)
    expect(event).toBe('created')
    expect(db.products).toHaveLength(0)
    expect(db.customers).toHaveLength(0)
    expect(db.users.filter((u) => u.role === 'admin')).toHaveLength(3)
    expect(db.users.every((u) => u.passwordHash === null)).toBe(true)
    expect(s.map.has(DB_KEY)).toBe(true)
  })

  it('purges the legacy demo store exactly once', () => {
    const s = memory({ [LEGACY_DB_KEY]: legacyDemo, 'vertex-erp-session-v1': 'USR-OWN' })
    const first = loadDB(s, NOW)
    expect(first.event).toBe('migrated-legacy-demo')
    expect(first.db.orders).toHaveLength(0)
    expect(first.db.migrations).toContain(MIGRATION_PURGE_DEMO)
    expect(first.db.audit[0].action).toBe('Legacy demo data removed')
    expect(first.db.audit[0].newValue).toMatch(/2 products.*2 production orders/)
    expect(s.map.has(LEGACY_DB_KEY)).toBe(false)
    expect(s.map.has('vertex-erp-session-v1')).toBe(false)

    // New records entered after the migration survive every later load.
    const { db: withData } = seedMaster(first.db)
    saveDB(withData, s)
    const second = loadDB(s, NOW)
    expect(second.event).toBe('loaded')
    expect(second.db.products).toHaveLength(1)
    expect(second.db.materials).toHaveLength(2)
  })

  it('never purges a v2 database even if a legacy key reappears', () => {
    const s = memory()
    const { db } = seedMaster(loadDB(s, NOW).db)
    saveDB(db, s)
    s.setItem(LEGACY_DB_KEY, legacyDemo)
    const again = loadDB(s, NOW)
    expect(again.event).toBe('loaded')
    expect(again.db.products).toHaveLength(1)
    expect(s.map.has(LEGACY_DB_KEY)).toBe(false)
  })

  it('keeps a backup of an unreadable database instead of discarding it', () => {
    const s = memory({ [DB_KEY]: '{not json' })
    const { event, db } = loadDB(s, NOW)
    expect(event).toBe('recovered-unreadable')
    expect(db.products).toHaveLength(0)
    const backup = [...s.map.keys()].find((k) => k.startsWith(`${DB_KEY}-unreadable-`))
    expect(backup).toBeDefined()
    expect(s.map.get(backup!)).toBe('{not json')
  })
})
