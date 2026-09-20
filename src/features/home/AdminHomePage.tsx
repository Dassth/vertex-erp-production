import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { AlertTriangle, CalendarRange, Factory, Home, IndianRupee, PackageCheck, Pin, ReceiptText, ShoppingCart } from 'lucide-react'
import { useStore } from '../../store/store'
import { fmtDate, fromNow, moneyPaise, pieces } from '../../lib/format'
import { allJobViews } from '../../lib/selectors'
import { isReceived } from '../../lib/billing'
import { purchaseTotals } from '../../lib/gst'
import { fromPaise, toPaise } from '../../lib/costing'
import { sortPlans } from '../../lib/planList'
import { describeAccess } from '../../lib/permissions'
import { Card, CardHead, EmptyState } from '../../components/ui'
import { QuickAccessBar } from '../../components/QuickAccess'
import { LinkButton, PageHeader, StatStrip, StatTile, useDocumentTitle } from '../../components/page'
import { HealthBadge, PriorityBadge } from '../../components/status'

interface Attention {
  key: string
  tone: 'risk' | 'warn'
  text: string
  to: string
}

/**
 * The administrator's start page. Every panel follows the account's access:
 * Administrator 1 sees the whole workflow, Administrator 2 production, dispatch
 * and billing, Administrator 3 billing only.
 */
