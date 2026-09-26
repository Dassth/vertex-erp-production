import { describe, expect, it } from 'vitest'
import { generateKeyPairSync } from 'node:crypto'
import { LicenceGuard, decodeSigned, evaluate } from './licence'
import type { LicenceStore } from './licence'
import { answerFor, handle, signAnswer } from '../licence/worker'
import { createApiHandler } from './api'
import type { VertexService } from './service'
import type { LicenceRecord, LicenceStore as ServiceStore } from '../licence/worker'

/* The licence: signed answers from Back Moon Devs lock or unlock an installed
   copy; nothing else may. */

const keys = generateKeyPairSync('ed25519')
const PUBLIC = keys.publicKey.export({ format: 'der', type: 'spki' }).toString('base64')
const PRIVATE = keys.privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64')
const other = generateKeyPairSync('ed25519').privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64')

const DAY = 86_400_000
const T0 = Date.parse('2026-09-26T10:00:00Z')

/** The licence service's tables, in memory. */
function memoryService(): ServiceStore & { licences: Map<string, string>; seen: Map<string, string> } {
  const licences = new Map<string, string>()
  const seen = new Map<string, string>()
  return {
    licences,
    seen,
    get: async (id) => (licences.has(id) ? JSON.parse(licences.get(id)!) : null),
    put: async (rec) => void licences.set(rec.licenceId, JSON.stringify(rec)),
    list: async () => [...licences.values()].map((v) => JSON.parse(v)),
    getSeen: async (id) => (seen.has(id) ? JSON.parse(seen.get(id)!) : null),
    putSeen: async (id, v) => void seen.set(id, JSON.stringify(v)),
  }
}

function service() {
  const store = memoryService()
  const env = { LICENCE_SIGNING_KEY: PRIVATE, ADMIN_KEY: 'test-admin-key-0123456789' }
  const call = (path: string, init: RequestInit = {}) => handle(new Request(`https://licence.test${path}`, init), env, store)
  const admin = (body: Partial<LicenceRecord>, key = env.ADMIN_KEY) =>
    call('/admin/api/licences', { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify(body) })
  return { env, store, call, admin }
}

function memoryStore(): LicenceStore & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return { data, get: async (k) => data.get(k) ?? null, set: async (k, v) => void data.set(k, v) }
}

function guard(svc: ReturnType<typeof service> | null, store = memoryStore(), clock = { now: T0 }) {
  let calls = 0
  const fetcher: typeof fetch = async (input, init) => {
    calls++
    if (!svc) throw new TypeError('fetch failed')
    return svc.call(new URL(String(input)).pathname, init)
  }
  const g = new LicenceGuard({ licenceId: 'VPP-2026-01', endpoint: 'https://licence.test', publicKey: PUBLIC, fetch: fetcher, now: () => clock.now }, store)
  return { g, store, clock, calls: () => calls }
}

