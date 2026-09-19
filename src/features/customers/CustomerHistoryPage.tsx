import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Contact, History, IndianRupee, PackageOpen, Search, ShoppingBag } from 'lucide-react'
import { useStore } from '../../store/store'
import { fmtDate, moneyPaise } from '../../lib/format'
import { customerHistory, searchCustomers } from '../../lib/customerHistory'
import type { CustomerHistory, OrderStage } from '../../lib/customerHistory'
import { Badge, Button, Card, CardHead, EmptyState, SearchInput, Select } from '../../components/ui'
import { Detail, PageHeader, StatStrip, StatTile, useDocumentTitle } from '../../components/page'
import { DocumentPreview, InvoiceDocActions } from '../../components/DocumentPreview'
import type { PreviewDoc } from '../../components/DocumentPreview'

const STAGE_TONE: Record<OrderStage, 'slate' | 'amber' | 'blue' | 'green'> = {
  'In production': 'blue',
  'Ready to dispatch': 'slate',
  'Partly dispatched': 'amber',
  'Fully dispatched': 'green',
}
const qty = (n: number, uom: string) => `${n.toLocaleString('en-IN')} ${uom}`

/**
 * Customer lookup: type a customer ID, name, GSTIN, phone, order ID or invoice
 * number and see that customer's whole history — every order from every year,
 * what was delivered and invoiced, and what they asked about but did not order.
 */
