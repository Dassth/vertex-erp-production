/* ---------------------------------------------------------------------------
 * Who may see and do what.
 *
 * Administrators are not equal. Each account carries an `adminTier` and every
 * capability below is derived from it, so navigation, routes, visible controls,
 * domain operations and data selectors all answer from this one table.
 *
 *   full       (Administrator 1) — the whole workflow plus administration
 *   operations (Administrator 2) — monitor production, run dispatch, read billing
 *   billing    (Administrator 3) — billing documents only
 *   unit users                   — only the processes allocated to their unit
 *
 * LIMITATION: these are browser-side controls over a browser-side database.
 * They shape what the application offers and refuses, and they are NOT a
 * server-enforced security boundary: anyone who can open the browser's
 * developer tools can read or modify localStorage directly. Treat this as
 * workflow separation between trusted colleagues, not as protection against a
 * determined local attacker.
 * ------------------------------------------------------------------------- */

import type { AdminTier, Role, User } from './types'

export type Capability =
  /** Master → Products, Costing configuration, Customers. */
  | 'master'
  | 'planning'
  /** The order costing module (rates, profit, finalize). */
  | 'costing'
  /** Read internal cost/profit figures wherever they appear. */
  | 'costing.internals'
  /** Admin production dashboard — monitoring only. */
  | 'production.monitor'
  /** Shop-floor process updates for one's own unit. */
  | 'production.work'
  | 'dispatch'
  | 'billing'
  /** Company profile, units, people, machines, accounts, data reset. */
  | 'administration'

const TIER_CAPABILITIES: Record<AdminTier, Capability[]> = {
  full: ['master', 'planning', 'costing', 'costing.internals', 'production.monitor', 'dispatch', 'billing', 'administration'],
  operations: ['production.monitor', 'dispatch', 'billing'],
  billing: ['billing'],
}

const UNIT_CAPABILITIES: Capability[] = ['production.work']

export type Principal = Pick<User, 'role' | 'adminTier' | 'unitId'> | null | undefined

export function capabilitiesOf(user: Principal): Capability[] {
  if (!user) return []
  if (user.role === 'unit') return UNIT_CAPABILITIES
  return TIER_CAPABILITIES[user.adminTier ?? 'full'] ?? []
}

export function can(user: Principal, capability: Capability): boolean {
  return capabilitiesOf(user).includes(capability)
}

/** Any of — useful for screens that several tiers reach for different reasons. */
export function canAny(user: Principal, capabilities: Capability[]): boolean {
  const owned = capabilitiesOf(user)
  return capabilities.some((c) => owned.includes(c))
}

/** Where an account belongs after signing in, and where it recovers to. */
export function landingPath(user: Principal): string {
  if (!user) return '/login'
  if (user.role === 'unit') return '/unit'
  // Every administrator starts on Home, which shows only what their tier may see.
  if (user.role === 'admin') return '/home'
  return '/account'
}

/** Capability required to open each route prefix, longest match first. */
const ROUTE_CAPABILITIES: Array<[string, Capability]> = [
  ['/master', 'master'],
  ['/planning', 'planning'],
  ['/costing', 'costing'],
  ['/dispatch', 'dispatch'],
  ['/billing', 'billing'],
  ['/reports', 'billing'],
  ['/customers', 'billing'],
  ['/unit', 'production.work'],
  ['/invoices', 'billing'],
  ['/settings', 'administration'],
]

export function capabilityForPath(pathname: string): Capability | null {
  const path = pathname.toLowerCase()
  for (const [prefix, capability] of ROUTE_CAPABILITIES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return capability
  }
  return null
}

/** Production is shared: unit users work there, tiered admins monitor there. */
export function canOpenPath(user: Principal, pathname: string): boolean {
  const path = pathname.toLowerCase()
  if (path === '/production' || path.startsWith('/production/')) return canAny(user, ['production.monitor', 'production.work'])
  if (path === '/account' || path.startsWith('/account/')) return !!user
  if (path === '/home') return user?.role === 'admin'
  const capability = capabilityForPath(path)
  return capability ? can(user, capability) : !!user
}

export const ADMIN_TIER_LABEL: Record<AdminTier, string> = {
  full: 'Full workflow access',
  operations: 'Production, dispatch and billing',
  billing: 'Billing only',
}

export function describeAccess(user: Principal): string {
  if (!user) return 'Signed out'
  if (user.role === 'unit') return 'Own unit process work'
  return ADMIN_TIER_LABEL[user.adminTier ?? 'full']
}

/** Default tier for the three seeded administrator accounts. */
export function seedTierFor(userId: string, role: Role): AdminTier | null {
  if (role !== 'admin') return null
  if (userId.endsWith('ADM2')) return 'operations'
  if (userId.endsWith('ADM3')) return 'billing'
  return 'full'
}
