/* ---------------------------------------------------------------------------
 * Vertex ERP service: authentication, server-enforced commands and drafts.
 *
 * Permissions are enforced here, not in the browser: the actor for every
 * command is the account behind the session token, re-read from the committed
 * data inside the same transaction, and the domain operation re-checks that
 * account's capabilities exactly as it does in the browser build.
 * ------------------------------------------------------------------------- */

import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { User, VertexDB } from '../src/lib/types'
import { buildEmptyDB } from '../src/lib/defaults'
import { normalizeDB } from '../src/lib/db'
import { newSalt, passwordProblem, nodeHasher } from './passwords'
import type { PasswordHasher } from './passwords'
import { COMMANDS } from '../src/domain/registry'
import type { Actor, Ctx, OpFailure } from '../src/domain/common'
import { audit, ok } from '../src/domain/common'
import { setPasswordHash } from '../src/domain/system'
import { sweepSchedules } from '../src/domain/production'
import type { Database, Queryable } from './storage'
import type { StateRow } from './storage'
import { readState, readUser, writeState } from './storage'

export const SESSION_HOURS = 12
/** Commands that must go through dedicated, server-hashed endpoints instead. */
const NOT_A_COMMAND = new Set(['setPasswordHash'])

export type ServiceError = { ok: false; status: number; error: string; fieldErrors?: Record<string, string>; conflict?: boolean; issues?: OpFailure['issues'] }

export interface PublicAccount {
  id: string
  name: string
  email: string
  role: User['role']
  unitId: User['unitId']
  adminTier: User['adminTier']
  designation: string
  initials: string
  active: boolean
  hasPassword: boolean
}

const actorFor = (u: User): Actor => ({ id: u.id, name: u.name, role: u.role, unitId: u.unitId, adminTier: u.adminTier })
const SYSTEM: Actor = { id: 'system', name: 'System', role: 'admin', unitId: null, adminTier: 'full' }
const newId = (prefix: string) => `${prefix}-${randomUUID().slice(0, 13)}`
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

/** Password hashes and salts never leave the server. */
export function publicState(db: VertexDB): VertexDB {
  return { ...db, users: db.users.map((u) => ({ ...u, passwordHash: u.passwordHash ? 'set' : null, passwordSalt: null })) }
}

export function publicAccounts(db: VertexDB): PublicAccount[] {
  return db.users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    unitId: u.unitId,
    adminTier: u.adminTier,
    designation: u.designation,
    initials: u.initials,
    active: u.active,
    hasPassword: !!u.passwordHash,
  }))
}

export class VertexService {
  private failures = new Map<string, { count: number; until: number }>()

  readonly db: Database
  private readonly clock: () => Date

  private readonly hasher: PasswordHasher

  constructor(db: Database, clock: () => Date = () => new Date(), hasher: PasswordHasher = nodeHasher) {
    this.db = db
    this.clock = clock
    this.hasher = hasher
  }

  /** Creates the state row the first time. Never replaces existing data. */
  async ensureState(): Promise<void> {
    await this.db.transaction(async (tx) => {
      const current = await readState(tx, true)
      if (current) return
      const now = this.clock()
      await writeState(tx, { revision: 1, data: normalizeDB(buildEmptyDB(now)), actor: 'system', command: 'initialise', at: now })
    })
  }

  async state(): Promise<{ revision: number; db: VertexDB }> {
    const row = await readState(this.db)
    if (!row) throw new Error('State not initialised')
    return { revision: row.revision, db: normalizeDB(row.data) }
  }

  /* --------------------------------- auth --------------------------------- */

  private locked(userId: string): boolean {
    const f = this.failures.get(userId)
    return !!f && f.until > Date.now()
  }

  private noteFailure(userId: string) {
    const f = this.failures.get(userId) ?? { count: 0, until: 0 }
    f.count += 1
    if (f.count >= 5) {
      f.until = Date.now() + 60_000
      f.count = 0
    }
    this.failures.set(userId, f)
  }

