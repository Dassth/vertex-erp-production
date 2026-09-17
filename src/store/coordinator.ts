/* ---------------------------------------------------------------------------
 * Same-browser write coordination.
 *
 * Every tab of the app keeps an in-memory copy of the database, but localStorage
 * is the single source of truth. A mutation:
 *
 *   1. takes an exclusive lock shared by all tabs of this browser (Web Locks API),
 *   2. reads the LATEST persisted database (not the tab's possibly stale copy),
 *   3. applies the domain operation to it — so idempotency checks, balances and
 *      duplicate protection always see changes made in other tabs,
 *   4. writes it back with revision + 1 and verifies the write,
 *   5. tells the other tabs (BroadcastChannel; the `storage` event is a backstop).
 *
 * Record-level staleness (an editor opened before another tab saved the same
 * record) is detected inside the domain operations via `expectedUpdatedAt`.
 *
 * FALLBACK — without Web Locks, a short lease in localStorage elects one
 * writing tab; the others become read-only instead of risking lost updates.
 *
 * SCOPE — this coordinates tabs of ONE browser profile on ONE device. It is not
 * multi-device or multi-user synchronization; there is no server.
 * ------------------------------------------------------------------------- */

import type { VertexDB } from '../lib/types'
import type { StorageLike } from '../lib/db'
import { DB_KEY, parseStoredDB } from '../lib/db'
import type { Ctx, Op, OpFailure, OpResult } from '../domain/common'

export const DB_LOCK_NAME = 'vertex-erp-db-write'
export const SYNC_CHANNEL_NAME = 'vertex-erp-sync'
export const LEASE_KEY = 'vertex-erp-writer-lease'
const LEASE_MS = 6000

export interface LockManagerLike {
  request<T>(name: string, options: { mode: 'exclusive' }, callback: () => Promise<T> | T): Promise<T>
}

export interface ChannelLike {
  postMessage(message: unknown): void
  close(): void
  onmessage: ((event: { data: unknown }) => void) | null
}

export type SyncMode = 'locked' | 'lease'

export interface CoordinatorOptions {
  storage: StorageLike
  locks: LockManagerLike | null
  channel: ChannelLike | null
  tabId: string
  /** Called whenever the in-memory database changes (own write or another tab's). */
  onChange: (db: VertexDB, source: 'local' | 'external') => void
  now?: () => number
}

type Latest = { status: 'ok'; db: VertexDB } | { status: 'missing' } | { status: 'unreadable' }

const failure = (error: string, extra: Partial<OpFailure> = {}): OpFailure => ({ ok: false, error, ...extra })

export class DbCoordinator {
  private memory: VertexDB
  private readonly opts: CoordinatorOptions
  private readonly now: () => number
  private heartbeat: ReturnType<typeof setInterval> | null = null
  private queue: Promise<unknown> = Promise.resolve()
  private closed = false

  constructor(initial: VertexDB, opts: CoordinatorOptions) {
    this.memory = { ...initial, revision: initial.revision ?? 0 }
    this.opts = opts
    this.now = opts.now ?? Date.now
    if (opts.channel) {
      opts.channel.onmessage = (event) => {
        const data = event.data as { type?: string; revision?: number } | null
        if (data?.type === 'db-updated') this.refreshFromStorage()
      }
    }
    if (!opts.locks) {
      this.tryLease()
      this.heartbeat = setInterval(() => this.tryLease(), LEASE_MS / 3)
    }
  }

  get db(): VertexDB {
    return this.memory
  }

  get mode(): SyncMode {
    return this.opts.locks ? 'locked' : 'lease'
  }

  /** True when this tab may write (always with Web Locks; only the lease holder otherwise). */
  canWrite(): boolean {
    return !!this.opts.locks || this.holdsLease()
  }

  /**
   * Apply an operation under the cross-tab lock against the latest persisted state.
   * `makeCtx` runs inside the lock so the actor is resolved from current data.
   */
  commit<T>(op: Op<T>, makeCtx: (db: VertexDB) => Ctx | OpFailure): Promise<OpResult<T>> {
    const task = () => this.apply(op, makeCtx)
    if (this.opts.locks) return this.opts.locks.request(DB_LOCK_NAME, { mode: 'exclusive' }, task)
    // Lease mode: serialize within this tab; refuse when another tab holds the lease.
    const run = this.queue.then(() => (this.tryLease() ? task() : this.readOnlyFailure<T>()))
    this.queue = run.catch(() => undefined)
    return run
  }

