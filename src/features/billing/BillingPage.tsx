import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, Download, Eye, FileStack, PackageCheck, ReceiptText, Search, Truck } from 'lucide-react'
import { useStore } from '../../store/store'
import type { VertexDB } from '../../lib/types'
import { fmtDate, fmtDateTime, moneyPaise, moneyShort } from '../../lib/format'
import { DELIVERY_PENDING_MESSAGE, isReceived, orderInvoiceSummary } from '../../lib/billing'
import type { OrderInvoiceStatus, OrderInvoiceSummary } from '../../lib/billing'
import { Badge, Button, Card, CardHead, EmptyState, ProgressBar, SearchInput, Select } from '../../components/ui'
import { Detail, LinkButton, PageHeader, StatStrip, StatTile, useDocumentTitle } from '../../components/page'
import { DocumentPreview, DownloadButton, InvoiceDocActions, summaryDoc, useDeliveryPendingMessage } from '../../components/DocumentPreview'
import type { PreviewDoc } from '../../components/DocumentPreview'

const STATUS_LABEL: Record<OrderInvoiceStatus, string> = { none: 'Not dispatched', partial: 'Partially dispatched', full: 'Fully dispatched' }
const STATUS_TONE: Record<OrderInvoiceStatus, 'slate' | 'amber' | 'green'> = { none: 'slate', partial: 'amber', full: 'green' }
/** Quantity in the order's own unit of measure. */
const qty = (n: number, uom: string) => `${n.toLocaleString('en-IN')} ${uom}`
const SUMMARY_FILE = 'cumulative-invoice-summary'