  private async openSession(tx: Queryable, userId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url')
    const expires = new Date(this.clock().getTime() + SESSION_HOURS * 3600_000)
    await tx.query('insert into vertex_sessions (token_hash, user_id, expires_at) values ($1, $2, $3)', [hashToken(token), userId, expires.toISOString()])
    return token
  }

  /**
   * Apply a system-level change (sign-in audit, password) inside the state lock.
   * Pass `locked` when the caller already holds the row, to avoid re-reading it.
   */
  private async mutate<T>(label: string, actor: Actor, fn: (db: VertexDB, ctx: Ctx) => { ok: true; db: VertexDB; value: T } | OpFailure, tx: Queryable, locked?: StateRow) {
    const row = locked ?? (await readState(tx, true))
    if (!row) throw new Error('State not initialised')
    const ctx: Ctx = { actor, now: this.clock(), newId }
    const current = normalizeDB(row.data)
    const r = fn(current, ctx)
    if (r.ok && r.db !== current) await writeState(tx, { revision: row.revision + 1, data: r.db, actor: actor.name, command: label, at: ctx.now })
    return r
  }

  async login(userId: string, password: string): Promise<{ ok: true; token: string; user: PublicAccount } | ServiceError> {
    if (this.locked(userId)) return { ok: false, status: 429, error: 'Too many attempts. Wait a minute and try again.' }
    // Verify outside the transaction: the hasher may itself need a database connection.
    const found = await readUser(this.db, userId)
    const known = found?.active ? found : null
    if (!known) return { ok: false, status: 401, error: 'Account not found.' }
    if (!known.passwordHash || !known.passwordSalt) return { ok: false, status: 409, error: 'This account has no password yet. Create one to continue.' }
    if (!(await this.hasher.verify(password, known.passwordSalt, known.passwordHash))) {
      this.noteFailure(userId)
      return { ok: false, status: 401, error: 'Incorrect password.' }
    }
    return this.db.transaction(async (tx) => {
      const row = await readState(tx, true)
      const user = row?.data.users.find((u) => u.id === userId && u.active)
      if (!row || !user) return { ok: false as const, status: 401, error: 'Account not found.' }
      // The password must not have changed between the check and the lock.
      if (user.passwordHash !== known.passwordHash) return { ok: false as const, status: 409, error: 'The password was just changed. Sign in again.' }
      this.failures.delete(userId)
      await this.mutate('signIn', actorFor(user), (d, ctx) => ok(audit(d, ctx, { action: 'Signed in', entity: 'Account', entityId: user.id, entityLabel: user.email }), null), tx, row)
      const token = await this.openSession(tx, user.id)
      return { ok: true as const, token, user: publicAccounts({ users: [user] } as VertexDB)[0] }
    })
  }

  async createFirstPassword(userId: string, password: string, confirm: string): Promise<{ ok: true; token: string; user: PublicAccount } | ServiceError> {
    const problem = passwordProblem(password, confirm)
    if (problem) return { ok: false, status: 422, error: problem }
    const salt = newSalt()
    const hash = await this.hasher.hash(password, salt)
    return this.db.transaction(async (tx) => {
      const row = await readState(tx, true)
      const user = row?.data.users.find((u) => u.id === userId && u.active)
      if (!row || !user) return { ok: false as const, status: 404, error: 'Account not found.' }
      // The op refuses when a password already exists, so two clients cannot both claim it.
      // Password and sign-in audit go out as one write: the document is large.
      const setAndSignIn = (d: VertexDB, ctx: Ctx) => {
        const set = setPasswordHash(userId, hash, salt, 'first-time')(d, ctx)
        return set.ok ? ok(audit(set.db, ctx, { action: 'Signed in', entity: 'Account', entityId: user.id, entityLabel: user.email }), set.value) : set
      }
      const r = await this.mutate('createFirstPassword', actorFor(user), setAndSignIn, tx, row)
      if (!r.ok) return { ok: false as const, status: 409, error: r.error }
      const token = await this.openSession(tx, user.id)
      return { ok: true as const, token, user: publicAccounts({ users: [r.value] } as VertexDB)[0] }
    })
  }