describe('signed answers', () => {
  it('are accepted only when signed with the Back Moon Devs key', async () => {
    const payload = answerFor(null, 'VPP-2026-01', new Date(T0))
    const good = await signAnswer(PRIVATE, payload)
    expect(decodeSigned(good, PUBLIC)).toMatchObject({ licenceId: 'VPP-2026-01', status: 'unknown' })
    expect(decodeSigned(await signAnswer(other, payload), PUBLIC)).toBeNull()
    // Editing the answer — say, "suspended" to "active" — breaks the signature.
    const forged = Buffer.from(JSON.stringify({ ...payload, status: 'active' })).toString('base64url')
    expect(decodeSigned({ payload: forged, signature: good.signature }, PUBLIC)).toBeNull()
  })

  it('decide the lock: suspended is view-only, everything else that is not active locks', () => {
    const p = (status: string, over: object = {}) =>
      ({ licenceId: 'X-1', status, message: '', customer: 'C', issuedAt: new Date(T0).toISOString(), validUntil: new Date(T0 + 7 * DAY).toISOString(), ...over }) as Parameters<typeof evaluate>[1]
    expect(evaluate('X-1', p('active'), T0, T0)).toMatchObject({ active: true, mode: 'open' })
    expect(evaluate('X-1', p('suspended'), T0, T0)).toMatchObject({ active: false, mode: 'view-only', reason: 'suspended' })
    expect(evaluate('X-1', p('suspended'), T0, T0).message).toMatch(/until the payment is made.*89400 95659/)
    expect(evaluate('X-1', p('deactivated'), T0, T0)).toMatchObject({ mode: 'locked', reason: 'deactivated' })
    expect(evaluate('X-1', p('unknown'), T0, T0).reason).toBe('unknown')
    expect(evaluate('X-1', null, T0, 0).reason).toBe('unverified')
    expect(evaluate('Y-2', p('active'), T0, T0).reason).toBe('unverified')
    expect(evaluate('X-1', p('active'), T0 + 8 * DAY, T0).reason).toBe('expired')
    expect(evaluate('X-1', p('active'), T0 - 2 * DAY, T0).reason).toBe('clock')
  })

  it('treat a lifetime licence as open for good, whatever the clock says, until it is suspended', () => {
    const life = { licenceId: 'X-1', status: 'active', permanent: true, message: '', customer: 'C', issuedAt: new Date(T0).toISOString(), validUntil: new Date(T0 + 7 * DAY).toISOString() } as Parameters<typeof evaluate>[1]
    expect(evaluate('X-1', life, T0 + 5000 * DAY, T0)).toMatchObject({ active: true, permanent: true })
    expect(evaluate('X-1', life, T0 - 30 * DAY, T0).active).toBe(true)
    expect(evaluate('X-1', { ...life!, status: 'suspended' }, T0, T0)).toMatchObject({ mode: 'view-only', permanent: false })
  })
})

