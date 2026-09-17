import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarRange, CircleDashed, Factory, FileClock, Plus, Search, XCircle } from 'lucide-react'
import { useStore } from '../../store/store'
import type { PlanStatus } from '../../lib/types'
import { fmtDate, pieces } from '../../lib/format'
import { Button, Card, CardHead, EmptyState, SearchInput, Select } from '../../components/ui'
import { LinkButton, PageHeader, StatStrip, StatTile, useDocumentTitle } from '../../components/page'
import { PlanStatusBadge, PriorityBadge } from '../../components/status'

export function PlanningPage() {
  useDocumentTitle('Planning')
  const { db } = useStore()
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') ?? 'open') as PlanStatus | 'open' | 'all'
  const q = params.get('q') ?? ''
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v && !(k === 'status' && v === 'open')) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }

  const count = (s: PlanStatus) => db.plans.filter((p) => p.status === s).length
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return db.plans
      .filter((p) => (status === 'all' ? true : status === 'open' ? p.status === 'Draft' || p.status === 'Ready for Costing' : p.status === status))
      .map((p) => ({
        plan: p,
        customer: db.customers.find((c) => c.id === p.customerId),
        product: db.products.find((x) => x.id === p.productId),
        order: db.orders.find((o) => o.id === p.orderId),
      }))
      .filter((r) => !term || `${r.plan.code} ${r.customer?.company ?? ''} ${r.product?.name ?? ''} ${r.plan.customerRef}`.toLowerCase().includes(term))
      .sort((a, b) => b.plan.createdAt.localeCompare(a.plan.createdAt))
  }, [db, status, q])

  const canPlan = db.products.some((p) => p.active) && db.customers.some((c) => c.active)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations · Step 1"
        title="Planning"
        subtitle="Plan an order for a customer: product, quantity, dates and a production unit for every process. Stages and processes come from Master and are read-only here."
        icon={<CalendarRange className="h-4 w-4" />}
        actions={
          canPlan ? (
            <LinkButton to="/planning/new" icon={<Plus className="h-4 w-4" />}>
              New plan
            </LinkButton>
          ) : null
        }
      />

      <StatStrip className="grid-cols-2 lg:grid-cols-4">
        <StatTile label="Draft" value={String(count('Draft'))} icon={<CircleDashed className="h-4 w-4" />} tone="slate" hint="Being prepared" onClick={() => set('status', 'Draft')} active={status === 'Draft'} />
        <StatTile label="Ready for costing" value={String(count('Ready for Costing'))} icon={<FileClock className="h-4 w-4" />} tone="indigo" hint="Waiting in Costing" onClick={() => set('status', 'Ready for Costing')} active={status === 'Ready for Costing'} />
        <StatTile label="In production" value={String(count('In Production'))} icon={<Factory className="h-4 w-4" />} tone="blue" hint="Costing finalized" onClick={() => set('status', 'In Production')} active={status === 'In Production'} />
        <StatTile label="Cancelled" value={String(count('Cancelled'))} icon={<XCircle className="h-4 w-4" />} tone="red" hint="Not produced" onClick={() => set('status', 'Cancelled')} active={status === 'Cancelled'} />
      </StatStrip>

      <Card className="vx-anim-up overflow-hidden">
        <CardHead
          title="Plans"
          subtitle={`${rows.length} shown`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput value={q} onChange={(v) => set('q', v)} placeholder="Search plan, customer, product…" className="w-full sm:w-64" />
              <Select aria-label="Filter plans" value={status} onChange={(e) => set('status', e.target.value)} className="w-full sm:w-48">
                <option value="open">Open (draft & ready)</option>
                <option value="Draft">Draft</option>
                <option value="Ready for Costing">Ready for costing</option>
                <option value="In Production">In production</option>
                <option value="Cancelled">Cancelled</option>
                <option value="all">All plans</option>
              </Select>
            </div>
          }
        />
        {!canPlan ? (
          <EmptyState
            icon={<CalendarRange className="h-6 w-6" />}
            title="Master setup needed before planning"
            message={`Planning needs at least one active product and one active customer. ${db.products.length ? '' : 'No products yet. '}${db.customers.length ? '' : 'No customers yet.'}`}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <LinkButton to="/master/products" variant="secondary">
                  Master → Products
                </LinkButton>
                <LinkButton to="/master/customers" variant="secondary">
                  Master → Customers
                </LinkButton>
              </div>
            }
          />
        ) : db.plans.length === 0 ? (
          <EmptyState
            icon={<CalendarRange className="h-6 w-6" />}
            title="No plans yet"
            message="Create the first plan to send an order to costing."
            action={<LinkButton to="/planning/new" icon={<Plus className="h-4 w-4" />}>New plan</LinkButton>}
          />
        ) : rows.length === 0 ? (
          <EmptyState icon={<Search className="h-6 w-6" />} title="No plans match" message="Choose another status or clear the search." action={<Button variant="secondary" onClick={() => setParams(new URLSearchParams({ status: 'all' }), { replace: true })}>Show all plans</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr>
                  <th className="vx-th">Plan</th>
                  <th className="vx-th">Customer</th>
                  <th className="vx-th">Product</th>
                  <th className="vx-th text-right">Quantity</th>
                  <th className="vx-th">Delivery</th>
                  <th className="vx-th">Units by stage</th>
                  <th className="vx-th">Priority</th>
                  <th className="vx-th">Status</th>
                  <th className="vx-th text-right">Next step</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ plan, customer, product, order }) => {
                  // Allocation is per process; show the distinct units the plan spans.
                  const units = product ? [...new Set(product.stages.flatMap((s) => s.processes.map((pr) => plan.processUnits[pr.id])).filter(Boolean))] : []
                  return (
                    <tr key={plan.id} className="vx-row">
                      <td className="vx-td">
                        <Link to={`/planning/${plan.id}`} className="vx-code vx-focus rounded-xs font-semibold text-accent-text hover:underline">
                          {plan.code}
                        </Link>
                        <span className="block text-2xs text-faint">{fmtDate(plan.createdAt)} · {plan.createdBy}</span>
                      </td>
                      <td className="vx-td vx-td-wrap font-medium text-ink">{customer?.company ?? '—'}</td>
                      <td className="vx-td vx-td-wrap">{product?.name ?? '—'}</td>
                      <td className="vx-td text-right tabular-nums">{pieces(plan.quantity)}</td>
                      <td className="vx-td">{fmtDate(plan.deliveryDate, 'dd MMM yy')}</td>
                      <td className="vx-td vx-code text-xs">{units.join(' → ') || '—'}</td>
                      <td className="vx-td">
                        <PriorityBadge priority={plan.priority} />
                      </td>
                      <td className="vx-td">
                        <PlanStatusBadge status={plan.status} />
                      </td>
                      <td className="vx-td text-right">
                        {plan.status === 'Draft' ? (
                          <LinkButton to={`/planning/${plan.id}`} size="sm" variant="secondary">
                            Continue
                          </LinkButton>
                        ) : plan.status === 'Ready for Costing' ? (
                          <LinkButton to={`/costing/${plan.id}`} size="sm">
                            Open costing
                          </LinkButton>
                        ) : plan.status === 'In Production' && order ? (
                          <LinkButton to={`/production?job=${order.id}`} size="sm" variant="secondary">
                            {order.code}
                          </LinkButton>
                        ) : (
                          <LinkButton to={`/planning/${plan.id}`} size="sm" variant="ghost">
                            View
                          </LinkButton>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
