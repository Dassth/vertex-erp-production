import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Calculator, CheckCircle2, FileClock, IndianRupee, PencilRuler } from 'lucide-react'
import { useStore } from '../../store/store'
import { previewCosting } from '../../domain/orderCosting'
import { computeOrderCosting } from '../../lib/costing'
import { defaultCostingInputs } from '../../domain/orderCosting'
import { fmtDate, money, moneyShort, pieces } from '../../lib/format'
import { Badge, Card, CardHead, EmptyState } from '../../components/ui'
import { LinkButton, PageHeader, StatStrip, StatTile, useDocumentTitle } from '../../components/page'
import { CostingStatusBadge } from '../../components/status'

export function CostingListPage() {
  useDocumentTitle('Order costing')
  const { db } = useStore()

  const rows = useMemo(
    () =>
      db.plans
        .filter((p) => p.status === 'Ready for Costing' || p.status === 'In Production')
        .map((plan) => {
          const costing = db.costings.find((c) => c.planId === plan.id)
          const product = db.products.find((p) => p.id === plan.productId)
          const result = costing
            ? previewCosting(db, costing)
            : product
              ? computeOrderCosting({
                  quantity: plan.quantity,
                  product: { productId: product.id, stages: product.stages, materials: product.materials },
                  materials: db.materials,
                  settings: db.settings,
                  inputs: defaultCostingInputs(db, product, () => 'x'),
                })
              : null
          return {
            plan,
            costing,
            result,
            customer: costing?.snapshot?.customer.company ?? db.customers.find((c) => c.id === plan.customerId)?.company ?? '—',
            product: costing?.snapshot?.product.name ?? product?.name ?? '—',
          }
        })
        .sort((a, b) => Number(a.costing?.status === 'Finalized') - Number(b.costing?.status === 'Finalized') || b.plan.updatedAt.localeCompare(a.plan.updatedAt)),
    [db],
  )

  const awaiting = rows.filter((r) => r.costing?.status !== 'Finalized')
  const finalized = rows.filter((r) => r.costing?.status === 'Finalized')
  const blocked = awaiting.filter((r) => r.result && !r.result.valid).length

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations · Step 2"
        title="Order costing"
        subtitle={
          <>
            Calculate and finalize the costing of one planned order. Shared material prices and charges are maintained in{' '}
            <Link to="/master/costing" className="vx-focus rounded-xs font-medium text-accent-text hover:underline">
              Master → Costing
            </Link>
            ; finalizing freezes a snapshot and releases the order to production.
          </>
        }
        icon={<Calculator className="h-4 w-4" />}
      />

      <StatStrip className="grid-cols-2 lg:grid-cols-4">
        <StatTile label="Awaiting costing" value={String(awaiting.length)} icon={<FileClock className="h-4 w-4" />} tone="indigo" hint="Plans ready for costing" />
        <StatTile label="Missing inputs" value={String(blocked)} icon={<PencilRuler className="h-4 w-4" />} tone="amber" hint="Cannot finalize yet" />
        <StatTile label="Finalized" value={String(finalized.length)} icon={<CheckCircle2 className="h-4 w-4" />} tone="green" hint="Released to production" />
        <StatTile label="Finalized value" value={moneyShort(finalized.reduce((s, r) => s + (r.result?.grandTotal ?? 0), 0))} icon={<IndianRupee className="h-4 w-4" />} tone="violet" hint="Customer amount incl. tax" />
      </StatStrip>

      <Card className="vx-anim-up overflow-hidden">
        <CardHead title="Plans for costing" subtitle="Plans appear here after “Send to costing” in Planning" />
        {rows.length === 0 ? (
          <EmptyState
            icon={<Calculator className="h-6 w-6" />}
            title="Nothing to cost yet"
            message="Create a plan, assign a unit to every stage and send it to costing."
            action={<LinkButton to="/planning">Open Planning</LinkButton>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr>
                  <th className="vx-th">Plan</th>
                  <th className="vx-th">Customer</th>
                  <th className="vx-th">Product</th>
                  <th className="vx-th text-right">Quantity</th>
                  <th className="vx-th">Costing</th>
                  <th className="vx-th">Readiness</th>
                  <th className="vx-th text-right">Customer amount</th>
                  <th className="vx-th text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ plan, costing, result, customer, product }) => {
                  const errors = result?.issues.filter((i) => i.level === 'error').length ?? 0
                  const done = costing?.status === 'Finalized'
                  return (
                    <tr key={plan.id} className="vx-row">
                      <td className="vx-td">
                        <span className="vx-code block font-semibold text-ink">{plan.code}</span>
                        <span className="block text-2xs text-faint">delivery {fmtDate(plan.deliveryDate, 'dd MMM yy')}</span>
                      </td>
                      <td className="vx-td vx-td-wrap font-medium text-ink">{customer}</td>
                      <td className="vx-td vx-td-wrap">{product}</td>
                      <td className="vx-td text-right tabular-nums">{pieces(plan.quantity)}</td>
                      <td className="vx-td">
                        <span className="vx-code block text-xs text-muted">{costing?.code ?? '—'}</span>
                        <CostingStatusBadge status={costing?.status ?? 'Not started'} />
                      </td>
                      <td className="vx-td">
                        {done ? (
                          <Badge tone="green">Snapshot saved</Badge>
                        ) : errors ? (
                          <Badge tone="amber">{errors} missing input(s)</Badge>
                        ) : (
                          <Badge tone="indigo">Ready to finalize</Badge>
                        )}
                      </td>
                      <td className="vx-td text-right font-semibold tabular-nums text-ink">{result && (done || !errors) ? money(result.grandTotal) : '—'}</td>
                      <td className="vx-td text-right">
                        <LinkButton to={`/costing/${plan.id}`} size="sm" variant={done ? 'secondary' : 'primary'}>
                          {done ? 'View' : 'Open costing'}
                        </LinkButton>
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