export function BillingPage() {
  useDocumentTitle('Billing')
  const { db } = useStore()
  const [params, setParams] = useSearchParams()
  const [preview, setPreview] = useState<PreviewDoc | null>(null)
  const q = params.get('q') ?? ''
  const status = (params.get('status') ?? '') as OrderInvoiceStatus | ''
  const orderId = params.get('order')

  // Documents read the latest committed state when they are built, not the state at render time.
  const latest = useRef(db)
  useEffect(() => {
    latest.current = db
  }, [db])
  const read = () => latest.current

  const set = (patch: Record<string, string | null>, push = false) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (!v) next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: !push })
  }

  const rows = useMemo(() => db.orders.map((o) => orderInvoiceSummary(o, db.dispatches, db.invoices)), [db.orders, db.dispatches, db.invoices])
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    const text = (r: OrderInvoiceSummary) =>
      `${r.order.code} ${r.order.customer.company} ${r.order.productName} ${r.order.customerRef} ${r.shipments.map((s) => `${s.invoice?.number ?? ''} ${s.dispatch.code}`).join(' ')}`.toLowerCase()
    return rows
      .filter((r) => (!status || r.status === status) && (!term || text(r).includes(term)))
      .sort((a, b) => (b.latestDispatch ?? '').localeCompare(a.latestDispatch ?? '') || b.order.code.localeCompare(a.order.code))
  }, [rows, q, status])
  const count = (s: OrderInvoiceStatus) => rows.filter((r) => r.status === s).length
  const selected = rows.find((r) => r.order.id === orderId) ?? null

  // An open summary preview is rebuilt when the order's saved dispatches change,
  // so it can never download an older version.
  const stamp = selected?.shipments.map((s) => `${s.dispatch.id}:${s.dispatch.receivedAt ?? ''}`).join(',') ?? ''
  useEffect(() => {
    setPreview((p) => (p && orderId && p.fileName.includes(SUMMARY_FILE) ? summaryDoc(() => latest.current, orderId) : p))
  }, [stamp, orderId])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Billing · Invoices"
        title="Invoices"
        subtitle="One entry per order. Download an updated cumulative summary of every confirmed dispatch, or any individual dispatch invoice, at any time. Downloads never create new invoices."
        icon={<FileStack className="h-4 w-4" />}
      />

      {selected ? (
        <OrderInvoices row={selected} read={read} onBack={() => set({ order: null }, true)} onPreview={setPreview} />
      ) : orderId ? (
        <Card className="vx-anim-up">
          <EmptyState icon={<Search className="h-6 w-6" />} title="Order not found" message="This order does not exist in this browser's records." action={<Button variant="secondary" onClick={() => set({ order: null })}>All orders</Button>} />
        </Card>
      ) : (
        <>
          <StatStrip className="grid-cols-2 lg:grid-cols-4">
            <StatTile label="Orders" value={String(rows.length)} icon={<FileStack className="h-4 w-4" />} tone="indigo" hint="All production orders" onClick={() => set({ status: null })} active={!status} />
            <StatTile label="Not dispatched" value={String(count('none'))} icon={<PackageCheck className="h-4 w-4" />} tone="slate" hint="Nothing billed yet" onClick={() => set({ status: 'none' })} active={status === 'none'} />
            <StatTile label="Partially dispatched" value={String(count('partial'))} icon={<Truck className="h-4 w-4" />} tone="amber" hint="Balance still to ship" onClick={() => set({ status: 'partial' })} active={status === 'partial'} />
            <StatTile label="Fully dispatched" value={String(count('full'))} icon={<ReceiptText className="h-4 w-4" />} tone="green" hint="Nothing remaining" onClick={() => set({ status: 'full' })} active={status === 'full'} />
          </StatStrip>

          <Card className="vx-anim-up overflow-hidden">
            <CardHead
              title="Order invoice summaries"
              subtitle={`${filtered.length} of ${rows.length} orders`}
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <SearchInput value={q} onChange={(v) => set({ q: v })} placeholder="Order, customer, product, invoice…" className="w-full sm:w-64" />
                  <Select aria-label="Filter by status" value={status} onChange={(e) => set({ status: e.target.value })} className="w-full sm:w-48">
                    <option value="">All statuses</option>
                    <option value="none">{STATUS_LABEL.none}</option>
                    <option value="partial">{STATUS_LABEL.partial}</option>
                    <option value="full">{STATUS_LABEL.full}</option>
                  </Select>
                </div>
              }
            />
            {rows.length === 0 ? (
              <EmptyState icon={<FileStack className="h-6 w-6" />} title="No orders yet" message="Orders appear here once their costing is finalized and released to production." />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<Search className="h-6 w-6" />}
                title="No orders match"
                message="Clear the search or status filter to see every order."
                action={
                  <Button variant="secondary" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1280px]">
                  <thead>
                    <tr>
                      <th className="vx-th">Order</th>
                      <th className="vx-th">Customer</th>
                      <th className="vx-th">Product</th>
                      <th className="vx-th text-right">Ordered</th>
                      <th className="vx-th text-right">Dispatched</th>
                      <th className="vx-th text-right">Received</th>
                      <th className="vx-th text-right">Awaiting receipt</th>
                      <th className="vx-th text-right">Remaining</th>
                      <th className="vx-th text-right">Billed to date</th>
                      <th className="vx-th">Latest dispatch</th>
                      <th className="vx-th">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.order.id} onClick={() => set({ order: r.order.id }, true)} className="border-t border-rule hover:bg-surface-2 cursor-pointer transition-colors group">
                        <td className="vx-td">
                          <span className="vx-code font-semibold text-accent-text group-hover:underline">
                            {r.order.code}
                          </span>
                        </td>
                        <td className="vx-td">{r.order.customer.company}</td>
                        <td className="vx-td">{r.order.productName}</td>
                        <td className="vx-td vx-code text-right">{qty(r.order.quantity, r.order.uom)}</td>
                        <td className="vx-td vx-code text-right">{qty(r.dispatchedQty, r.order.uom)}</td>
                        <td className="vx-td vx-code text-right">{qty(r.receivedQty, r.order.uom)}</td>
                        <td className="vx-td vx-code text-right">{qty(r.awaitingQty, r.order.uom)}</td>
                        <td className="vx-td vx-code text-right">{qty(r.remainingQty, r.order.uom)}</td>
                        <td className="vx-td vx-code text-right">{moneyPaise(r.billed)}</td>
                        <td className="vx-td">{r.latestDispatch ? fmtDate(r.latestDispatch) : '—'}</td>
                        <td className="vx-td">
                          <Badge tone={STATUS_TONE[r.status]} dot>
                            {STATUS_LABEL[r.status]}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      <DocumentPreview doc={preview} onClose={() => setPreview(null)} />
    </div>
  )
}

