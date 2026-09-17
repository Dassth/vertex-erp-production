/* ---------------------------------------------------------------------------
 * Domain operations are pure functions:  (db, ctx) → OpResult
 *
 * They hold every business rule and workflow transition, so the React store is
 * only a thin committer and the rules can be unit-tested without a browser.
 * The store applies an operation synchronously against the latest committed
 * state, which is what makes repeated clicks safe: a second confirmation sees
 * the first one's result and returns it instead of creating a duplicate.
 * ------------------------------------------------------------------------- */

import { format, isValid, parseISO } from 'date-fns'
import type { Capability } from '../lib/permissions'
import { can } from '../lib/permissions'
import type {
  AdminTier,
  AuditEntry,
  CostingIssue,
  CounterKey,
  Customer,
  CustomerSnapshot,
  Notification,
  Role,
  Stamp,
  VertexDB,
} from '../lib/types'

export interface Actor {
  id: string
  name: string
  role: Role
  unitId: string | null
  /** Administrators only — decides which operations this actor may commit. */
  adminTier?: AdminTier | null
}

export interface Ctx {
  actor: Actor
  now: Date
  newId: (prefix: string) => string
}

export type OpFailure = {
  ok: false
  error: string
  issues?: CostingIssue[]
  fieldErrors?: Record<string, string>
  /** The record changed in another tab after it was opened; reload before re-applying. */
  conflict?: boolean
  /** The browser refused to store the change; nothing was saved. */
  storageFailure?: boolean
  /** This tab may not write (no cross-tab coordination and another tab holds the lease). */
  readOnly?: boolean
}
export type OpResult<T> = { ok: true; db: VertexDB; value: T } | OpFailure
export type Op<T> = (db: VertexDB, ctx: Ctx) => OpResult<T>

export const ok = <T>(db: VertexDB, value: T): OpResult<T> => ({ ok: true, db, value })

export const fail = (error: string, extra: Omit<OpFailure, 'ok' | 'error'> = {}): OpFailure => ({
  ok: false,
  error,
  ...extra,
})

export function requireAdmin(ctx: Ctx): OpFailure | null {
  return ctx.actor.role === 'admin' ? null : fail('Only an administrator can perform this action.')
}

/**
 * The second enforcement layer. Hiding a control is not protection: every
 * operation the store can commit re-checks the actor's capability here, so a
 * crafted call or a stale screen cannot mutate data the account may not touch.
 */
export function requireCapability(ctx: Ctx, capability: Capability): OpFailure | null {
  if (can({ role: ctx.actor.role, adminTier: ctx.actor.adminTier ?? null, unitId: ctx.actor.unitId }, capability)) return null
  return fail('Your account does not have access to this part of the workflow.')
}

const AUDIT_LIMIT = 3000
const NOTIFY_LIMIT = 300

export function audit(
  db: VertexDB,
  ctx: Ctx,
  entry: Omit<AuditEntry, 'id' | 'at' | 'userId' | 'user' | 'role'>,
): VertexDB {
  const full: AuditEntry = {
    ...entry,
    id: ctx.newId('aud'),
    at: ctx.now.toISOString(),
    userId: ctx.actor.id,
    user: ctx.actor.name,
    role: ctx.actor.role,
  }
  return { ...db, audit: [full, ...db.audit].slice(0, AUDIT_LIMIT) }
}

export function notify(
  db: VertexDB,
  ctx: Ctx,
  n: Omit<Notification, 'id' | 'createdAt' | 'read'>,
): VertexDB {
  if (db.notifications.some((x) => x.key === n.key)) return db
  const full: Notification = { ...n, id: ctx.newId('ntf'), createdAt: ctx.now.toISOString(), read: false }
  return { ...db, notifications: [full, ...db.notifications].slice(0, NOTIFY_LIMIT) }
}

export function nextSeq(db: VertexDB, key: CounterKey): [VertexDB, number] {
  const n = (db.counters[key] ?? 0) + 1
  return [{ ...db, counters: { ...db.counters, [key]: n } }, n]
}

export function docCode(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(4, '0')}`
}

export function stampNew(ctx: Ctx): Stamp {
  const at = ctx.now.toISOString()
  return { createdAt: at, createdBy: ctx.actor.name, updatedAt: at, updatedBy: ctx.actor.name }
}

export function stampUpdate<T extends Stamp>(record: T, ctx: Ctx): T {
  return { ...record, updatedAt: ctx.now.toISOString(), updatedBy: ctx.actor.name }
}

export function customerSnapshot(c: Customer): CustomerSnapshot {
  return {
    id: c.id,
    code: c.code,
    company: c.company,
    contactPerson: c.contactPerson,
    phone: c.phone,
    email: c.email,
    billingAddress: c.billingAddress,
    deliveryAddress: c.deliveryAddress || c.billingAddress,
    gstin: c.gstin,
    placeOfSupply: c.placeOfSupply,
    paymentTerms: c.paymentTerms,
  }
}

export const localDate = (d: Date): string => format(d, 'yyyy-MM-dd')

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value))
}

export const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export function sameText(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

export function deepClone<T>(value: T): T {
  return structuredClone(value)
}

/**
 * Optimistic record check. Editors send the `updatedAt` they loaded; if the
 * persisted record has moved on (another tab or admin saved it), the save is
 * refused instead of silently overwriting the newer version.
 */
export function staleRecord(
  label: string,
  current: { updatedAt: string | null; updatedBy?: string | null },
  expected: string | null | undefined,
): OpFailure | null {
  if (expected === undefined || (current.updatedAt ?? null) === expected) return null
  return fail(
    `${label} was changed${current.updatedBy ? ` by ${current.updatedBy}` : ''} in another tab or window after you opened it. Load the latest version, then re-apply your change.`,
    { conflict: true },
  )
}

export function hasFieldErrors(errors: Record<string, string>): boolean {
  return Object.keys(errors).length > 0
}

export function validationFailure(errors: Record<string, string>): OpFailure {
  const first = Object.values(errors)[0]
  return fail(first ?? 'Please correct the highlighted fields.', { fieldErrors: errors })
}

/* ------------------------------ Server commands ---------------------------- */

/**
 * Every exported operation factory is registered as a named command. The op it
 * returns carries `{ name, args }`, so a server-backed store can send the call
 * instead of the result and the server re-runs the same business rules — and
 * the same permission checks — against its own copy of the data.
 */
export interface CommandCall {
  name: string
  args: unknown[]
}

export interface CommandSpec {
  name: string
  /** Rebuild the op on the server from wire arguments and the server-side context. */
  build: (args: unknown[], ctx: Ctx) => Op<unknown>
}

export const COMMANDS = new Map<string, CommandSpec>()

type TaggedOp<T> = Op<T> & { command?: CommandCall }

export function command<A extends unknown[], T>(
  name: string,
  factory: (...args: A) => Op<T>,
  wire?: { args: (...args: A) => unknown[]; build: (args: unknown[], ctx: Ctx) => Op<T> },
): (...args: A) => Op<T> {
  COMMANDS.set(name, { name, build: wire ? (wire.build as CommandSpec['build']) : (args) => factory(...(args as A)) as Op<unknown> })
  return (...args: A) => {
    const inner = factory(...args)
    const tagged: TaggedOp<T> = (db, ctx) => inner(db, ctx)
    tagged.command = { name, args: wire ? wire.args(...args) : args }
    return tagged
  }
}

export function commandOf(op: Op<unknown>): CommandCall | null {
  return (op as TaggedOp<unknown>).command ?? null
}