describe('an installed copy', () => {
  it('stays locked until activated, then works, and turns view-only when suspended', async () => {
    const svc = service()
    const { g } = guard(svc)
    expect((await g.check()).reason).toBe('unknown')

    expect((await (await svc.admin({ licenceId: 'VPP-2026-01', customer: 'Vertex Print Pack', status: 'active' })).json()).ok).toBe(true)
    expect(await g.check()).toMatchObject({ active: true, mode: 'open', customer: 'Vertex Print Pack', lastError: null })

    await svc.admin({ licenceId: 'VPP-2026-01', status: 'suspended', message: 'Payment pending — call 89400 95659' })
    expect(await g.check()).toMatchObject({ active: false, mode: 'view-only', reason: 'suspended', message: 'Payment pending — call 89400 95659' })

    await svc.admin({ licenceId: 'VPP-2026-01', status: 'active', message: '' })
    expect((await g.check()).active).toBe(true)
    // A copy calling in never writes the licence itself, so it cannot put back an older status.
    expect(JSON.parse(svc.store.licences.get('VPP-2026-01')!)).toMatchObject({ status: 'active' })
    expect(JSON.parse(svc.store.licences.get('VPP-2026-01')!).checks).toBeUndefined()
    expect(JSON.parse(svc.store.seen.get('VPP-2026-01')!)).toMatchObject({ checks: 1 })
  })

  it('works offline on its last answer for the grace days, then asks for internet', async () => {
    const svc = service()
    await svc.admin({ licenceId: 'VPP-2026-01', status: 'active', graceDays: 7 })
    const { g, store, clock } = guard(svc)
    expect((await g.check()).active).toBe(true)

    // Internet gone; a restart reads the saved answer from the database.
    const offline = guard(null, store, clock).g
    clock.now = T0 + 6 * DAY
    const still = await offline.check()
    expect(still.active).toBe(true)
    expect(still.lastError).toMatch(/fetch failed/)
    clock.now = T0 + 8 * DAY
    expect((await offline.state()).reason).toBe('expired')
  })

  it('once activated for lifetime, works offline for years — and a later suspension still reaches it when online', async () => {
    const svc = service()
    await svc.admin({ licenceId: 'VPP-2026-01', status: 'active', permanent: true })
    const { g, store, clock } = guard(svc)
    expect(await g.check()).toMatchObject({ active: true, permanent: true })
    clock.now = T0 + 3 * 365 * DAY
    expect((await guard(null, store, clock).g.state()).active).toBe(true)

    await svc.admin({ licenceId: 'VPP-2026-01', status: 'suspended' })
    expect(await guard(svc, store, clock).g.check()).toMatchObject({ mode: 'view-only', reason: 'suspended' })
  })

  it('notices the clock being turned back to stretch the grace', async () => {
    const svc = service()
    await svc.admin({ licenceId: 'VPP-2026-01', status: 'active' })
    const { g, store, clock } = guard(svc)
    await g.check()
    clock.now = T0 + 6 * DAY
    expect((await g.state()).active).toBe(true)
    clock.now = T0 + 1 * DAY
    expect((await guard(null, store, clock).g.state()).reason).toBe('clock')
  })

  it('asks again on activity, at most once per interval', async () => {
    const svc = service()
    await svc.admin({ licenceId: 'VPP-2026-01', status: 'active' })
    const { g, clock, calls } = guard(svc)
    await g.refreshIfStale(30_000, 4_000)
    await g.refreshIfStale(30_000, 4_000)
    expect(calls()).toBe(1)
    await svc.admin({ licenceId: 'VPP-2026-01', status: 'suspended' })
    clock.now += 31_000
    await g.refreshIfStale(30_000, 4_000)
    expect(calls()).toBe(2)
    expect((await g.state()).mode).toBe('view-only')
  })

  it('reaches a signed-in window within seconds of a suspension, however long ago the last check was', async () => {
    const svc = service()
    await svc.admin({ licenceId: 'VPP-2026-01', status: 'active' })
    const { g, clock, calls } = guard(svc)
    const api = createApiHandler({} as VertexService, { licence: g })
    const poll = async () => (await api(new Request('http://localhost/api/licence'))).json()
    expect(await poll()).toMatchObject({ active: true })
    // Suspended while someone is signed in; the window asks again 10 s later.
    await svc.admin({ licenceId: 'VPP-2026-01', status: 'suspended', message: 'Payment pending' })
    clock.now += 10_000
    expect(await poll()).toMatchObject({ active: false, mode: 'view-only', message: 'Payment pending' })
    // Two windows polling together still make one online check.
    const before = calls()
    await Promise.all([poll(), poll()])
    expect(calls()).toBe(before)
  })

  it('refuses an answer that was not signed by Back Moon Devs', async () => {
    const svc = service()
    svc.env.LICENCE_SIGNING_KEY = other
    await svc.admin({ licenceId: 'VPP-2026-01', status: 'active' })
    const s = await guard(svc).g.check()
    expect(s.active).toBe(false)
    expect(s.lastError).toMatch(/not signed by Back Moon Devs/)
  })
})

describe('the control page API', () => {
  it('needs the admin key and validates what it saves', async () => {
    const svc = service()
    expect((await svc.admin({ licenceId: 'VPP-2026-01' }, 'wrong')).status).toBe(401)
    expect((await svc.call('/admin/api/licences')).status).toBe(401)
    expect((await svc.admin({ licenceId: 'bad id!' })).status).toBe(400)
    expect((await svc.admin({ licenceId: 'VPP-2026-01', status: 'paused' as never })).status).toBe(400)
    const list = await (await svc.call('/admin/api/licences', { headers: { authorization: `Bearer ${svc.env.ADMIN_KEY}` } })).json()
    expect(list).toEqual({ ok: true, licences: [] })
    expect((await svc.call('/admin')).headers.get('content-type')).toMatch(/text\/html/)
  })
})
