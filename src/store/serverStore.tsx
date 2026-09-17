/* ---------------------------------------------------------------------------
 * Server-backed store. Same interface as the browser store, but:
 *   • data comes from the Vertex server and is refreshed every few seconds;
 *   • each `run(op)` sends the op's command to the server, which re-applies the
 *     business rules and permissions and replies only after COMMIT — only then
 *     does the screen show the change as saved;
 *   • passwords are verified and hashed on the server; sessions are HttpOnly cookies.
 * Nothing is written to browser storage except recovery drafts.
 * ------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { User, VertexDB } from '../lib/types'
import type { Capability } from '../lib/permissions'
import { can as hasCapability } from '../lib/permissions'
import { buildEmptyDB } from '../lib/defaults'
import { uid } from '../lib/format'
import type { Op, OpResult } from '../domain/common'
import { commandOf, fail } from '../domain/common'
import { StoreContext } from './context'
import type { StoreValue, Toast } from './context'
import { NetworkError, remote } from './remote'
import type { PublicAccount } from './remote'

const POLL_MS = 4000

/** Before sign-in the server shares only the account list (no hashes). */
function signInShell(accounts: PublicAccount[], company: string): VertexDB {
  const db = buildEmptyDB(new Date())
  return {
    ...db,
    company: { ...db.company, name: company || db.company.name },
    users: accounts.map((a) => ({ ...a, passwordHash: a.hasPassword ? 'set' : null, passwordSalt: null, passwordSetAt: null }) as User),
  }
}

export function ServerStoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<VertexDB>(() => buildEmptyDB(new Date()))
  const [userId, setUserId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [offline, setOffline] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const revision = useRef(0)

  const pushToast = useCallback((t: Omit<Toast, 'id'>) => {
    const toast: Toast = { ...t, id: uid('tst') }
    setToasts((prev) => [...prev, toast].slice(-4))
    window.setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== toast.id)), 6000)
  }, [])
  const dismissToast = useCallback((id: string) => setToasts((prev) => prev.filter((x) => x.id !== id)), [])

  const loadAccounts = useCallback(async () => {
    const r = await remote.accounts()
    if (r.status === 200) setDb(signInShell(r.body.accounts, r.body.company))
  }, [])

  const refresh = useCallback(async (): Promise<boolean> => {
    try {
      const r = await remote.state(revision.current || undefined)
      setOffline(false)
      if (r.status === 401) {
        setUserId(null)
        revision.current = 0
        await loadAccounts()
        return false
      }
      if (r.body.ok && !r.body.unchanged && r.body.db) {
        revision.current = r.body.revision
        setDb(r.body.db)
      }
      return true
    } catch (err) {
      if (err instanceof NetworkError) setOffline(true)
      return false
    }
  }, [loadAccounts])

  // Resume an existing session, otherwise show the sign-in screen.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const s = await remote.session()
        if (cancelled) return
        if (s.status === 200 && s.body.ok) {
          setUserId(s.body.userId)
          await refresh()
        } else await loadAccounts()
      } catch {
        setOffline(true)
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refresh, loadAccounts])

  // Other users' and devices' changes arrive by polling.
  useEffect(() => {
    if (!userId) return
    const t = window.setInterval(() => void refresh(), POLL_MS)
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(t)
      window.removeEventListener('focus', onFocus)
    }
  }, [userId, refresh])

  const run = useCallback(
    async <T,>(op: Op<T>): Promise<OpResult<T>> => {
      const call = commandOf(op as Op<unknown>)
      if (!call) return fail('This action is not available when data is stored on the server.')
      try {
        const r = await remote.command(call)
        setOffline(false)
        if (r.body.ok) {
          revision.current = r.body.revision
          setDb(r.body.db)
          return { ok: true, db: r.body.db, value: r.body.value as T }
        }
        if (r.status === 401) {
          setUserId(null)
          await loadAccounts()
        }
        if (r.status >= 500) pushToast({ title: 'Change not saved', message: r.body.error, level: 'danger' })
        return { ok: false, error: r.body.error, fieldErrors: r.body.fieldErrors, conflict: r.body.conflict, issues: r.body.issues, storageFailure: r.status >= 500 }
      } catch (err) {
        setOffline(true)
        const error = `The server could not be reached — nothing was saved. ${err instanceof Error ? err.message : ''}`.trim()
        pushToast({ title: 'Change not saved', message: error, level: 'danger' })
        return { ok: false, error, storageFailure: true }
      }
    },
    [loadAccounts, pushToast],
  )

  const afterAuth = useCallback(
    async (account: PublicAccount): Promise<User> => {
      setUserId(account.id)
      revision.current = 0
      await refresh()
      return { ...account, passwordHash: 'set', passwordSalt: null, passwordSetAt: null } as User
    },
    [refresh],
  )

  const signIn = useCallback<StoreValue['signIn']>(
    async (id, password) => {
      try {
        const r = await remote.login(id, password)
        if (!r.body.ok) return { ok: false, error: r.body.error }
        return { ok: true, user: await afterAuth(r.body.user) }
      } catch {
        return { ok: false, error: 'The server could not be reached. Try again.' }
      }
    },
    [afterAuth],
  )

  const createFirstPassword = useCallback<StoreValue['createFirstPassword']>(
    async (id, password, confirm) => {
      try {
        const r = await remote.firstPassword(id, password, confirm)
        if (!r.body.ok) return { ok: false, error: r.body.error }
        return { ok: true, user: await afterAuth(r.body.user) }
      } catch {
        return { ok: false, error: 'The server could not be reached. Try again.' }
      }
    },
    [afterAuth],
  )

  const changePassword = useCallback<StoreValue['changePassword']>(async (current, next, confirm) => {
    try {
      const r = await remote.changePassword(current, next, confirm)
      if (!r.body.ok) return { ok: false, error: r.body.error }
      // The server ends every session of this account after a password change.
      setUserId(null)
      await loadAccounts()
      return { ok: true }
    } catch {
      return { ok: false, error: 'The server could not be reached. Try again.' }
    }
  }, [loadAccounts])

  const logout = useCallback(async () => {
    try {
      await remote.logout()
    } finally {
      setUserId(null)
      revision.current = 0
      await loadAccounts().catch(() => {})
    }
  }, [loadAccounts])

  const user = useMemo(() => db.users.find((u) => u.id === userId && u.active) ?? null, [db.users, userId])
  const can = useCallback((capability: Capability) => hasCapability(user, capability), [user])

  const value = useMemo<StoreValue>(
    () => ({
      db,
      user,
      ready,
      readOnly: offline,
      storageMode: 'server',
      toasts,
      can,
      pushToast,
      dismissToast,
      run,
      signIn,
      createFirstPassword,
      changePassword,
      logout,
    }),
    [db, user, ready, offline, toasts, can, pushToast, dismissToast, run, signIn, createFirstPassword, changePassword, logout],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
