import { useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Pin } from 'lucide-react'
import { useStore } from '../store/store'
import type { Plan, Priority } from '../lib/types'
import { cx } from '../lib/format'
import { PLAN_FILTER_LABEL, matchesFilter, sortPlans } from '../lib/planList'
import type { PlanFilter } from '../lib/planList'
import { setPlanPinned } from '../domain/planning'

const FILTER_KEY = 'vx.sidebar.planFilter'
const RECENT_LIMIT = 15
const PRIORITY_DOT: Record<Priority, string> = { Urgent: 'bg-risk', High: 'bg-warn', Normal: 'bg-live', Low: 'bg-faint' }

function readFilter(): PlanFilter {
  try {
    const v = localStorage.getItem(FILTER_KEY)
    return v === 'open' || v === 'urgent' || v === 'high' ? v : 'all'
  } catch {
    return 'all'
  }
}

/**
 * Plans in the sidebar, like a chat list: pinned plans on top, then the most
 * recently touched. Click a plan to open it; pin the ones that matter now.
 */
export function RecentPlans() {
  const { db, run, pushToast } = useStore()
  const [filter, setFilter] = useState<PlanFilter>(readFilter)

  const plans = useMemo(() => {
    const sorted = sortPlans(db.plans.filter((p) => matchesFilter(p, filter)))
    const pinned = sorted.filter((p) => p.pinned)
    return [...pinned, ...sorted.filter((p) => !p.pinned).slice(0, RECENT_LIMIT)]
  }, [db.plans, filter])
  const pinnedCount = plans.filter((p) => p.pinned).length

  const choose = (f: PlanFilter) => {
    setFilter(f)
    try {
      localStorage.setItem(FILTER_KEY, f)
    } catch {
      /* storage blocked — the filter lasts until the page closes */
    }
  }

  const togglePin = async (plan: Plan) => {
    const r = await run(setPlanPinned(plan.id, !plan.pinned))
    if (!r.ok) pushToast({ title: 'Could not change the pin', message: r.error, level: 'danger' })
  }

  const label = (p: Plan) => {
    const customer = db.customers.find((c) => c.id === p.customerId)?.company
    const product = db.products.find((x) => x.id === p.productId)?.name
    return [customer, product].filter(Boolean).join(' · ') || p.code
  }

  return (
    <section aria-label="Plans" className="mt-4 border-t border-rule pt-3">
      <div className="flex items-center justify-between gap-2 px-3 pb-1.5">
        <NavLink to="/planning" className="vx-focus vx-mono-label rounded-xs hover:text-ink">
          Plans
        </NavLink>
        <select
          aria-label="Filter plans in the sidebar"
          value={filter}
          onChange={(e) => choose(e.target.value as PlanFilter)}
          className="vx-focus cursor-pointer rounded-xs bg-transparent text-2xs font-medium text-muted hover:text-ink"
        >
          {(Object.keys(PLAN_FILTER_LABEL) as PlanFilter[]).map((f) => (
            <option key={f} value={f}>
              {PLAN_FILTER_LABEL[f]}
            </option>
          ))}
        </select>
      </div>

      {plans.length === 0 ? (
        <p className="px-3 py-2 text-xs text-faint">{filter === 'all' ? 'No plans yet.' : 'No plans match this filter.'}</p>
      ) : (
        <ul className="space-y-0.5">
          {plans.map((p, i) => (
            <li key={p.id} className={cx('group relative', i === pinnedCount && pinnedCount > 0 && 'mt-2 border-t border-rule pt-2')}>
              <NavLink
                to={`/planning/${p.id}`}
                title={`${p.code} · ${label(p)} · ${p.priority} · ${p.status}`}
                className={({ isActive }) =>
                  cx('vx-press vx-focus block rounded-md py-1.5 pl-3 pr-9', isActive ? 'bg-surface-3 text-ink' : 'text-muted hover:bg-surface-2 hover:text-ink')
                }
              >
                <span className="flex items-center gap-1.5">
                  <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', PRIORITY_DOT[p.priority])} aria-hidden="true" />
                  <span className="vx-code truncate text-xs font-semibold text-ink-2">{p.code}</span>
                  {p.status === 'Cancelled' ? <span className="text-2xs text-faint">cancelled</span> : null}
                </span>
                <span className="block truncate text-sm">{label(p)}</span>
                <span className="sr-only">
                  {p.priority} priority, {p.status}
                </span>
              </NavLink>
              <button
                type="button"
                onClick={() => togglePin(p)}
                aria-label={p.pinned ? `Unpin ${p.code}` : `Pin ${p.code}`}
                title={p.pinned ? 'Unpin' : 'Pin to top'}
                className={cx(
                  'vx-focus absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-faint hover:bg-surface-3 hover:text-ink',
                  p.pinned ? 'text-accent-text' : 'opacity-0 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100',
                )}
              >
                {p.pinned ? <Pin className="h-3.5 w-3.5 fill-current" /> : <Pin className="h-3.5 w-3.5" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
