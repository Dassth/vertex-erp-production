/* ---------------------------------------------------------------------------
 * Licence — the one thing an installed copy asks the internet about.
 *
 * Back Moon Devs keeps each customer's licence (active / suspended /
 * deactivated) on the licence service (licence/worker.ts). The installed server
 * asks it every 30 minutes and keeps the latest SIGNED answer in its own
 * database, so the copy keeps working without internet until that answer's
 * `validUntil` (the offline grace, 7 days by default).
 *
 * The answer is signed with Back Moon Devs' Ed25519 key; this file holds only
 * the public half, so a copied, edited or invented answer is refused. Turning
 * the system clock back is caught too: the latest time ever seen is stored.
 *
 * When the licence is not active every API call except the licence check is
 * refused with 423 Locked. Nothing is deleted — data and backups stay intact,
 * and the copy unlocks as soon as the licence is active again.
 * ------------------------------------------------------------------------- */

import { createPublicKey, verify } from 'node:crypto'
import type { Queryable } from './storage'

/** Back Moon Devs licence signing key (public half, SPKI DER, base64). */
export const LICENCE_PUBLIC_KEY = 'MCowBQYDK2VwAyEAbqZp2oBphuRx1Mr8vjtEwedjcrNTcBLdP2tIqlUXOAA='

export type LicenceStatus = 'active' | 'suspended' | 'deactivated' | 'unknown'

/** What the licence service signs. */
export interface LicencePayload {
  licenceId: string
  status: LicenceStatus
  /** Shown on the lock screen. */
  message: string
  customer: string
  /** Service time the answer was made. */
  issuedAt: string
  /** The answer may be relied on offline until then. */
  validUntil: string
}

export interface SignedLicence {
  payload: string
  signature: string
}

export type LockReason = 'unverified' | 'suspended' | 'deactivated' | 'unknown' | 'expired' | 'clock'

export interface LicenceState {
  active: boolean
  licenceId: string
  customer: string
  reason: LockReason | null
  message: string
  /** Last successful answer from the licence service. */
  checkedAt: string | null
  validUntil: string | null
  /** Why the last check failed, when it did (usually: no internet). */
  lastError: string | null
}

/** Where the guard keeps the latest signed answer and the latest time seen. */
export interface LicenceStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
}

const TOKEN_KEY = 'licence.token'
const CLOCK_KEY = 'licence.clock'
/** How far the clock may appear to go back (time zones, small corrections) before it counts as tampering. */
const CLOCK_SLACK_MS = 12 * 60 * 60 * 1000

export function decodeSigned(signed: SignedLicence, publicKey = LICENCE_PUBLIC_KEY): LicencePayload | null {
  try {
    const key = createPublicKey({ key: Buffer.from(publicKey, 'base64'), format: 'der', type: 'spki' })
    const ok = verify(null, Buffer.from(signed.payload, 'utf8'), key, Buffer.from(signed.signature, 'base64url'))
    if (!ok) return null
    const p = JSON.parse(Buffer.from(signed.payload, 'base64url').toString('utf8')) as LicencePayload
    if (typeof p.licenceId !== 'string' || typeof p.status !== 'string' || typeof p.validUntil !== 'string') return null
    return p
  } catch {
    return null
  }
}

const LOCK_TEXT: Record<LockReason, string> = {
  unverified: 'This copy of Vertex ERP has not been activated yet. Connect this computer to the internet once and press “Check again”.',
  suspended: 'Vertex ERP is suspended. Please contact Back Moon Devs.',
  deactivated: 'This copy of Vertex ERP has been deactivated. Please contact Back Moon Devs.',
  unknown: 'This licence is not recognised. Please contact Back Moon Devs.',
  expired: 'Vertex ERP could not confirm its licence for too long. Connect this computer to the internet and press “Check again”.',
  clock: 'The computer’s date and time were moved back. Correct the date and time, then press “Check again”.',
}

/** The lock decision, from the latest signed answer and the clock. Pure — tested directly. */
export function evaluate(licenceId: string, payload: LicencePayload | null, now: number, maxSeen: number): Omit<LicenceState, 'lastError'> {
  const base = { licenceId, customer: payload?.customer ?? '', checkedAt: payload?.issuedAt ?? null, validUntil: payload?.validUntil ?? null }
  const lock = (reason: LockReason, message?: string) => ({ ...base, active: false, reason, message: message?.trim() || LOCK_TEXT[reason] })
  if (now < maxSeen - CLOCK_SLACK_MS) return lock('clock')
  if (!payload || payload.licenceId !== licenceId) return lock('unverified')
  if (payload.status === 'suspended') return lock('suspended', payload.message)
  if (payload.status === 'deactivated') return lock('deactivated', payload.message)
  if (payload.status !== 'active') return lock('unknown', payload.message)
  if (now > Date.parse(payload.validUntil)) return lock('expired')
  return { ...base, active: true, reason: null, message: payload.message || 'Licence active.' }
}