  async changePassword(userId: string, current: string, next: string, confirm: string): Promise<{ ok: true } | ServiceError> {
    const found = await readUser(this.db, userId)
    const user = found?.active ? found : null
    if (!user?.passwordHash || !user.passwordSalt) return { ok: false, status: 401, error: 'Sign in again to change your password.' }
    if (!(await this.hasher.verify(current, user.passwordSalt, user.passwordHash))) return { ok: false, status: 401, error: 'Your current password is incorrect.' }
    const problem = passwordProblem(next, confirm)
    if (problem) return { ok: false, status: 422, error: problem }
    const salt = newSalt()
    const hash = await this.hasher.hash(next, salt)
    return this.db.transaction(async (tx) => {
      const r = await this.mutate('changePassword', actorFor(user), setPasswordHash(userId, hash, salt, 'change'), tx)
      if (!r.ok) return { ok: false as const, status: 409, error: r.error }
      // Other sessions of this account end when the password changes.
      await tx.query('delete from vertex_sessions where user_id = $1', [userId])
      return { ok: true as const }
    })
  }

  /** The active account behind a session token, or null. */
  async sessionUser(token: string | undefined): Promise<User | null> {
    if (!token) return null
    const { rows } = await this.db.query<{ user_id: string }>('select user_id from vertex_sessions where token_hash = $1 and expires_at > $2', [
      hashToken(token),
      this.clock().toISOString(),
    ])
    if (!rows[0]) return null
    const user = await readUser(this.db, rows[0].user_id)
    return user?.active ? user : null
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return
    const user = await this.sessionUser(token)
    await this.db.transaction(async (tx) => {
      await tx.query('delete from vertex_sessions where token_hash = $1', [hashToken(token)])
      if (user) await this.mutate('signOut', actorFor(user), (d, ctx) => ok(audit(d, ctx, { action: 'Signed out', entity: 'Account', entityId: user.id, entityLabel: user.email }), null), tx)
    })
  }

  /* ------------------------------- commands ------------------------------- */

  async command(token: string | undefined, name: string, args: unknown[]): Promise<{ ok: true; revision: number; value: unknown; db: VertexDB } | ServiceError> {
    const spec = COMMANDS.get(name)
    if (!spec || NOT_A_COMMAND.has(name)) return { ok: false, status: 400, error: `Unknown command “${name}”.` }
    if (!Array.isArray(args)) return { ok: false, status: 400, error: 'Command arguments must be a list.' }
    const tokenUser = await this.sessionUser(token)
    if (!tokenUser) return { ok: false, status: 401, error: 'Your session has ended. Sign in again.' }
    return this.db.transaction(async (tx) => {
      const row = await readState(tx, true)
      if (!row) throw new Error('State not initialised')
      const current = normalizeDB(row.data)
      // Re-read the account inside the lock: a deactivated account cannot act.
      const user = current.users.find((u) => u.id === tokenUser.id && u.active)
      if (!user) return { ok: false as const, status: 401, error: 'Your session has ended. Sign in again.' }
      const ctx: Ctx = { actor: actorFor(user), now: this.clock(), newId }
      let result
      try {
        result = spec.build(args, ctx)(current, ctx)
      } catch (err) {
        return { ok: false as const, status: 400, error: `The request could not be applied: ${err instanceof Error ? err.message : String(err)}` }
      }
      if (!result.ok) {
        const status = /does not have access|Only an administrator/.test(result.error) ? 403 : result.conflict ? 409 : 422
        return { ok: false as const, status, error: result.error, fieldErrors: result.fieldErrors, conflict: result.conflict, issues: result.issues }
      }
      if (result.db === current) return { ok: true as const, revision: row.revision, value: result.value, db: publicState(current) }
      const revision = row.revision + 1
      await writeState(tx, { revision, data: result.db, actor: user.name, command: name, at: ctx.now })
      return { ok: true as const, revision, value: result.value, db: publicState(result.db) }
    })
  }

