import type { CompanyProfile, Notification, User } from '../lib/types'
import { isValidGstin } from '../lib/billing'
import { audit, fail, hasFieldErrors, ok, requireCapability, staleRecord, validationFailure, command } from './common'
import type { Ctx, Op } from './common'
import { isVisibleTo } from '../lib/notify'
import { initialsOf } from '../lib/format'

export type CompanyDraft = Omit<CompanyProfile, 'updatedAt' | 'updatedBy'> & { expectedUpdatedAt?: string | null }

export function validateCompany(d: CompanyDraft): Record<string, string> {
  const e: Record<string, string> = {}
  if (!d.name.trim()) e.name = 'Enter the company name printed on invoices.'
  if (d.gstin.trim() && !isValidGstin(d.gstin)) e.gstin = `Enter a 15-character GSTIN: 2-digit state code, then 13 letters or digits (e.g. 33AAACV1234C1ZW). You entered ${d.gstin.trim().length} characters.`
  if (d.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) e.email = 'Enter a valid email address.'
  if (!/^[A-Za-z0-9-]{1,12}$/.test(d.invoicePrefix.trim())) e.invoicePrefix = 'Use 1–12 letters, digits or hyphens.'
  return e
}

export const saveCompanyProfile = command(
  'saveCompanyProfile',
  (d: CompanyDraft): Op<CompanyProfile> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'administration')
    if (denied) return denied
    const stale = staleRecord('The company profile', db.company, d.expectedUpdatedAt)
    if (stale) return stale
    const errors = validateCompany(d)
    if (hasFieldErrors(errors)) return validationFailure(errors)
    const company: CompanyProfile = {
      name: d.name.trim(),
      address: d.address.trim(),
      phone: d.phone.trim(),
      email: d.email.trim(),
      gstin: d.gstin.trim().toUpperCase(),
      invoicePrefix: d.invoicePrefix.trim(),
      bankDetails: d.bankDetails.trim(),
      invoiceTerms: d.invoiceTerms.trim(),
      updatedAt: ctx.now.toISOString(),
      updatedBy: ctx.actor.name,
    }
    return ok(
      audit({ ...db, company }, ctx, {
        action: 'Company profile updated',
        entity: 'System',
        entityId: 'company',
        entityLabel: company.name,
        field: 'Applies to',
        newValue: 'Invoices issued from now on (issued invoices keep their snapshot)',
      }),
      company,
    )
  },
)

/** Record a password hash. Hashing is async and happens before this op. */
export const setPasswordHash = command(
  'setPasswordHash',
  (userId: string, hash: string, salt: string, mode: 'first-time' | 'change'): Op<User> =>
  (db, ctx) => {
    const user = db.users.find((u) => u.id === userId)
    if (!user || !user.active) return fail('Account not found.')
    if (mode === 'first-time' && user.passwordHash) return fail('This account already has a password. Sign in instead.')
    if (mode === 'change' && ctx.actor.id !== userId) return fail('You can only change your own password.')
    const updated: User = { ...user, passwordHash: hash, passwordSalt: salt, passwordSetAt: ctx.now.toISOString() }
    return ok(
      audit({ ...db, users: db.users.map((u) => (u.id === userId ? updated : u)) }, ctx, {
        action: mode === 'first-time' ? 'Password created on first sign-in' : 'Password changed',
        entity: 'Account',
        entityId: userId,
        entityLabel: user.email,
      }),
      updated,
    )
  },
)

export const resetPassword = command(
  'resetPassword',
  (userId: string): Op<User> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'administration')
    if (denied) return denied
    const user = db.users.find((u) => u.id === userId)
    if (!user) return fail('Account not found.')
    if (user.id === ctx.actor.id) return fail('Use “Change password” for your own account.')
    const updated: User = { ...user, passwordHash: null, passwordSalt: null, passwordSetAt: null }
    return ok(
      audit({ ...db, users: db.users.map((u) => (u.id === userId ? updated : u)) }, ctx, {
        action: 'Password reset — new password required at next sign-in',
        entity: 'Account',
        entityId: userId,
        entityLabel: user.email,
      }),
      updated,
    )
  },
)