function OrderInvoices({ row, read, onBack, onPreview }: { row: OrderInvoiceSummary; read: () => VertexDB; onBack: () => void; onPreview: (d: PreviewDoc) => void }) {
  const { can } = useStore()
  const pending = useDeliveryPendingMessage()
  const { order, shipments, dispatchedQty, receivedQty, awaitingQty, remainingQty, billed, receivedBilled, status } = row
  const receivedCount = shipments.filter((x) => isReceived(x.dispatch) && x.invoice).length
  const eligible = receivedCount > 0
  const summary = () => {
    const doc = summaryDoc(read, order.id)
    if (!doc) throw new Error('No shipment is confirmed received yet.')
    return doc
  }
  const last = shipments[shipments.length - 1]

  return (
    <div className="space-y-6">
      <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />} onClick={onBack}>
        All orders
      </Button>

      <Card className="vx-anim-up p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="vx-code text-lg font-semibold text-ink">{order.code}</h2>
            <p className="text-base text-ink-2">{order.customer.company}</p>
            <p className="text-sm text-muted">
              {order.productName}
              {order.dimensions ? ` — ${order.dimensions}` : ''}
              {order.customerRef ? ` · PO ${order.customerRef}` : ''}
            </p>
          </div>
          <Badge tone={STATUS_TONE[status]} dot>
            {STATUS_LABEL[status]}
          </Badge>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Detail label="Ordered">
            {qty(order.quantity, order.uom)}
          </Detail>
          <Detail label="Dispatched">
            {qty(dispatchedQty, order.uom)}
          </Detail>
          <Detail label="Received">{qty(receivedQty, order.uom)}</Detail>
          <Detail label="Awaiting receipt">{qty(awaitingQty, order.uom)}</Detail>
          <Detail label="Remaining to dispatch">
            {qty(remainingQty, order.uom)}
          </Detail>
          <Detail label="Billed to date">{moneyPaise(billed)}</Detail>
        </dl>
        <ProgressBar value={order.quantity ? (dispatchedQty / order.quantity) * 100 : 0} tone={status === 'full' ? 'green' : 'indigo'} className="mt-4" />

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-rule pt-4">
          <DownloadButton icon={<Download className="h-4 w-4" />} doc={summary} disabled={!eligible} aria-label="Download PDF — cumulative invoice summary">
            Download PDF
          </DownloadButton>
          <Button variant="secondary" icon={<Eye className="h-4 w-4" />} disabled={!eligible} onClick={() => onPreview(summary())}>
            Preview PDF
          </Button>
          {eligible ? (
            <p className="w-full text-xs text-muted">
              Updated cumulative invoice summary of the {receivedCount} shipment(s) confirmed received: {qty(receivedQty, order.uom)}, {moneyShort(receivedBilled)} in total. It lists those invoices and is not an additional amount payable.
              {awaitingQty > 0 ? ` ${qty(awaitingQty, order.uom)} dispatched but awaiting receipt are not included yet.` : ''}
            </p>
          ) : (
            <p className="w-full text-sm text-warn" role="status">
              {pending(DELIVERY_PENDING_MESSAGE)}
            </p>
          )}
        </div>
      </Card>

      <Card className="vx-anim-up overflow-hidden">
        <CardHead title="Dispatches and invoices" subtitle={`${shipments.length} confirmed dispatch(es)`} />
        {shipments.length === 0 ? (
          <EmptyState
            icon={<Truck className="h-6 w-6" />}
            title="Nothing dispatched yet"
            message={
              can('dispatch')
                ? order.status === 'Completed'
                  ? 'Production is complete. Confirm a dispatch to issue its invoice; the cumulative summary becomes available after the first confirmed dispatch.'
                  : 'This order is still in production. Invoices are issued when completed pieces are dispatched.'
                : 'No invoice has been issued for this order yet. Invoices appear here after Administrator 1 or Administrator 2 confirms a dispatch.'
            }
            action={
              can('dispatch') ? (
                order.status === 'Completed' ? (
                  <LinkButton to={`/dispatch?order=${order.id}`} icon={<Truck className="h-4 w-4" />}>
                    Record the first dispatch
                  </LinkButton>
                ) : (
                  <LinkButton to="/production" variant="secondary">
                    Follow production
                  </LinkButton>
                )
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr>
                  <th className="vx-th">Dispatch</th>
                  <th className="vx-th">Date</th>
                  <th className="vx-th text-right">Quantity</th>
                  <th className="vx-th">Invoice</th>
                  <th className="vx-th text-right">Amount</th>
                  <th className="vx-th">Transport</th>
                  <th className="vx-th">Delivery</th>
                  <th className="vx-th text-right">Documents</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map(({ dispatch: d, invoice: inv }) => (
                  <tr key={d.id} className="border-t border-rule">
                    <td className="vx-td vx-code">
                      {d.code} <span className="text-muted">#{d.seq}</span>
                    </td>
                    <td className="vx-td">{fmtDate(d.date)}</td>
                    <td className="vx-td vx-code text-right">{qty(d.quantity, order.uom)}</td>
                    <td className="vx-td vx-code">{inv?.number ?? '—'}</td>
                    <td className="vx-td vx-code text-right">{inv ? moneyPaise(inv.total) : '—'}</td>
                    <td className="vx-td text-sm text-muted">{[d.transporter, d.vehicleNo].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="vx-td">
                      {isReceived(d) ? (
                        <>
                          <Badge tone="green" dot>
                            Received
                          </Badge>
                          <span className="mt-0.5 block text-2xs text-faint">
                            {fmtDateTime(d.receivedAt)} · {d.receivedBy}
                          </span>
                        </>
                      ) : (
                        <Badge tone="amber" dot>
                          Awaiting receipt
                        </Badge>
                      )}
                    </td>
                    <td className="vx-td">
                      {inv ? <InvoiceDocActions alwaysAllow invoice={inv} onPreview={onPreview} downloadLabel="Download this dispatch invoice" /> : <span className="text-xs text-warn">Invoice record missing</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {last ? (
          <p className="border-t border-rule px-4 py-2 text-xs text-muted">
            Last dispatch recorded {fmtDateTime(last.dispatch.createdAt)} by {last.dispatch.createdBy}. Issued invoices always print from their saved snapshot.
          </p>
        ) : null}
      </Card>
    </div>
  )
}