  /** Clock-driven status changes, applied by the server as the System actor. */
  async sweep(): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const row = await readState(tx, true)
      if (!row) return false
      const current = normalizeDB(row.data)
      const next = sweepSchedules(current, this.clock())
      if (next === current) return false
      await writeState(tx, { revision: row.revision + 1, data: next, actor: SYSTEM.name, command: 'sweepSchedules', at: this.clock() })
      return true
    })
  }

  /* -------------------------------- drafts -------------------------------- */

  async getDraft(userId: string, key: string): Promise<{ rev: number; data: string; updatedAt: string } | null> {
    const { rows } = await this.db.query<{ rev: string; data: string; updated_at: string | Date }>(
      'select rev, data, updated_at from vertex_drafts where user_id = $1 and draft_key = $2',
      [userId, key],
    )
    const r = rows[0]
    return r ? { rev: Number(r.rev), data: r.data, updatedAt: new Date(r.updated_at).toISOString() } : null
  }

  /** Saves a draft unless a newer revision (from another tab or device) is stored. */
  async putDraft(userId: string, key: string, knownRev: number, data: string): Promise<{ ok: true; rev: number } | { ok: false; status: 409; current: { rev: number; data: string; updatedAt: string } }> {
    return this.db.transaction(async (tx) => {
      const { rows } = await tx.query<{ rev: string; data: string; updated_at: string | Date }>(
        'select rev, data, updated_at from vertex_drafts where user_id = $1 and draft_key = $2 for update',
        [userId, key],
      )
      const current = rows[0]
      if (current && Number(current.rev) > knownRev)
        return { ok: false as const, status: 409 as const, current: { rev: Number(current.rev), data: current.data, updatedAt: new Date(current.updated_at).toISOString() } }
      const rev = Math.max(knownRev, current ? Number(current.rev) : 0) + 1
      await tx.query(
        `insert into vertex_drafts (user_id, draft_key, rev, data, updated_at) values ($1, $2, $3, $4, $5)
         on conflict (user_id, draft_key) do update set rev = excluded.rev, data = excluded.data, updated_at = excluded.updated_at`,
        [userId, key, rev, data, this.clock().toISOString()],
      )
      return { ok: true as const, rev }
    })
  }

  async deleteDraft(userId: string, key: string): Promise<void> {
    await this.db.query('delete from vertex_drafts where user_id = $1 and draft_key = $2', [userId, key])
  }

  /* ------------------------------ migration ------------------------------- */

  /**
   * Load an exported browser dataset into an EMPTY server database. Existing
   * server data is never replaced: the import is refused unless the server holds
   * no business records yet. IDs, accounts (with their password hashes) and
   * document counters are kept exactly.
   */
  async importBrowserDataset(dataset: VertexDB, importedBy: string, drafts?: { key: string; value: string }[]): Promise<{ ok: true; revision: number } | ServiceError> {
    const incoming = normalizeDB(dataset)
    return this.db.transaction(async (tx) => {
      const row = await readState(tx, true)
      if (row) {
        const d = row.data
        const hasRecords = [d.products, d.materials, d.customers, d.plans, d.costings, d.orders, d.dispatches, d.invoices].some((l) => l.length > 0)
        if (hasRecords) return { ok: false as const, status: 409, error: 'The server already holds business records. The import was refused so nothing is replaced.' }
      }
      const revision = (row?.revision ?? 0) + 1
      await writeState(tx, { revision, data: incoming, actor: importedBy, command: 'importBrowserDataset', at: this.clock() })
      await tx.query(`insert into vertex_meta (key, value) values ('imported_from_browser', $1) on conflict (key) do update set value = excluded.value`, [
        JSON.stringify({ at: this.clock().toISOString(), by: importedBy, revision, createdAt: incoming.createdAt }),
      ])
      if (drafts) {
        for (const draft of drafts) {
          try {
            const parsed = JSON.parse(draft.value)
            await tx.query('insert into vertex_drafts (user_id, draft_key, rev, data) values ($1, $2, $3, $4)', [parsed.userId, draft.key, parsed.rev, parsed.data])
          } catch {
            /* skip malformed drafts */
          }
        }
      }
      return { ok: true as const, revision }
    })
  }
}
