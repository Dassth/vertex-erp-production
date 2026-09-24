// @vitest-environment node
/* Server storage, permissions, drafts, backups and the HTTP API against a real PostgreSQL engine (PGlite). */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { openPglite } from './storage-pglite'
import type { Database } from './storage'
import { VertexService } from './service'
import { createHttpServer } from './http'
import AdmZip from 'adm-zip'
import { buildArchive, previewRestore, restoreArchive, runBackup, verifyArchive } from './backup'
import { fsBackupStore } from './backup-fs'
import { JEWELLERY_BATCH_ID } from '../src/lib/templates/jewelleryBoxes'
import { toWire, fromWire } from '../src/lib/wire'
import type { VertexDB } from '../src/lib/types'
import { seedMaster } from '../src/test/fixtures'

const PASSWORD = 'disposable-test-pass-1'

let db: Database
let service: VertexService
let dir: string

beforeEach(async () => {
  db = await openPglite()
  service = new VertexService(db)
  await service.ensureState()
  dir = await mkdtemp(join(tmpdir(), 'vertex-server-test-'))
}, 120000)

afterEach(async () => {
  await db?.close()
  if (dir) await rm(dir, { recursive: true, force: true })
}, 60000)

async function signIn(userId: string) {
  const r = await service.createFirstPassword(userId, PASSWORD, PASSWORD)
  if (!r.ok) throw new Error(r.error)
  return r.token
}