  /** Adopt a newer persisted revision (after a broadcast or `storage` event). */
  refreshFromStorage(): boolean {
    const latest = this.readLatest()
    if (latest.status !== 'ok') return false
    if ((latest.db.revision ?? 0) <= (this.memory.revision ?? 0)) return false
    this.memory = latest.db
    this.opts.onChange(latest.db, 'external')
    return true
  }

  get isDisposed(): boolean {
    return this.closed
  }

  dispose(): void {
    if (this.closed) return
    this.closed = true
    if (this.heartbeat) clearInterval(this.heartbeat)
    if (this.holdsLease()) {
      try {
        this.opts.storage.removeItem(LEASE_KEY)
      } catch {
        /* ignore */
      }
    }
    if (this.opts.channel) {
      this.opts.channel.onmessage = null
      this.opts.channel.close()
    }
  }

  /* ------------------------------------------------------------------------ */

  private apply<T>(op: Op<T>, makeCtx: (db: VertexDB) => Ctx | OpFailure): OpResult<T> {
    const latest = this.readLatest()
    if (latest.status === 'unreadable')
      return failure('The saved data in this browser could not be read, so nothing was changed. Reload the page; if the problem continues, export what you need and contact support.', {
        storageFailure: true,
      })
    if (latest.status === 'ok' && (latest.db.revision ?? 0) > (this.memory.revision ?? 0)) {
      this.memory = latest.db
      this.opts.onChange(latest.db, 'external')
    }
    const base = latest.status === 'ok' ? latest.db : this.memory
    const ctx = makeCtx(base)
    if ('ok' in ctx) return ctx
    const result = op(base, ctx)
    if (!result.ok || result.db === base) return result

    const next: VertexDB = { ...result.db, revision: (base.revision ?? 0) + 1 }
    try {
      this.opts.storage.setItem(DB_KEY, JSON.stringify(next))
    } catch {
      return failure('Your change could not be saved: browser storage is full or blocked. Nothing was changed — free up space or export documents, then try again.', {
        storageFailure: true,
      })
    }
    const check = this.readLatest()
    if (check.status !== 'ok' || check.db.revision !== next.revision) {
      if (check.status === 'ok') {
        this.memory = check.db
        this.opts.onChange(check.db, 'external')
      }
      return failure('Another tab saved at the same moment, so your change was not applied. The latest data has been loaded — please try again.', {
        conflict: true,
      })
    }
    this.memory = next
    this.opts.onChange(next, 'local')
    try {
      this.opts.channel?.postMessage({ type: 'db-updated', revision: next.revision, tabId: this.opts.tabId })
    } catch {
      /* the storage event still reaches other tabs */
    }
    return { ...result, db: next }
  }

  private readLatest(): Latest {
    let raw: string | null
    try {
      raw = this.opts.storage.getItem(DB_KEY)
    } catch {
      return { status: 'unreadable' }
    }
    if (raw === null) return { status: 'missing' }
    const db = parseStoredDB(raw)
    return db ? { status: 'ok', db } : { status: 'unreadable' }
  }

  private readLease(): { tabId: string; expires: number } | null {
    try {
      const raw = this.opts.storage.getItem(LEASE_KEY)
      return raw ? (JSON.parse(raw) as { tabId: string; expires: number }) : null
    } catch {
      return null
    }
  }

  private holdsLease(): boolean {
    const lease = this.readLease()
    return !!lease && lease.tabId === this.opts.tabId && lease.expires > this.now()
  }

  private tryLease(): boolean {
    const lease = this.readLease()
    if (lease && lease.tabId !== this.opts.tabId && lease.expires > this.now()) return false
    try {
      this.opts.storage.setItem(LEASE_KEY, JSON.stringify({ tabId: this.opts.tabId, expires: this.now() + LEASE_MS }))
    } catch {
      return false
    }
    return this.holdsLease()
  }

  private readOnlyFailure<T>(): OpResult<T> {
    return failure('This browser cannot coordinate saves between tabs, and another tab is currently editing. This tab is read-only — close the other tab or make the change there.', {
      readOnly: true,
    })
  }
}
