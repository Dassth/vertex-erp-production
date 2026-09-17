import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { User, VertexDB } from '../lib/types'
import type { Capability } from '../lib/permissions'
import { can as hasCapability } from '../lib/permissions'
import { DB_KEY, loadDB, loadSession, saveSession } from '../lib/db'
import type { StorageLike } from '../lib/db'
import { uid } from '../lib/format'
import { hashPassword, newSalt, passwordProblem, verifyPassword } from '../lib/auth'
import type { Actor, Ctx, Op, OpFailure, OpResult } from '../domain/common'
import { audit, fail, ok } from '../domain/common'
import { setPasswordHash } from '../domain/system'
import { sweepSchedules } from '../domain/production'
import { DbCoordinator, SYNC_CHANNEL_NAME } from './coordinator'
import type { ChannelLike, LockManagerLike } from './coordinator'

/* ---------------------------------------------------------------------------
 * The store is a thin layer over DbCoordinator (see coordinator.ts). Every
 * mutation is an async `run(op)`: it waits for the cross-tab lock, applies the
 * domain operation to the latest persisted database, saves it and notifies the
 * other tabs. All business rules stay in src/domain.
 * ------------------------------------------------------------------------- */

import { StoreContext } from './context'
import type { StoreValue, Toast } from './context'
import { ServerStoreProvider } from './serverStore'
import { SERVER_MODE } from './remote'

export type { StorageMode, StoreValue, Toast } from './context'

function browserStorage(): StorageLike {
  try {
    const s = window.localStorage
    s.getItem(DB_KEY)
    return s
  } catch {
    const map = new Map<string, string>()
    return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) }
  }
}

function browserLocks(): LockManagerLike | null {
  return typeof navigator !== 'undefined' && navigator.locks ? (navigator.locks as unknown as LockManagerLike) : null
}

function browserChannel(): ChannelLike | null {
  try {
    return typeof BroadcastChannel === 'function' ? (new BroadcastChannel(SYNC_CHANNEL_NAME) as unknown as ChannelLike) : null
  } catch {
    return null
  }
}

const actorFor = (u: User): Actor => ({ id: u.id, name: u.name, role: u.role, unitId: u.unitId, adminTier: u.adminTier })
const SYSTEM: Actor = { id: 'system', name: 'System', role: 'admin', unitId: null, adminTier: 'full' }

/** Browser storage (default) or the Vertex server (VITE_VERTEX_STORAGE=server). */
export function StoreProvider({ children }: { children: ReactNode }) {
  return SERVER_MODE ? <ServerStoreProvider>{children}</ServerStoreProvider> : <BrowserStoreProvider>{children}</BrowserStoreProvider>
}