export const updateDisplayName = command(
  'updateDisplayName',
  (name: string): Op<User> =>
  (db, ctx) => {
    const user = db.users.find((u) => u.id === ctx.actor.id)
    if (!user) return fail('Account not found.')
    const clean = name.trim()
    if (clean.length < 2) return validationFailure({ name: 'Enter at least 2 characters.' })
    if (db.users.some((u) => u.id !== user.id && u.name.toLowerCase() === clean.toLowerCase()))
      return validationFailure({ name: 'Another account already uses this name — audit entries must stay distinguishable.' })
    const updated: User = { ...user, name: clean, initials: initialsOf(clean) || user.initials }
    return ok(
      audit({ ...db, users: db.users.map((u) => (u.id === user.id ? updated : u)) }, { ...ctx, actor: { ...ctx.actor, name: clean } }, {
        action: 'Display name changed',
        entity: 'Account',
        entityId: user.id,
        entityLabel: user.email,
        field: 'Name',
        oldValue: user.name,
        newValue: clean,
      }),
      updated,
    )
  },
)

export const CLEAR_CONFIRMATION = 'CLEAR BUSINESS DATA'

/**
 * Remove all business records. Accounts, units, company profile, costing
 * defaults and document counters are kept — counters are never rewound, so
 * document numbers can never be reused. Nothing is ever re-seeded.
 */
export const clearBusinessData = command(
  'clearBusinessData',
  (confirmation: string): Op<null> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'administration')
    if (denied) return denied
    if (confirmation.trim() !== CLEAR_CONFIRMATION) return fail(`Type ${CLEAR_CONFIRMATION} to confirm.`)
    const counts = `${db.products.length} products, ${db.materials.length} materials, ${db.customers.length} customers, ${db.plans.length} plans, ${db.orders.length} orders, ${db.invoices.length} invoices`
    const next = {
      ...db,
      materials: [],
      products: [],
      customers: [],
      plans: [],
      costings: [],
      orders: [],
      dispatches: [],
      invoices: [],
      notifications: [],
      settings: { ...db.settings, processCharges: [], orderCharges: [] },
    }
    return ok(
      audit(next, ctx, {
        action: 'Business data cleared',
        entity: 'System',
        entityId: 'database',
        entityLabel: 'All business records',
        oldValue: counts,
        newValue: 'Empty — accounts, company profile, defaults and document counters kept',
      }),
      null,
    )
  },
)

type VisibleFn = (n: { audience: string; unitId?: string }) => boolean

const markReadOp =
  (ids: string[] | 'all', visible: VisibleFn): Op<null> =>
  (db) =>
    ok(
      {
        ...db,
        notifications: db.notifications.map((n) => ((ids === 'all' ? visible(n) : ids.includes(n.id)) ? { ...n, read: true } : n)),
      },
      null,
    )

const clearOp =
  (visible: VisibleFn): Op<null> =>
  (db) =>
    ok({ ...db, notifications: db.notifications.filter((n) => !visible(n)) }, null)

/** On a server the visibility rule is rebuilt from the signed-in account, never taken from the client. */
const visibleToActor = (ctx: Ctx): VisibleFn => (n) =>
  isVisibleTo(n as Notification, { role: ctx.actor.role, adminTier: ctx.actor.adminTier ?? null, unitId: ctx.actor.unitId })

export const markNotificationsRead = command('markNotificationsRead', markReadOp, {
  args: (ids) => [ids],
  build: (args, ctx) => markReadOp(args[0] as string[] | 'all', visibleToActor(ctx)),
})

export const clearNotifications = command('clearNotifications', clearOp, {
  args: () => [],
  build: (_args, ctx) => clearOp(visibleToActor(ctx)),
})