describe('server state and permissions', () => {
  it('initialises once and never replaces existing data', async () => {
    const first = await service.state()
    await service.ensureState()
    const again = await service.state()
    expect(again.revision).toBe(first.revision)
    expect(again.db.createdAt).toBe(first.db.createdAt)
  })

  it('verifies passwords on the server and never returns hashes', async () => {
    const token = await signIn('USR-ADM1')
    expect((await service.sessionUser(token))?.id).toBe('USR-ADM1')
    expect((await service.login('USR-ADM1', 'wrong-password-1')).ok).toBe(false)
    const good = await service.login('USR-ADM1', PASSWORD)
    expect(good.ok).toBe(true)
    const r = await service.command(token, 'updateDisplayName', ['Administrator 1'])
    if (!r.ok) throw new Error(r.error)
    for (const u of r.db.users) expect(u.passwordSalt).toBeNull()
    expect(JSON.stringify(r.db)).not.toMatch(/[0-9a-f]{64}/)
    // Password hashes cannot be set through the generic command endpoint.
    const sneaky = await service.command(token, 'setPasswordHash', ['USR-ADM2', 'x', 'y', 'first-time'])
    expect(sneaky.ok).toBe(false)
  })

  it('enforces role permissions server-side and confirms each write with a new revision', async () => {
    const admin1 = await signIn('USR-ADM1')
    const admin2 = await signIn('USR-ADM2')
    const before = (await service.state()).revision

    // Only two accounts exist: Administrator 3 and unit logins were retired.
    expect((await service.createFirstPassword('USR-ADM3', PASSWORD, PASSWORD)).ok).toBe(false)
    expect((await service.createFirstPassword('USR-U1', PASSWORD, PASSWORD)).ok).toBe(false)

    const denied2 = await service.command(admin2, 'importProductTemplates', [JEWELLERY_BATCH_ID])
    const denied2b = await service.command(admin2, 'saveCustomer', [{ code: '', company: 'X', contactPerson: '', phone: '', email: '', billingAddress: 'Y', deliveryAddress: '', gstin: '', placeOfSupply: '', paymentTerms: '', notes: '' }])
    expect(denied2).toMatchObject({ ok: false, status: 403 })
    expect(denied2b).toMatchObject({ ok: false, status: 403 })
    expect((await service.state()).revision).toBe(before)

    const imported = await service.command(admin1, 'importProductTemplates', [JEWELLERY_BATCH_ID])
    if (!imported.ok) throw new Error(imported.error)
    expect((imported.value as { created: unknown[] }).created).toHaveLength(10)
    expect(imported.revision).toBe(before + 1)
    const stored = await service.state()
    expect(stored.revision).toBe(before + 1)
    expect(stored.db.products).toHaveLength(10)

    const again = await service.command(admin1, 'importProductTemplates', [JEWELLERY_BATCH_ID])
    if (!again.ok) throw new Error(again.error)
    expect((again.value as { created: unknown[] }).created).toHaveLength(0)
    expect(again.revision).toBe(before + 1)

    expect(await service.command(undefined, 'importProductTemplates', [JEWELLERY_BATCH_ID])).toMatchObject({ ok: false, status: 401 })
    expect(await service.command(admin1, 'noSuchCommand', [])).toMatchObject({ ok: false, status: 400 })
  })

  it('serialises concurrent writes without losing either one', async () => {
    const token = await signIn('USR-ADM1')
    const base = (await service.state()).revision
    const customer = (company: string) => ({ code: '', company, contactPerson: '', phone: '', email: '', billingAddress: 'Addr', deliveryAddress: '', gstin: '', placeOfSupply: '', paymentTerms: '', notes: '' })
    const results = await Promise.all([service.command(token, 'saveCustomer', [customer('Alpha')]), service.command(token, 'saveCustomer', [customer('Beta')])])
    expect(results.every((r) => r.ok)).toBe(true)
    const s = await service.state()
    expect(s.revision).toBe(base + 2)
    expect(s.db.customers.map((c) => c.company).sort()).toEqual(['Alpha', 'Beta'])
    expect(s.db.customers.map((c) => c.code).sort()).toEqual(['CUS-0001', 'CUS-0002'])
  })

  it('refuses a stale edit instead of overwriting newer data', async () => {
    const token = await signIn('USR-ADM1')
    const r = await service.command(token, 'importProductTemplates', [JEWELLERY_BATCH_ID])
    if (!r.ok) throw new Error(r.error)
    const p = r.db.products[0]
    const draft = { id: p.id, code: p.code, name: p.name, category: p.category, description: 'first', hsn: p.hsn, uom: p.uom, taxPct: p.taxPct, stages: p.stages, materials: p.materials, spec: p.spec, expectedUpdatedAt: p.updatedAt }
    const first = await service.command(token, 'saveProduct', [draft])
    expect(first.ok).toBe(true)
    const stale = await service.command(token, 'saveProduct', [{ ...draft, description: 'second' }])
    expect(stale).toMatchObject({ ok: false, status: 409, conflict: true })
    expect((await service.state()).db.products.find((x) => x.id === p.id)!.description).toBe('first')
  })

  it('stores recoverable drafts per account and refuses an older overwrite', async () => {
    await signIn('USR-ADM1')
    const a = await service.putDraft('USR-ADM1', 'product:new:1', 0, toWire({ name: 'Box', cut: NaN }))
    expect(a).toMatchObject({ ok: true, rev: 1 })
    const b = await service.putDraft('USR-ADM1', 'product:new:1', 1, toWire({ name: 'Box 2' }))
    expect(b).toMatchObject({ ok: true, rev: 2 })
    const stale = await service.putDraft('USR-ADM1', 'product:new:1', 1, toWire({ name: 'old' }))
    expect(stale.ok).toBe(false)
    const got = await service.getDraft('USR-ADM1', 'product:new:1')
    expect(fromWire<{ name: string }>(got!.data).name).toBe('Box 2')
    expect(await service.getDraft('USR-ADM2', 'product:new:1')).toBeNull()
    const first = await service.getDraft('USR-ADM1', 'product:new:1')
    expect(first!.rev).toBe(2)
    await service.putDraft('USR-ADM1', 'raw', 0, toWire({ cut: NaN }))
    expect(Number.isNaN(fromWire<{ cut: number }>((await service.getDraft('USR-ADM1', 'raw'))!.data).cut)).toBe(true)
  })

  it('imports an exported browser dataset only into an empty server, keeping IDs, accounts and counters', async () => {
    const browser = seedMaster().db
    const r = await service.importBrowserDataset(browser, 'test')
    expect(r.ok).toBe(true)
    const s = await service.state()
    expect(s.db.products.map((p) => p.id)).toEqual(browser.products.map((p) => p.id))
    expect(s.db.counters).toEqual(browser.counters)
    expect((await service.importBrowserDataset(browser, 'test')).ok).toBe(false)
  })
})