function BrowserStoreProvider({ children }: { children: ReactNode }) {
  const storage = useMemo(() => browserStorage(), [])
  const [initial] = useState(() => loadDB(storage))
  const [db, setDb] = useState<VertexDB>(initial.db)
  const [userId, setUserId] = useState<string | null>(() => loadSession())
  const [ready, setReady] = useState(false)
  const [readOnly, setReadOnly] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const userIdRef = useRef(userId)
  const tabId = useMemo(() => uid('tab'), [])
  const coordinatorRef = useRef<DbCoordinator | null>(null)
  const latestDb = useRef(initial.db)
  const announced = useRef(false)

  const pushToast = useCallback((t: Omit<Toast, 'id'>) => {
    const toast: Toast = { ...t, id: uid('tst') }
    setToasts((prev) => [...prev, toast].slice(-4))
    window.setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== toast.id)), 6000)
  }, [])
  const dismissToast = useCallback((id: string) => setToasts((prev) => prev.filter((x) => x.id !== id)), [])

  /** Lazily (re)create the coordinator — StrictMode unmounts once in development. */
  const coordinator = useCallback((): DbCoordinator => {
    if (!coordinatorRef.current || coordinatorRef.current.isDisposed) {
      coordinatorRef.current = new DbCoordinator(latestDb.current, {
        storage,
        locks: browserLocks(),
        channel: browserChannel(),
        tabId,
        onChange: (next) => {
          latestDb.current = next
          setDb(next)
        },
      })
    }
    return coordinatorRef.current
  }, [storage, tabId])

  useEffect(() => {
    const c = coordinator()
    const onStorage = (e: StorageEvent) => {
      if (e.key === DB_KEY) c.refreshFromStorage()
    }
    window.addEventListener('storage', onStorage)
    const lease = c.mode === 'lease' ? window.setInterval(() => setReadOnly(!c.canWrite()), 2000) : null
    return () => {
      window.removeEventListener('storage', onStorage)
      if (lease) window.clearInterval(lease)
      c.dispose()
    }
  }, [coordinator])

  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 250)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    if (announced.current) return
    announced.current = true
    if (initial.event === 'migrated-legacy-demo')
      pushToast({ title: 'Legacy demo data removed', message: 'The old sample records were cleared once. Start by setting up Master data.', level: 'info' })
    if (initial.event === 'recovered-unreadable')
      pushToast({ title: 'Local database could not be read', message: 'A backup copy was kept in browser storage and a fresh database was started.', level: 'warn' })
  }, [initial.event, pushToast])

  const user = useMemo(() => db.users.find((u) => u.id === userId && u.active) ?? null, [db.users, userId])

  const commit = useCallback(
    async <T,>(op: Op<T>, makeCtx: (d: VertexDB) => Ctx | OpFailure): Promise<OpResult<T>> => {
      const result = await coordinator().commit(op, makeCtx)
      if (!result.ok && (result.storageFailure || result.readOnly)) {
        setReadOnly(!!result.readOnly)
        pushToast({ title: result.readOnly ? 'This tab is read-only' : 'Change not saved', message: result.error, level: 'danger' })
      }
      return result
    },
    [coordinator, pushToast],
  )

  const sessionCtx = useCallback((d: VertexDB): Ctx | OpFailure => {
    const current = d.users.find((u) => u.id === userIdRef.current && u.active)
    if (!current) return fail('Your session has ended. Sign in again.')
    return { actor: actorFor(current), now: new Date(), newId: uid }
  }, [])

  const run = useCallback(<T,>(op: Op<T>) => commit(op, sessionCtx), [commit, sessionCtx])

  /* ------------------------------ clock sweep ------------------------------ */
  useEffect(() => {
    const sweep = () => {
      const c = coordinator()
      // Only write when the clock actually changed a status or raised an alert.
      if (sweepSchedules(c.db, new Date()) === c.db || !c.canWrite()) return
      void c.commit((d) => {
        const next = sweepSchedules(d, new Date())
        return ok(next, null)
      }, () => ({ actor: SYSTEM, now: new Date(), newId: uid }))
    }
    sweep()
    const interval = window.setInterval(sweep, 60_000)
    const onVisible = () => document.visibilityState === 'visible' && sweep()
    window.addEventListener('focus', sweep)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', sweep)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [coordinator])

  /* ---------------------------------- auth --------------------------------- */

  const auditAs = useCallback(
    (u: User, action: string) =>
      commit((d, ctx) => ok(audit(d, ctx, { action, entity: 'Account', entityId: u.id, entityLabel: u.email }), null), () => ({ actor: actorFor(u), now: new Date(), newId: uid })),
    [commit],
  )

  const startSession = useCallback(
    async (u: User) => {
      userIdRef.current = u.id
      saveSession(u.id)
      setUserId(u.id)
      await auditAs(u, 'Signed in')
    },
    [auditAs],
  )

  const signIn = useCallback<StoreValue['signIn']>(
    async (id, password) => {
      coordinator().refreshFromStorage()
      const u = coordinator().db.users.find((x) => x.id === id && x.active)
      if (!u) return { ok: false, error: 'Account not found.' }
      if (!u.passwordHash || !u.passwordSalt) return { ok: false, error: 'This account has no password yet. Create one to continue.' }
      if (!(await verifyPassword(password, u.passwordSalt, u.passwordHash))) return { ok: false, error: 'Incorrect password.' }
      await startSession(u)
      return { ok: true, user: u }
    },
    [coordinator, startSession],
  )

  const createFirstPassword = useCallback<StoreValue['createFirstPassword']>(
    async (id, password, confirm) => {
      const problem = passwordProblem(password, confirm)
      if (problem) return { ok: false, error: problem }
      const u = coordinator().db.users.find((x) => x.id === id && x.active)
      if (!u) return { ok: false, error: 'Account not found.' }
      const salt = newSalt()
      const hash = await hashPassword(password, salt)
      // The op re-checks inside the lock, so two tabs cannot both claim the first password.
      const result = await commit(setPasswordHash(id, hash, salt, 'first-time'), () => ({ actor: actorFor(u), now: new Date(), newId: uid }))
      if (!result.ok) return { ok: false, error: result.error }
      await startSession(result.value)
      return { ok: true, user: result.value }
    },
    [commit, coordinator, startSession],
  )

  const changePassword = useCallback<StoreValue['changePassword']>(
    async (current, nextPassword, confirm) => {
      const u = coordinator().db.users.find((x) => x.id === userIdRef.current)
      if (!u || !u.passwordHash || !u.passwordSalt) return { ok: false, error: 'Sign in again to change your password.' }
      if (!(await verifyPassword(current, u.passwordSalt, u.passwordHash))) return { ok: false, error: 'Your current password is incorrect.' }
      const problem = passwordProblem(nextPassword, confirm)
      if (problem) return { ok: false, error: problem }
      const salt = newSalt()
      const hash = await hashPassword(nextPassword, salt)
      const result = await commit(setPasswordHash(u.id, hash, salt, 'change'), () => ({ actor: actorFor(u), now: new Date(), newId: uid }))
      return result.ok ? { ok: true } : { ok: false, error: result.error }
    },
    [commit, coordinator],
  )

  const logout = useCallback(async () => {
    const u = coordinator().db.users.find((x) => x.id === userIdRef.current)
    userIdRef.current = null
    saveSession(null)
    setUserId(null)
    if (u) await auditAs(u, 'Signed out')
  }, [auditAs, coordinator])

  const can = useCallback((capability: Capability) => hasCapability(user, capability), [user])

  const value = useMemo<StoreValue>(
    () => ({ db, user, ready, readOnly, storageMode: 'browser', toasts, can, pushToast, dismissToast, run, signIn, createFirstPassword, changePassword, logout }),
    [db, user, ready, readOnly, toasts, can, pushToast, dismissToast, run, signIn, createFirstPassword, changePassword, logout],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>')
  return ctx
}