export function CustomerHistoryPage() {
  useDocumentTitle('Customers')
  const { db } = useStore()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const selectedId = params.get('id')
  const [preview, setPreview] = useState<PreviewDoc | null>(null)

  const set = (patch: Record<string, string | null>, push = false) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (!v) next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: !push })
  }

  const matches = useMemo(() => searchCustomers(db, q).map((c) => customerHistory(db, c)), [db, q])
  const selected = useMemo(() => {
    const c = db.customers.find((x) => x.id === selectedId)
    return c ? customerHistory(db, c) : null
  }, [db, selectedId])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Customers · History"
        title="Customer history"
        subtitle="Search by customer ID, name, GSTIN, phone, order ID or invoice number to see everything a customer has ordered — from any year."
        icon={<History className="h-4 w-4" />}
      />

      {selected ? (
        <CustomerDetail history={selected} year={params.get('year') ?? ''} onYear={(y) => set({ year: y })} onBack={() => set({ id: null, year: null }, true)} onPreview={setPreview} />
      ) : (
        <Card className="vx-anim-up overflow-hidden">
          <CardHead
            title="Customers"
            subtitle={`${matches.length} of ${db.customers.length} customers`}
            actions={<SearchInput value={q} onChange={(v) => set({ q: v })} placeholder="Customer ID, name, order ID…" className="w-full sm:w-80" />}
          />
          {db.customers.length === 0 ? (
            <EmptyState icon={<Contact className="h-6 w-6" />} title="No customers yet" message="Customers are added in Master → Customers. Each one gets a customer ID." />
          ) : matches.length === 0 ? (
            <EmptyState icon={<Search className="h-6 w-6" />} title="No customer matches" message="Try the customer ID (e.g. CUS-0001), part of the name, or an order ID." action={<Button variant="secondary" onClick={() => set({ q: null })}>Clear search</Button>} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr>
                    <th className="vx-th">Customer ID</th>
                    <th className="vx-th">Customer</th>
                    <th className="vx-th">GSTIN</th>
                    <th className="vx-th text-right">Orders</th>
                    <th className="vx-th text-right">Open</th>
                    <th className="vx-th text-right">Invoiced</th>
                    <th className="vx-th">Last order</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((h) => (
                    <tr key={h.customer.id} onClick={() => set({ id: h.customer.id }, true)} className="group cursor-pointer border-t border-rule transition-colors hover:bg-surface-2">
                      <td className="vx-td">
                        <Link to={`/customers?id=${h.customer.id}`} className="vx-code font-semibold text-accent-text group-hover:underline">
                          {h.customer.code}
                        </Link>
                      </td>
                      <td className="vx-td">
                        <Link to={`/customers?id=${h.customer.id}`} className="block">
                          {h.customer.company}
                          {h.customer.contactPerson ? <span className="block text-2xs text-faint">{h.customer.contactPerson}</span> : null}
                        </Link>
                      </td>
                      <td className="vx-td vx-code text-sm">{h.customer.gstin || '—'}</td>
                      <td className="vx-td vx-code text-right">{h.totalOrders}</td>
                      <td className="vx-td vx-code text-right">{h.openOrders}</td>
                      <td className="vx-td vx-code text-right">{moneyPaise(h.totalBilled)}</td>
                      <td className="vx-td">{h.lastOrder ? fmtDate(h.lastOrder) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <DocumentPreview doc={preview} onClose={() => setPreview(null)} />
    </div>
  )
}

function CustomerDetail({
  history: h,
  year,
  onYear,
  onBack,
  onPreview,
}: {
  history: CustomerHistory
  year: string
  onYear: (y: string) => void
  onBack: () => void
  onPreview: (d: PreviewDoc) => void
}) {
  const c = h.customer
  const orders = year ? h.orders.filter((o) => o.order.orderDate.startsWith(year)) : h.orders
  const enquiries = year ? h.enquiries.filter((e) => e.plan.orderDate.startsWith(year)) : h.enquiries

  return (
    <div className="space-y-6">
      <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />} onClick={onBack}>
        All customers
      </Button>

      <Card className="vx-anim-up p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="vx-code text-sm font-semibold text-accent-text">{c.code}</p>
            <h2 className="text-lg font-semibold text-ink">{c.company}</h2>
            <p className="text-sm text-muted">{[c.contactPerson, c.phone, c.email].filter(Boolean).join(' · ') || 'No contact details'}</p>
          </div>
          {!c.active ? <Badge tone="slate">Inactive</Badge> : null}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Detail label="GSTIN">{c.gstin || '—'}</Detail>
          <Detail label="Place of supply">{c.placeOfSupply || '—'}</Detail>
          <Detail label="Customer since">{h.firstOrder ? fmtDate(h.firstOrder) : '—'}</Detail>
          <Detail label="Payment terms">{c.paymentTerms || '—'}</Detail>
          <Detail label="Billing address" className="col-span-2">
            <span className="whitespace-pre-line">{c.billingAddress || '—'}</span>
          </Detail>
        </dl>
      </Card>

      <StatStrip className="grid-cols-2 lg:grid-cols-4">
        <StatTile label="Orders" value={String(h.totalOrders)} icon={<ShoppingBag className="h-4 w-4" />} tone="indigo" hint={h.lastOrder ? `Last on ${fmtDate(h.lastOrder)}` : 'None yet'} />
        <StatTile label="Open orders" value={String(h.openOrders)} icon={<PackageOpen className="h-4 w-4" />} tone="amber" hint="Not fully dispatched" />
        <StatTile label="Invoiced" value={moneyPaise(h.totalBilled)} icon={<IndianRupee className="h-4 w-4" />} tone="green" hint="All invoices, all years" />
        <StatTile label="Not ordered" value={String(h.enquiries.length)} icon={<History className="h-4 w-4" />} tone="slate" hint="Enquiries that did not become orders" />
      </StatStrip>

      <Card className="vx-anim-up overflow-hidden">
        <CardHead title="Products bought" subtitle="What this customer orders, how often and how much" />
        {h.products.length === 0 ? (
          <EmptyState icon={<ShoppingBag className="h-6 w-6" />} title="Nothing ordered yet" message="Products appear here once an order is released to production." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr>
                  <th className="vx-th">Product</th>
                  <th className="vx-th text-right">Times ordered</th>
                  <th className="vx-th text-right">Total quantity</th>
                  <th className="vx-th text-right">Invoiced</th>
                  <th className="vx-th">Last ordered</th>
                </tr>
              </thead>
              <tbody>
                {h.products.map((p) => (
                  <tr key={p.productId} className="border-t border-rule">
                    <td className="vx-td">{p.productName}</td>
                    <td className="vx-td vx-code text-right">{p.orders}</td>
                    <td className="vx-td vx-code text-right">{qty(p.quantity, p.uom)}</td>
                    <td className="vx-td vx-code text-right">{moneyPaise(p.billed)}</td>
                    <td className="vx-td">{fmtDate(p.lastOrdered)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="vx-anim-up overflow-hidden">
        <CardHead
          title="Order history"
          subtitle={`${orders.length} order(s)${year ? ` in ${year}` : ' · all years'} · newest first`}
          actions={
            <Select aria-label="Filter by year" value={year} onChange={(e) => onYear(e.target.value)} className="w-40">
              <option value="">All years</option>
              {h.years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          }
        />
        {orders.length === 0 ? (
          <EmptyState icon={<History className="h-6 w-6" />} title={year ? `No orders in ${year}` : 'No orders yet'} message="Orders appear here as soon as costing is finalized and production starts." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr>
                  <th className="vx-th">Order ID</th>
                  <th className="vx-th">Order date</th>
                  <th className="vx-th">Product</th>
                  <th className="vx-th text-right">Ordered</th>
                  <th className="vx-th text-right">Dispatched</th>
                  <th className="vx-th">Status</th>
                  <th className="vx-th text-right">Invoiced</th>
                  <th className="vx-th text-right">Invoices</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.order.id} className="border-t border-rule align-top">
                    <td className="vx-td vx-code font-semibold">
                      {o.order.code}
                      {o.order.customerRef ? <span className="block text-2xs font-normal text-faint">PO {o.order.customerRef}</span> : null}
                    </td>
                    <td className="vx-td">{fmtDate(o.order.orderDate)}</td>
                    <td className="vx-td">
                      {o.order.productName}
                      {o.order.dimensions ? <span className="block text-2xs text-faint">{o.order.dimensions}</span> : null}
                    </td>
                    <td className="vx-td vx-code text-right">{qty(o.order.quantity, o.order.uom)}</td>
                    <td className="vx-td vx-code text-right">
                      {qty(o.dispatchedQty, o.order.uom)}
                      {o.remainingQty > 0 && o.dispatchedQty > 0 ? <span className="block text-2xs text-faint">{qty(o.remainingQty, o.order.uom)} to go</span> : null}
                    </td>
                    <td className="vx-td">
                      <Badge tone={STAGE_TONE[o.stage]} dot>
                        {o.stage}
                      </Badge>
                    </td>
                    <td className="vx-td vx-code text-right">{o.billed ? moneyPaise(o.billed) : '—'}</td>
                    <td className="vx-td">
                      {o.invoices.length === 0 ? (
                        <span className="block text-right text-xs text-muted">No invoice yet</span>
                      ) : (
                        <div className="flex flex-col items-end gap-2">
                          {o.invoices.map((inv) => (
                            <div key={inv.id} className="flex flex-col items-end gap-0.5">
                              <span className="vx-code text-2xs text-muted">
                                {inv.number} · {fmtDate(inv.issueDate)} · {moneyPaise(inv.total)}
                              </span>
                              <InvoiceDocActions invoice={inv} onPreview={onPreview} downloadLabel="Download invoice" />
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {enquiries.length ? (
        <Card className="vx-anim-up overflow-hidden">
          <CardHead title="Asked but not ordered" subtitle="Plans for this customer that did not become production orders" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr>
                  <th className="vx-th">Plan</th>
                  <th className="vx-th">Date</th>
                  <th className="vx-th">Product</th>
                  <th className="vx-th text-right">Quantity</th>
                  <th className="vx-th">State</th>
                </tr>
              </thead>
              <tbody>
                {enquiries.map((e) => (
                  <tr key={e.plan.id} className="border-t border-rule">
                    <td className="vx-td vx-code">{e.plan.code}</td>
                    <td className="vx-td">{fmtDate(e.plan.orderDate)}</td>
                    <td className="vx-td">{e.productName}</td>
                    <td className="vx-td vx-code text-right">{e.plan.quantity.toLocaleString('en-IN')}</td>
                    <td className="vx-td">
                      <Badge tone={e.state === 'Cancelled' ? 'red' : 'slate'} dot>
                        {e.state}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  )
}
