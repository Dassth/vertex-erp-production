/* ---------------------------------------------------------------------------
 * How plans are ordered and filtered — shared by the sidebar list and the
 * Planning page, so both show the same plans in the same order.
 *
 * Pinned plans always come first (most recently pinned on top); the chosen
 * sort applies within the pinned and the unpinned groups.
 * ------------------------------------------------------------------------- */

import type { Plan, Priority } from './types'

export const PRIORITY_RANK: Record<Priority, number> = { Urgent: 0, High: 1, Normal: 2, Low: 3 }

export type PlanSort = 'recent' | 'priority' | 'delivery'
/** all · open (not in production and not cancelled) · urgent · high (urgent + high) */
export type PlanFilter = 'all' | 'open' | 'urgent' | 'high'

export const PLAN_FILTER_LABEL: Record<PlanFilter, string> = {
  all: 'All plans',
  open: 'Open plans',
  urgent: 'Urgent only',
  high: 'Urgent & high',
}

export function matchesFilter(p: Plan, f: PlanFilter): boolean {
  if (f === 'open') return p.status === 'Draft' || p.status === 'Ready for Costing'
  if (f === 'urgent') return p.priority === 'Urgent'
  if (f === 'high') return p.priority === 'Urgent' || p.priority === 'High'
  return true
}

const recent = (p: Plan) => p.updatedAt || p.createdAt

export function sortPlans<T extends Plan>(plans: T[], sort: PlanSort = 'recent'): T[] {
  const within = (a: T, b: T) => {
    if (sort === 'priority') return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.deliveryDate.localeCompare(b.deliveryDate) || recent(b).localeCompare(recent(a))
    if (sort === 'delivery') return a.deliveryDate.localeCompare(b.deliveryDate) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    return recent(b).localeCompare(recent(a))
  }
  return [...plans].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1
    if (a.pinned && b.pinned) return (b.pinnedAt ?? '').localeCompare(a.pinnedAt ?? '') || within(a, b)
    return within(a, b)
  })
}