describe('backups', () => {
  const PASSPHRASE = 'disposable-backup-passphrase'

  async function populated() {
    const token = await signIn('USR-ADM1')
    await service.command(token, 'importProductTemplates', [JEWELLERY_BATCH_ID])
    await service.putDraft('USR-ADM1', 'product:new:x', 0, toWire({ name: 'unsaved', cut: NaN }))
    return token
  }

  it('writes a verified archive with manifest, schema and encrypted credentials, and restores it into a separate database', async () => {
    await populated()
    const store = fsBackupStore(join(dir, 'backups'))
    const { name, manifest } = await runBackup(db, store, { passphrase: PASSPHRASE, keep: 5 })
    expect(name).toMatch(/^vertex-erp-backup-\d{4}-\d{2}-\d{2}-\d{6}Z\.zip$/)
    expect(manifest).toMatchObject({ format: 'vertex-erp-archive', formatVersion: 1, credentials: 'encrypted' })
    expect(manifest.counts).toMatchObject({ products: 10, materials: 13, drafts: 1, usersWithPassword: 1 })
    expect((await store.readStatus()).lastSuccessName).toBe(name)
    expect((await store.list()).map((l) => l.name)).toEqual([name])

    const archive = (await store.get(name))!
    const zip = new AdmZip(Buffer.from(archive))
    expect(zip.getEntries().map((e) => e.entryName).sort()).toEqual(
      ['RESTORE.md', 'config.template.env', 'credentials.enc.json', 'data.json', 'manifest.json', 'migrations/0001_initial.sql', 'migrations/0002_backend_only_access.sql', 'migrations/0003_pbkdf2_function.sql', 'migrations/0004_migrations_table_backend_only.sql'].sort(),
    )
    // No plain credentials or live secrets anywhere in the business data.
    const data = zip.getEntry('data.json')!.getData().toString('utf8')
    expect(data).not.toMatch(/"passwordHash":s*"[0-9a-f]/)
    expect(zip.getEntry('config.template.env')!.getData().toString('utf8')).toMatch(/<password>/)

    // Without the passphrase the archive validates, but a restore needs an explicit choice.
    const noPass = verifyArchive(Buffer.from(archive))
    expect(noPass.ok).toBe(true)
    expect(verifyArchive(Buffer.from(archive), { passphrase: 'wrong' }).ok).toBe(false)

    const check = verifyArchive(Buffer.from(archive), { passphrase: PASSPHRASE })
    if (!check.ok) throw new Error(check.error)
    const target = await openPglite()
    try {
      if (!noPass.ok) throw new Error('unreachable')
      expect((await previewRestore(target, noPass.content)).blockers.join(' ')).toMatch(/passwords are not available/)
      const preview = await previewRestore(target, check.content)
      expect(preview).toMatchObject({ blockers: [], destination: { empty: true } })

      const restored = await restoreArchive(target, check.content)
      expect(restored.revision).toBe(manifest.database.revision)
      expect(restored.counts.products).toBe(10)
      const again = new VertexService(target)
      expect((await again.state()).db.products.map((p) => p.spec?.rawSize)).toContain('2*8.5')
      expect((await again.state()).db.counters).toEqual((await service.state()).db.counters)
      // Same credentials, same drafts (including the half-typed NaN).
      expect((await again.login('USR-ADM1', PASSWORD)).ok).toBe(true)
      expect(Number.isNaN(fromWire<{ cut: number }>((await again.getDraft('USR-ADM1', 'product:new:x'))!.data).cut)).toBe(true)

      // A populated destination is refused unless replacing, which first archives the destination.
      await expect(restoreArchive(target, check.content)).rejects.toThrow(/already holds data/)
      const pre = fsBackupStore(join(dir, 'pre-restore'))
      const replaced = await restoreArchive(target, check.content, { replace: true, preRestoreStore: pre, passphrase: PASSPHRASE })
      expect(replaced.preRestoreBackup).toMatch(/vertex-erp-backup-/)
      expect(await pre.list()).toHaveLength(1)
    } finally {
      await target.close()
    }
  }, 120000)

  it('rejects altered, incomplete and incompatible archives', async () => {
    await populated()
    const { buffer } = await buildArchive(db, { passphrase: PASSPHRASE })

    const altered = new AdmZip(buffer)
    const data = JSON.parse(altered.getEntry('data.json')!.getData().toString('utf8'))
    data.state.products[0].name = 'Tampered'
    altered.updateFile('data.json', Buffer.from(JSON.stringify(data)))
    expect(verifyArchive(altered.toBuffer())).toMatchObject({ ok: false, error: expect.stringMatching(/Checksum mismatch in data.json/) })

    const missing = new AdmZip(buffer)
    missing.deleteFile('migrations/0001_initial.sql')
    expect(verifyArchive(missing.toBuffer())).toMatchObject({ ok: false, error: expect.stringMatching(/missing migrations/) })

    const future = new AdmZip(buffer)
    const manifest = JSON.parse(future.getEntry('manifest.json')!.getData().toString('utf8'))
    future.updateFile('manifest.json', Buffer.from(JSON.stringify({ ...manifest, schemaVersion: 99 })))
    expect(verifyArchive(future.toBuffer())).toMatchObject({ ok: false, error: expect.stringMatching(/schema version 99/) })

    expect(verifyArchive(Buffer.from('not a zip'))).toMatchObject({ ok: false })
  }, 120000)

  it('omits credentials when no passphrase is configured and restores with new-password sign-in only when asked', async () => {
    await populated()
    const { buffer, manifest } = await buildArchive(db)
    expect(manifest.credentials).toBe('omitted')
    const check = verifyArchive(buffer)
    if (!check.ok) throw new Error(check.error)
    expect(check.warnings.join(' ')).toMatch(/no account passwords/)
    const target = await openPglite()
    try {
      await expect(restoreArchive(target, check.content)).rejects.toThrow(/passwords are not available/)
      await restoreArchive(target, check.content, { withoutCredentials: true })
      const again = new VertexService(target)
      expect((await again.createFirstPassword('USR-ADM1', PASSWORD, PASSWORD)).ok).toBe(true)
    } finally {
      await target.close()
    }
  }, 120000)

  it('survives closing and reopening a file-backed database', async () => {
    const dataDir = join(dir, 'pgdata')
    const first = await openPglite(dataDir)
    const s1 = new VertexService(first)
    await s1.ensureState()
    const t = await s1.createFirstPassword('USR-ADM1', PASSWORD, PASSWORD)
    if (!t.ok) throw new Error(t.error)
    await s1.command(t.token, 'importProductTemplates', [JEWELLERY_BATCH_ID])
    await first.close()

    const second = await openPglite(dataDir)
    try {
      const s2 = new VertexService(second)
      expect((await s2.state()).db.products).toHaveLength(10)
      // Sessions are stored server-side too.
      expect((await s2.sessionUser(t.token))?.id).toBe('USR-ADM1')
    } finally {
      await second.close()
    }
  }, 60000)
})

describe('HTTP API', () => {
  let server: Server
  let base: string

  beforeEach(async () => {
    server = createHttpServer(service)
    await new Promise<void>((resolve) => server.listen(0, resolve))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })
  afterEach(() => new Promise<void>((resolve) => server.close(() => resolve())))

  const call = async (path: string, init: { method?: string; body?: unknown; cookie?: string; header?: boolean } = {}) => {
    const res = await fetch(base + path, {
      method: init.method ?? 'GET',
      headers: {
        'content-type': 'application/json',
        ...(init.header === false ? {} : { 'x-vertex-request': '1' }),
        ...(init.cookie ? { cookie: init.cookie } : {}),
      },
      body: init.body === undefined ? undefined : toWire(init.body),
    })
    return { status: res.status, cookie: res.headers.get('set-cookie')?.split(';')[0], json: fromWire<Record<string, unknown>>(await res.text()) }
  }

  it('keeps confirmed records on the server for a client that has lost all browser storage', async () => {
    const accounts = await call('/api/accounts')
    expect((accounts.json.accounts as Array<{ id: string; hasPassword: boolean }>).find((a) => a.id === 'USR-ADM1')!.hasPassword).toBe(false)
    expect(JSON.stringify(accounts.json)).not.toMatch(/passwordHash/)

    const first = await call('/api/auth/first-password', { method: 'POST', body: { userId: 'USR-ADM1', password: PASSWORD, confirm: PASSWORD } })
    expect(first.status).toBe(200)
    expect(first.cookie).toMatch(/^vx_session=/)
    const imported = await call('/api/commands', { method: 'POST', cookie: first.cookie, body: { name: 'importProductTemplates', args: [JEWELLERY_BATCH_ID] } })
    expect(imported.status).toBe(200)

    // A different "browser": no cookie, no local data. It must sign in again and sees the saved records.
    expect((await call('/api/state')).status).toBe(401)
    const login = await call('/api/auth/login', { method: 'POST', body: { userId: 'USR-ADM1', password: PASSWORD } })
    expect(login.status).toBe(200)
    const state = await call('/api/state', { cookie: login.cookie })
    expect(((state.json.db as VertexDB).products).map((p) => p.name)).toContain('Jimmikke Box — 3*4')

    // Mutations without the app header are refused (cross-site request protection).
    expect((await call('/api/commands', { method: 'POST', cookie: login.cookie, header: false, body: { name: 'importProductTemplates', args: [JEWELLERY_BATCH_ID] } })).status).toBe(403)

    // Drafts over HTTP, including a stale overwrite.
    expect((await call('/api/drafts/product%3Anew%3A1', { method: 'PUT', cookie: login.cookie, body: { knownRev: 0, data: { name: 'x', n: NaN } } })).json).toMatchObject({ ok: true, rev: 1 })
    expect((await call('/api/drafts/product%3Anew%3A1', { method: 'PUT', cookie: login.cookie, body: { knownRev: 0, data: { name: 'older' } } })).status).toBe(409)

    // Admin 2 cannot export; logout ends the session.
    const a2 = await call('/api/auth/first-password', { method: 'POST', body: { userId: 'USR-ADM2', password: PASSWORD, confirm: PASSWORD } })
    expect((await call('/api/export', { cookie: a2.cookie })).status).toBe(403)
    await call('/api/auth/logout', { method: 'POST', cookie: login.cookie })
    expect((await call('/api/state', { cookie: login.cookie })).status).toBe(401)
  }, 60000)
})