export function AdminHomePage() {
  useDocumentTitle('Home')
  const { db, user, can } = useStore()
  const now = new Date()
  const month = format(now, 'yyyy-MM')
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const views = useMemo(() => allJobViews(db), [db])
  const active = views.filter((v) => v.order.status !== 'Completed')
  const delayed = active.filter((v) => v.health === 'Delayed' || v.health === 'At Risk')
  const readyToDispatch = db.orders.filter((o) => o.status === 'Completed' && db.dispatches.filter((d) => d.orderId === o.id).reduce((s, d) => s + d.quantity, 0) < o.completedQty)
  const awaiting = db.dispatches.filter((d) => !isReceived(d))
  const openPlans = db.plans.filter((p) => p.status === 'Draft' || p.status === 'Ready for Costing')
  const urgentPlans = openPlans.filter((p) => p.priority === 'Urgent')
  const pinned = sortPlans(db.plans.filter((p) => p.pinned))
  const monthInvoices = db.invoices.filter((i) => i.issueDate.startsWith(month))
  const invoiced = fromPaise(monthInvoices.reduce((s, i) => s + toPaise(i.total), 0))
  const monthPurchases = (db.purchases ?? []).filter((b) => b.date.startsWith(month))
  const purchased = fromPaise(monthPurchases.reduce((s, b) => s + toPaise(purchaseTotals(b, db.company.gstin).net), 0))
  const problems = active.flatMap((v) => v.order.stages.flatMap((s) => s.processes.filter((p) => p.problem && p.status !== 'Completed').map((p) => ({ order: v.order, process: p }))))

  const attention: Attention[] = [
    ...(can('production.monitor')
      ? [
          ...problems.map((x) => ({ key: `p-${x.process.id}`, tone: 'risk' as const, text: `${x.order.code} · ${x.process.name}: ${x.process.problem}`, to: `/production?job=${x.order.id}` })),
          ...delayed.map((v) => ({ key: `d-${v.order.id}`, tone: v.health === 'Delayed' ? ('risk' as const) : ('warn' as const), text: `${v.order.code} is ${v.health.toLowerCase()} — due ${fmtDate(v.order.deliveryDate)}`, to: `/production?job=${v.order.id}` })),
        ]
      : []),
    ...(can('dispatch')
      ? awaiting.map((d) => {
          const o = db.orders.find((x) => x.id === d.orderId)
          return { key: `a-${d.id}`, tone: 'warn' as const, text: `${d.code} (${o?.code ?? ''}) dispatched ${fmtDate(d.date)} — confirm it was received`, to: `/dispatch?order=${d.orderId}` }
        })
      : []),
    ...(can('planning') ? urgentPlans.map((p) => ({ key: `u-${p.id}`, tone: 'warn' as const, text: `${p.code} is urgent and still ${p.status.toLowerCase()}`, to: `/planning/${p.id}` })) : []),
  ].slice(0, 10)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Home · ${format(now, 'EEEE, dd MMM yyyy')}`}
        title={`${greeting}, ${user?.name ?? ''}`}
        subtitle={`${describeAccess(user)}. Here is what needs you today.`}
        icon={<Home className="h-4 w-4" />}
      />

      <StatStrip className="grid-cols-2 lg:grid-cols-4">
        {can('planning') ? <StatTile label="Open plans" value={String(openPlans.length)} icon={<CalendarRange className="h-4 w-4" />} tone="indigo" hint={`${urgentPlans.length} urgent`} /> : null}
        {can('production.monitor') ? <StatTile label="In production" value={String(active.length)} icon={<Factory className="h-4 w-4" />} tone="blue" hint={`${delayed.length} delayed or at risk`} /> : null}
        {can('dispatch') ? <StatTile label="Ready to dispatch" value={String(readyToDispatch.length)} icon={<PackageCheck className="h-4 w-4" />} tone="green" hint={`${awaiting.length} awaiting receipt`} /> : null}
        {can('billing') ? <StatTile label={`Invoiced in ${format(now, 'MMM')}`} value={moneyPaise(invoiced)} icon={<IndianRupee className="h-4 w-4" />} tone="green" hint={`${monthInvoices.length} invoice(s)`} /> : null}
        {can('billing') && !can('dispatch') ? <StatTile label={`Purchases in ${format(now, 'MMM')}`} value={moneyPaise(purchased)} icon={<ShoppingCart className="h-4 w-4" />} tone="amber" hint={`${monthPurchases.length} bill(s)`} /> : null}
      </StatStrip>

      <Card className="vx-anim-up relative z-10 p-4">
        <QuickAccessBar />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="vx-anim-up overflow-hidden">
          <CardHead title="Needs attention" subtitle="Problems reported by units, late jobs, unconfirmed deliveries and urgent plans" />
          {attention.length === 0 ? (
            <EmptyState icon={<AlertTriangle className="h-6 w-6" />} title="All clear" message="Nothing needs your attention right now." />
          ) : (
            <ul className="divide-y divide-rule">
              {attention.map((a) => (
                <li key={a.key}>
                  <Link to={a.to} className="vx-focus flex items-start gap-2.5 px-5 py-3 text-sm hover:bg-surface-2">
                    <AlertTriangle className={a.tone === 'risk' ? 'mt-0.5 h-4 w-4 shrink-0 text-risk' : 'mt-0.5 h-4 w-4 shrink-0 text-warn'} aria-hidden="true" />
                    <span className="text-ink-2">{a.text}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {can('production.monitor') ? (
          <Card className="vx-anim-up overflow-hidden">
            <CardHead title="Jobs in production" subtitle="Progress by processes completed" actions={<LinkButton to="/production" size="sm" variant="secondary">Open</LinkButton>} />
            {active.length === 0 ? (
              <EmptyState icon={<Factory className="h-6 w-6" />} title="No jobs in production" message="Jobs appear here once costing is finalized." />
            ) : (
              <ul className="divide-y divide-rule">
                {active.slice(0, 8).map((v) => (
                  <li key={v.order.id}>
                    <Link to={`/production?job=${v.order.id}`} className="vx-focus block px-5 py-3 hover:bg-surface-2">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="vx-code text-sm font-semibold text-ink">{v.order.code}</span>
                        <HealthBadge health={v.health} />
                        <PriorityBadge priority={v.order.priority} />
                        <span className="ml-auto text-xs text-muted">
                          {v.doneProcesses}/{v.totalProcesses} processes
                        </span>
                      </span>
                      <span className="block truncate text-sm text-ink-2">
                        {v.order.customer.company} · {v.order.productName} · {pieces(v.order.quantity)}
                      </span>
                      <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-surface-3">
                        <span className="block h-full rounded-full bg-accent" style={{ width: `${v.totalProcesses ? (v.doneProcesses / v.totalProcesses) * 100 : 0}%` }} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : can('billing') ? (
          <Card className="vx-anim-up overflow-hidden">
            <CardHead title="Latest invoices" subtitle="Most recently issued" actions={<LinkButton to="/billing" size="sm" variant="secondary">Billing</LinkButton>} />
            {db.invoices.length === 0 ? (
              <EmptyState icon={<ReceiptText className="h-6 w-6" />} title="No invoices yet" message="Invoices are issued when dispatches are confirmed." />
            ) : (
              <ul className="divide-y divide-rule">
                {[...db.invoices]
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .slice(0, 8)
                  .map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                      <span>
                        <span className="vx-code font-semibold text-ink">{i.number}</span>
                        <span className="block text-2xs text-faint">
                          {i.customer.company} · {fmtDate(i.issueDate)}
                        </span>
                      </span>
                      <span className="vx-code">{moneyPaise(i.total)}</span>
                    </li>
                  ))}
              </ul>
            )}
          </Card>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {can('planning') ? (
          <Card className="vx-anim-up overflow-hidden">
            <CardHead title="Pinned plans" subtitle="Plans your team has pinned as priorities" actions={<LinkButton to="/planning" size="sm" variant="secondary">Planning</LinkButton>} />
            {pinned.length === 0 ? (
              <EmptyState icon={<Pin className="h-6 w-6" />} title="Nothing pinned" message="Pin a plan from the sidebar or Planning to keep it here." />
            ) : (
              <ul className="divide-y divide-rule">
                {pinned.map((p) => (
                  <li key={p.id}>
                    <Link to={`/planning/${p.id}`} className="vx-focus flex items-center justify-between gap-3 px-5 py-2.5 text-sm hover:bg-surface-2">
                      <span>
                        <span className="vx-code font-semibold text-ink">{p.code}</span>
                        <span className="block text-2xs text-faint">
                          {db.customers.find((c) => c.id === p.customerId)?.company} · {db.products.find((x) => x.id === p.productId)?.name}
                        </span>
                      </span>
                      <PriorityBadge priority={p.priority} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : null}

        {can('administration') ? (
          <Card className="vx-anim-up overflow-hidden">
            <CardHead title="Recent activity" subtitle="Latest actions across the system" />
            {db.audit.length === 0 ? (
              <EmptyState icon={<Home className="h-6 w-6" />} title="No activity yet" message="Actions appear here as your team works." />
            ) : (
              <ul className="divide-y divide-rule">
                {db.audit.slice(0, 8).map((a) => (
                  <li key={a.id} className="px-5 py-2.5 text-sm">
                    <span className="text-ink-2">
                      <span className="font-medium text-ink">{a.user}</span> · {a.action} · {a.entityLabel}
                    </span>
                    <span className="block text-2xs text-faint">{fromNow(a.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : null}
      </div>
    </div>
  )
}