export interface LicenceConfig {
  licenceId: string
  /** e.g. https://vertex-licence.example.workers.dev */
  endpoint: string
  appVersion?: string
  installId?: string
  publicKey?: string
  fetch?: typeof fetch
  now?: () => number
}

export class LicenceGuard {
  private payload: LicencePayload | null = null
  private maxSeen = 0
  private lastError: string | null = null
  private loaded = false
  private readonly cfg: Required<Omit<LicenceConfig, 'appVersion' | 'installId'>> & Pick<LicenceConfig, 'appVersion' | 'installId'>

  private readonly store: LicenceStore

  constructor(config: LicenceConfig, store: LicenceStore) {
    this.store = store
    this.cfg = { publicKey: LICENCE_PUBLIC_KEY, fetch: globalThis.fetch.bind(globalThis), now: () => Date.now(), ...config }
  }

  private async load() {
    if (this.loaded) return
    const raw = await this.store.get(TOKEN_KEY)
    if (raw) {
      try {
        this.payload = decodeSigned(JSON.parse(raw) as SignedLicence, this.cfg.publicKey)
      } catch {
        this.payload = null
      }
    }
    this.maxSeen = Number((await this.store.get(CLOCK_KEY)) ?? 0) || 0
    this.loaded = true
  }

  private persisted = 0

  /** Remember the latest time seen (saved at most once a minute), so turning the clock back is noticed. */
  private async tick(): Promise<number> {
    const now = this.cfg.now()
    if (now > this.maxSeen) {
      this.maxSeen = now
      if (now - this.persisted >= 60_000) {
        this.persisted = now
        await this.store.set(CLOCK_KEY, String(now))
      }
    }
    return now
  }

  async state(): Promise<LicenceState> {
    await this.load()
    const now = this.cfg.now()
    const s = evaluate(this.cfg.licenceId, this.payload, now, this.maxSeen)
    if (s.reason !== 'clock') await this.tick()
    return { ...s, lastError: this.lastError }
  }

  /** Ask the licence service now. Failing to reach it keeps the last answer. */
  async check(): Promise<LicenceState> {
    await this.load()
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 15_000)
      const res = await this.cfg
        .fetch(`${this.cfg.endpoint.replace(/\/$/, '')}/v1/check`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ licenceId: this.cfg.licenceId, installId: this.cfg.installId ?? '', version: this.cfg.appVersion ?? '' }),
          signal: ctrl.signal,
        })
        .finally(() => clearTimeout(timer))
      if (!res.ok) throw new Error(`Licence service answered ${res.status}.`)
      const signed = (await res.json()) as SignedLicence
      const payload = decodeSigned(signed, this.cfg.publicKey)
      if (!payload) throw new Error('The licence answer was not signed by Back Moon Devs.')
      if (payload.licenceId !== this.cfg.licenceId) throw new Error('The licence answer is for another licence.')
      this.payload = payload
      await this.store.set(TOKEN_KEY, JSON.stringify(signed))
      // A good answer from the service also settles the clock.
      const serviceTime = Date.parse(payload.issuedAt)
      if (Number.isFinite(serviceTime)) {
        this.maxSeen = Math.min(Math.max(this.maxSeen, this.cfg.now()), serviceTime + CLOCK_SLACK_MS)
        await this.store.set(CLOCK_KEY, String(this.maxSeen))
      }
      this.lastError = null
    } catch (err) {
      this.lastError = err instanceof Error ? (err.name === 'AbortError' ? 'The licence service did not answer in time.' : err.message) : String(err)
    }
    return this.state()
  }

  /** Check now and then every `minutes`; returns a stop function. */
  start(minutes = 30): () => void {
    void this.check()
    const timer = setInterval(() => void this.check(), minutes * 60_000)
    timer.unref?.()
    return () => clearInterval(timer)
  }
}

/** Keep the licence answer in the Vertex database itself (vertex_meta), so it survives restarts and reinstalls. */
export function metaStore(db: Queryable): LicenceStore {
  return {
    get: async (key) => (await db.query<{ value: string }>('select value from vertex_meta where key = $1', [key])).rows[0]?.value ?? null,
    set: async (key, value) => {
      await db.query('insert into vertex_meta (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value', [key, value])
    },
  }
}

/** Where installed copies ask for their licence. */
export const LICENCE_ENDPOINT = 'https://vertex-licence.suryadass010405.workers.dev'
