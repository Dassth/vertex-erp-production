import { describe, expect, it } from 'vitest'
import { generateKeyPairSync } from 'node:crypto'
import { LicenceGuard, decodeSigned, evaluate } from './licence'
import type { LicenceStore } from './licence'
import worker, { answerFor, signAnswer } from '../licence/worker'
import type { Env, LicenceRecord } from '../licence/worker'

/* The licence: signed answers from Back Moon Devs lock or unlock an installed
   copy; nothing else may. */

const keys = generateKeyPairSync('ed25519')
const PUBLIC = keys.publicKey.export({ format: 'der', type: 'spki' }).toString('base64')
const PRIVATE = keys.privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64')
const other = generateKeyPairSync('ed25519').privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64')

const DAY = 86_400_000
const T0 = Date.parse('2026-09-26T10:00:00Z')

function memoryKV(): Env['LICENCES'] & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    get: async (k) => data.get(k) ?? null,
    put: async (k, v) => void data.set(k, v),
    list: async ({ prefix }) => ({ keys: [...data.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })) }),
  }
}

function service() {
  const kv = memoryKV()
  const env: Env = { LICENCES: kv, LICENCE_SIGNING_KEY: PRIVATE, ADMIN_KEY: 'test-admin-key-0123456789' }
  const call = (path: string, init: RequestInit = {}) => worker.fetch(new Request(`https://licence.test${path}`, init), env)
  const admin = (body: Partial<LicenceRecord>, key = env.ADMIN_KEY) =>
    call('/admin/api/licences', { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify(body) })
  return { env, kv, call, admin }
}

function memoryStore(): LicenceStore & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return { data, get: async (k) => data.get(k) ?? null, set: async (k, v) => void data.set(k, v) }
}

function guard(svc: ReturnType<typeof service> | null, store = memoryStore(), clock = { now: T0 }) {
  const fetcher: typeof fetch = async (input, init) => {
    if (!svc) throw new TypeError('fetch failed')
    return svc.call(new URL(String(input)).pathname, init)
  }
  return { g: new LicenceGuard({ licenceId: 'VPP-2026-01', endpoint: 'https://licence.test', publicKey: PUBLIC, fetch: fetcher, now: () => clock.now }, store), store, clock }
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

  it('decide the lock: active, suspended, deactivated, unknown, expired and clock moved back', () => {
    const p = (status: string, validUntil = new Date(T0 + 7 * DAY).toISOString()) =>
      ({ licenceId: 'X-1', status, message: '', customer: 'C', issuedAt: new Date(T0).toISOString(), validUntil }) as Parameters<typeof evaluate>[1]
    expect(evaluate('X-1', p('active'), T0, T0).active).toBe(true)
    expect(evaluate('X-1', p('suspended'), T0, T0).reason).toBe('suspended')
    expect(evaluate('X-1', p('deactivated'), T0, T0).reason).toBe('deactivated')
    expect(evaluate('X-1', p('unknown'), T0, T0).reason).toBe('unknown')
    expect(evaluate('X-1', null, T0, 0).reason).toBe('unverified')
    expect(evaluate('Y-2', p('active'), T0, T0).reason).toBe('unverified')
    expect(evaluate('X-1', p('active'), T0 + 8 * DAY, T0).reason).toBe('expired')
    expect(evaluate('X-1', p('active'), T0 - 2 * DAY, T0).reason).toBe('clock')
  })
})

describe('an installed copy', () => {
  it('stays locked until activated, then works, and locks again when suspended', async () => {
    const svc = service()
    const { g } = guard(svc)
    expect((await g.check()).reason).toBe('unknown')

    expect((await (await svc.admin({ licenceId: 'VPP-2026-01', customer: 'Vertex Print Pack', status: 'active' })).json()).ok).toBe(true)
    const on = await g.check()
    expect(on).toMatchObject({ active: true, customer: 'Vertex Print Pack', lastError: null })

    await svc.admin({ licenceId: 'VPP-2026-01', status: 'suspended', message: 'Payment pending — call 8940095659' })
    expect(await g.check()).toMatchObject({ active: false, reason: 'suspended', message: 'Payment pending — call 8940095659' })

    await svc.admin({ licenceId: 'VPP-2026-01', status: 'active', message: '' })
    expect((await g.check()).active).toBe(true)
    // The service records every call made after the licence existed.
    expect(JSON.parse(svc.kv.data.get('seen:VPP-2026-01')!)).toMatchObject({ checks: 3 })
    expect(JSON.parse(svc.kv.data.get('lic:VPP-2026-01')!)).toMatchObject({ status: 'active' })
    // A copy calling in never writes the licence itself, so it cannot put back an older status.
    expect(JSON.parse(svc.kv.data.get('lic:VPP-2026-01')!).checks).toBeUndefined()
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

  it('notices the clock being turned back to stretch the grace', async () => {
    const svc = service()
    await svc.admin({ licenceId: 'VPP-2026-01', status: 'active' })
    const { g, store, clock } = guard(svc)
    await g.check()
    clock.now = T0 + 6 * DAY
    expect((await g.state()).active).toBe(true)
    clock.now = T0 + 1 * DAY
    const back = await guard(null, store, clock).g.state()
    expect(back.reason).toBe('clock')
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
