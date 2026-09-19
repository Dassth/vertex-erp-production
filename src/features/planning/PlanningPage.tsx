import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarRange, CircleDashed, ClipboardList, Eye, Factory, FileClock, Pin, Plus, Search, XCircle } from 'lucide-react'
import { useStore } from '../../store/store'
import type { Plan, PlanStatus, Priority } from '../../lib/types'
import { fmtDate, pieces } from '../../lib/format'
import { Button, Card, CardHead, EmptyState, SearchInput, Select } from '../../components/ui'
import { LinkButton, PageHeader, StatStrip, StatTile, useDocumentTitle } from '../../components/page'
import { PlanStatusBadge, PriorityBadge } from '../../components/status'
import { DocumentPreview, DownloadButton, jobCardDoc, useLatestDb } from '../../components/DocumentPreview'
import type { PreviewDoc } from '../../components/DocumentPreview'
import { cx } from '../../lib/format'
import { sortPlans } from '../../lib/planList'
import type { PlanSort } from '../../lib/planList'
import { setPlanPinned } from '../../domain/planning'

const PRIORITIES: Priority[] = ['Urgent', 'High', 'Normal', 'Low']

export function PlanningPage() {
  useDocumentTitle('Planning')
  const { db, run, pushToast } = useStore()
  const read = useLatestDb()
  const [params, setParams] = useSearchParams()
  const [preview, setPreview] = useState<PreviewDoc | null>(null)
  const status = (params.get('status') ?? 'open') as PlanStatus | 'open' | 'all'
  const q = params.get('q') ?? ''
  const priority = (params.get('priority') ?? '') as Priority | '' | 'high'
  const sort = (['priority', 'delivery'].includes(params.get('sort') ?? '') ? params.get('sort') : 'recent') as PlanSort
  const togglePin = async (plan: Plan) => {
    const r = await run(setPlanPinned(plan.id, !plan.pinned))
    if (!r.ok) pushToast({ title: 'Could not change the pin', message: r.error, level: 'danger' })
  }
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v && !(k === 'status' && v === 'open')) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }

  const count = (s: PlanStatus) => db.plans.filter((p) => p.status === s).length
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    const byPriority = (p: Plan) => !priority || (priority === 'high' ? p.priority === 'Urgent' || p.priority === 'High' : p.priority === priority)
    return sortPlans(
      db.plans.filter((p) => (status === 'all' ? true : status === 'open' ? p.status === 'Draft' || p.status === 'Ready for Costing' : p.status === status) && byPriority(p)),
      sort,
    )
      .map((p) => ({
        plan: p,
        customer: db.customers.find((c) => c.id === p.customerId),
        product: db.products.find((x) => x.id === p.productId),
        order: db.orders.find((o) => o.id === p.orderId),
      }))
      .filter((r) => !term || `${r.plan.code} ${r.customer?.company ?? ''} ${r.customer?.code ?? ''} ${r.product?.name ?? ''} ${r.plan.customerRef} ${r.order?.code ?? ''}`.toLowerCase().includes(term))
  }, [db, status, q, priority, sort])

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
          subtitle={`${rows.length} shown · pinned plans stay on top`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput value={q} onChange={(v) => set('q', v)} placeholder="Search plan, customer, product…" className="w-full sm:w-64" />
              <Select aria-label="Filter by priority" value={priority} onChange={(e) => set('priority', e.target.value)} className="w-full sm:w-40">
                <option value="">All priorities</option>
                <option value="high">Urgent & high</option>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p} only
                  </option>
                ))}
              </Select>
              <Select aria-label="Sort plans" value={sort} onChange={(e) => set('sort', e.target.value === 'recent' ? '' : e.target.value)} className="w-full sm:w-44">
                <option value="recent">Newest first</option>
                <option value="priority">Priority first</option>
                <option value="delivery">Delivery date</option>
              </Select>
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
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr>
                  <th className="vx-th w-10">
                    <span className="sr-only">Pin</span>
                  </th>
                  <th className="vx-th">Plan</th>
                  <th className="vx-th">Customer</th>
                  <th className="vx-th">Product</th>
                  <th className="vx-th text-right">Quantity</th>
                  <th className="vx-th">Delivery</th>
                  <th className="vx-th">Units by stage</th>
                  <th className="vx-th">Priority</th>
                  <th className="vx-th">Status</th>
                  <th className="vx-th text-right">Job card</th>
                  <th className="vx-th text-right">Next step</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ plan, customer, product, order }) => {
                  // Allocation is per process; show the distinct units the plan spans.
                  const units = product ? [...new Set(product.stages.flatMap((s) => s.processes.map((pr) => plan.processUnits[pr.id])).filter(Boolean))] : []
                  return (
                    <tr key={plan.id} className={cx('vx-row', plan.pinned && 'bg-accent-wash/40')}>
                      <td className="vx-td">
                        <button
                          type="button"
                          onClick={() => togglePin(plan)}
                          aria-label={plan.pinned ? `Unpin ${plan.code}` : `Pin ${plan.code}`}
                          title={plan.pinned ? 'Unpin' : 'Pin to top'}
                          className={cx('vx-focus flex h-8 w-8 items-center justify-center rounded-md hover:bg-surface-3', plan.pinned ? 'text-accent-text' : 'text-faint')}
                        >
                          <Pin className={cx('h-4 w-4', plan.pinned && 'fill-current')} />
                        </button>
                      </td>
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
                      <td className="vx-td">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => setPreview(jobCardDoc(read, plan.id))} aria-label={`Preview job card ${plan.code}`}>
                            <span className="sr-only">Preview</span>
                          </Button>
                          <DownloadButton size="sm" variant="secondary" icon={<ClipboardList className="h-3.5 w-3.5" />} doc={() => jobCardDoc(read, plan.id)} aria-label={`Download job card ${plan.code}`}>
                            Job card
                          </DownloadButton>
                        </div>
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
      <DocumentPreview doc={preview} onClose={() => setPreview(null)} />
    </div>
  )
}
