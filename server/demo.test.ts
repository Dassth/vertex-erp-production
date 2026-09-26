import { describe, expect, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { openPglite } from './storage-pglite'
import { readState, writeState } from './storage'
import { VertexService } from './service'
import { buildArchive, restoreArchive, verifyArchive } from './backup'
import { buildDemoDB } from './demo'

/* The demo backup must import cleanly into a fresh installed copy and show
   the same data. With DEMO_BACKUP_OUT set, the archive is also written there. */

describe('demo data backup', () => {
  it('builds through the app’s own commands and restores exactly', async () => {
    const today = new Date()
    const demo = buildDemoDB(today)
    expect(demo.products).toHaveLength(3)
    expect(demo.customers).toHaveLength(3)
    expect(demo.orders).toHaveLength(3)
    expect(demo.dispatches).toHaveLength(3)
    expect(demo.invoices).toHaveLength(3)
    expect(demo.orders.map((o) => o.status).sort()).toEqual(['Active', 'Completed', 'Completed'])

    const source = await openPglite()
    const target = await openPglite()
    try {
      await new VertexService(source).ensureState()
      const base = await readState(source)
      // Keep the accounts of the fresh database; everything else is the demo business.
      await writeState(source, { revision: (base?.revision ?? 0) + 1, data: { ...demo, users: base!.data.users }, actor: 'demo', command: 'demoData', at: today })
      const { buffer, manifest } = await buildArchive(source, { now: today, appVersion: 'vertex-erp@demo' })
      const check = verifyArchive(buffer)
      expect(check.ok).toBe(true)
      if (!check.ok) return

      // A fresh install that has never started: the import is its first data.
      await restoreArchive(target, check.content, { replace: true, withoutCredentials: true })
      const restored = (await readState(target))!.data
      expect(restored.invoices.map((i) => i.number)).toEqual(demo.invoices.map((i) => i.number))
      expect(restored.cashbook).toHaveLength(demo.cashbook.length)
      expect(manifest.counts.orders).toBe(3)

      if (process.env.DEMO_BACKUP_OUT) writeFileSync(process.env.DEMO_BACKUP_OUT, buffer)
    } finally {
      await source.close()
      await target.close()
    }
  }, 120_000)
})
