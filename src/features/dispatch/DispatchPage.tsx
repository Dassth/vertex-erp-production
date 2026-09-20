import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { Building2, CheckCircle2, Download, Eye, FileStack, PackageCheck, Truck } from 'lucide-react'
import { useStore } from '../../store/store'
import type { Dispatch, Invoice, ProductionOrder } from '../../lib/types'
import { isReceived, orderBalance } from '../../lib/billing'
import { productionDates } from '../../lib/schedule'
import { companyInvoiceIssues, confirmDispatch, confirmDispatchReceived, finalizedCostingFor, orderInvoices, validateDispatchRequest } from '../../domain/dispatch'
import type { DispatchRequest } from '../../domain/dispatch'
import { cx, fmtDate, fmtDateTime, moneyPaise, moneyPrecise, pct, pieces, uid } from '../../lib/format'
import { Badge, Button, Card, CardHead, ConfirmDialog, EmptyState, Field, Input, ProgressBar, Segmented, Textarea } from '../../components/ui'
import { Detail, LinkButton, NumberInput, PageHeader, StatStrip, StatTile, useDocumentTitle } from '../../components/page'
import { CompanyProfileDialog } from '../../components/AdminDialogs'
import { DocumentPreview, DownloadButton, ExcelButton, InvoiceDocActions, statementDoc } from '../../components/DocumentPreview'
import type { PreviewDoc } from '../../components/DocumentPreview'

const COMPANY_OWNER_NOTICE = 'Administrator 1 must complete the company profile before invoices can be issued.'

type Filter = 'ready' | 'partial' | 'done' | 'production'

export function DispatchPage() {
  useDocumentTitle('Dispatch')
  const { db, can } = useStore()
  const canEditCompany = can('administration')
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('order')
  const [companyOpen, setCompanyOpen] = useState(false)
  const [preview, setPreview] = useState<PreviewDoc | null>(null)

  const rows = useMemo(
    () =>
      db.orders.map((order) => {
        const balance = orderBalance(order, db.dispatches)
        const state: Filter = order.status !== 'Completed' ? 'production' : balance.remainingQty === 0 ? 'done' : balance.dispatchedQty > 0 ? 'partial' : 'ready'
        return { order, balance, state }
      }),
    [db.orders, db.dispatches],
  )
  const counts = (f: Filter) => rows.filter((r) => r.state === f).length
  const defaultFilter: Filter = counts('ready') || counts('partial') ? 'ready' : counts('done') ? 'done' : 'production'
  const filter = (params.get('filter') as Filter | null) ?? defaultFilter
  const list = rows
    .filter((r) => (filter === 'ready' ? r.state === 'ready' || r.state === 'partial' : r.state === filter))
    .sort((a, b) => (a.order.completedAt ?? a.order.deliveryDate).localeCompare(b.order.completedAt ?? b.order.deliveryDate))
  const selected = rows.find((r) => r.order.id === selectedId)
  const companyProblems = companyInvoiceIssues(db.company, db.settings.taxPct)

  const set = (patch: Record<string, string | null>, push = false) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: !push })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations · Step 4"
        title="Dispatch"
        subtitle="Ship completed production in full or in parts. Confirming a dispatch records it, updates the balance and issues its invoice in one step."
        icon={<Truck className="h-4 w-4" />}
      />

      <StatStrip className="grid-cols-2 lg:grid-cols-4">
        <StatTile label="Ready for shipment" value={String(counts('ready'))} icon={<PackageCheck className="h-4 w-4" />} tone="green" hint="Completed, nothing dispatched" onClick={() => set({ filter: 'ready' })} active={filter === 'ready'} />
        <StatTile label="Partially dispatched" value={String(counts('partial'))} icon={<FileStack className="h-4 w-4" />} tone="amber" hint="Balance still to ship" onClick={() => set({ filter: 'ready' })} active={filter === 'ready'} />
        <StatTile label="Fully dispatched" value={String(counts('done'))} icon={<CheckCircle2 className="h-4 w-4" />} tone="indigo" hint="Nothing remaining" onClick={() => set({ filter: 'done' })} active={filter === 'done'} />
        <StatTile label="Still in production" value={String(counts('production'))} icon={<Truck className="h-4 w-4" />} tone="slate" hint="Not dispatchable yet" onClick={() => set({ filter: 'production' })} active={filter === 'production'} />
      </StatStrip>

      {companyProblems.length ? (
        <div className="vx-anim-up flex flex-wrap items-center gap-3 rounded-md bg-warn-wash px-4 py-3 text-sm text-warn ring-1 ring-inset ring-warn-edge">
          <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          {canEditCompany ? (
            <>
              <span className="min-w-0 flex-1">Invoices cannot be issued yet: {companyProblems.join(' ')}</span>
              <Button size="sm" variant="secondary" onClick={() => setCompanyOpen(true)}>
                Complete company profile…
              </Button>
            </>
          ) : (
            <span className="min-w-0 flex-1">{COMPANY_OWNER_NOTICE}</span>
          )}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)] xl:items-start">
        <Card className="vx-anim-up overflow-hidden">
          <div className="border-b border-rule bg-surface-2 p-3">
            <Segmented
              value={filter}
              onChange={(v) => set({ filter: v })}
              options={[
                { value: 'ready', label: 'To ship', count: counts('ready') + counts('partial') },
                { value: 'done', label: 'Shipped', count: counts('done') },
                { value: 'production', label: 'In production', count: counts('production') },
              ]}
            />
          </div>
          {list.length === 0 ? (
            <EmptyState
              icon={<Truck className="h-6 w-6" />}
              title={filter === 'ready' ? 'Nothing to ship' : 'No orders here'}
              message={filter === 'ready' ? 'Orders appear here automatically when all their production stages are completed.' : 'Choose another list.'}
              action={filter === 'ready' ? <LinkButton to="/production" variant="secondary">Open Production</LinkButton> : undefined}
            />
          ) : (
            <ul>
              {list.map(({ order, balance, state }) => (
                <li key={order.id}>
                  <button
                    type="button"
                    onClick={() => set({ order: order.id }, true)}
                    aria-current={selectedId === order.id ? 'true' : undefined}
                    className={cx('vx-press vx-focus flex w-full flex-col gap-1.5 border-b border-rule px-4 py-3 text-left', selectedId === order.id ? 'bg-accent-wash' : 'hover:bg-surface-2')}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="vx-code font-semibold text-ink">{order.code}</span>
                      {state === 'ready' ? <Badge tone="green" dot>Ready</Badge> : state === 'partial' ? <Badge tone="amber" dot>Partial</Badge> : state === 'done' ? <Badge tone="indigo" dot>Shipped</Badge> : <Badge tone="slate" dot>In production</Badge>}
                    </span>
                    <span className="truncate text-sm text-ink-2">{order.customer.company}</span>
                    <span className="truncate text-xs text-muted">{order.productName}</span>
                    {order.status === 'Completed' ? (
                      <span className="vx-code text-xs text-ink-2">
                        {pieces(balance.remainingQty)} remaining of {pieces(balance.completedQty)}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {selected ? (
          <OrderDispatch key={selected.order.id} order={selected.order} onPreview={setPreview} companyBlocked={companyProblems.length > 0} />
        ) : (
          <Card className="vx-anim-up">
            <EmptyState icon={<Truck className="h-6 w-6" />} title="Select an order" message="Choose an order to see its quantities, dispatch history and invoices, and to record a dispatch." />
          </Card>
        )}
      </div>

      {canEditCompany ? <CompanyProfileDialog open={companyOpen} onClose={() => setCompanyOpen(false)} /> : null}
      <DocumentPreview doc={preview} onClose={() => setPreview(null)} />
    </div>
  )
}

function OrderDispatch({ order, onPreview, companyBlocked }: { order: ProductionOrder; onPreview: (d: PreviewDoc) => void; companyBlocked: boolean }) {
  const { db, run, pushToast, can } = useStore()
  const canSeeInternals = can('costing.internals')
  const balance = orderBalance(order, db.dispatches)
  const costing = finalizedCostingFor(db, order)
  const result = costing?.snapshot?.result
  const invoices = orderInvoices(db, order.id)
  const dispatches = db.dispatches.filter((d) => d.orderId === order.id).sort((a, b) => a.seq - b.seq)
  const dates = productionDates(order)
  const lastDate = dispatches[dispatches.length - 1]?.date
  const todayIso = format(new Date(), 'yyyy-MM-dd')
  const minDate = [order.completedAt?.slice(0, 10), lastDate].filter(Boolean).sort().pop() ?? todayIso

  const blank = (): DispatchRequest => ({
    requestId: uid('dreq'),
    orderId: order.id,
    date: minDate > todayIso ? minDate : todayIso,
    quantity: NaN,
    deliveryAddress: order.customer.deliveryAddress,
    transporter: '',
    vehicleNo: '',
    notes: '',
  })
  const [req, setReq] = useState<DispatchRequest>(blank)
  const [touched, setTouched] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [issued, setIssued] = useState<Invoice | null>(null)
  const inFlight = useRef(false)
  const [receiving, setReceiving] = useState<Dispatch | null>(null)
  const [receiptBusy, setReceiptBusy] = useState(false)
  const receiptFlight = useRef(false)

  const confirmReceived = async () => {
    if (!receiving || receiptFlight.current) return
    receiptFlight.current = true
    setReceiptBusy(true)
    try {
      const r = await run(confirmDispatchReceived(receiving.id))
      if (!r.ok) {
        pushToast({ title: 'Delivery not confirmed', message: r.error, level: 'danger' })
        return
      }
      pushToast({ title: `${r.value.code} received`, message: `${pieces(r.value.quantity)} confirmed received. Its invoice can now be downloaded.`, level: 'success' })
    } finally {
      receiptFlight.current = false
      setReceiptBusy(false)
      setReceiving(null)
    }
  }

  const check = order.status === 'Completed' && balance.remainingQty > 0 ? validateDispatchRequest(db, req) : null
  const fieldErrors = touched ? (check?.fieldErrors ?? {}) : {}
  const canConfirm = !!check && !check.error && !Object.keys(check.fieldErrors).length && !!check.amounts && !companyBlocked

  const confirm = async () => {
    if (inFlight.current) return
    inFlight.current = true
    setSubmitting(true)
    const r = await run(confirmDispatch(req))
    setSubmitting(false)
    setConfirmOpen(false)
    inFlight.current = false
    if (!r.ok) {
      setTouched(true)
      pushToast({ title: 'Dispatch not confirmed', message: r.error, level: 'danger' })
      return
    }
    setIssued(r.value.invoice)
    setReq(blank())
    setTouched(false)
    pushToast({
      title: r.value.duplicate ? 'Already confirmed' : `${r.value.invoice.number} issued`,
      message: r.value.duplicate ? 'This dispatch was recorded earlier; no duplicate invoice was created.' : `${pieces(r.value.dispatch.quantity)} dispatched · ${pieces(r.value.invoice.partial.remainingAfter)} remaining.`,
      level: r.value.duplicate ? 'info' : 'success',
    })
  }

  const statement = statementDoc(db, order.id)

  return (
    <div className="space-y-5">
      <Card className="vx-anim-up">
        <CardHead
          title={`${order.code} · ${order.customer.company}`}
          subtitle={`${order.productName}${order.dimensions ? ` · ${order.dimensions}` : ''}`}
          actions={statement ? (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => onPreview(statement)}>
                Order statement
              </Button>
              <DownloadButton size="sm" variant="ghost" icon={<Download className="h-3.5 w-3.5" />} doc={() => statement} aria-label="Download order statement PDF">
                PDF
              </DownloadButton>
              <ExcelButton
                size="sm"
                variant="ghost"
                stem={`${order.code}-cumulative-invoice-summary`}
                aria-label="Download the order statement as a spreadsheet"
                table={async () => {
                  const [{ statementTable }, { consolidatedStatement, receivedInvoices }] = await Promise.all([import('../../lib/docTables'), import('../../lib/billing')])
                  const costing = db.costings.find((c) => c.id === order.costingId)
                  if (!costing?.snapshot) throw new Error('The finalized costing for this order is missing.')
                  return statementTable(order, consolidatedStatement(order, receivedInvoices(order.id, db.dispatches, db.invoices), costing.snapshot.result), db.company.name)
                }}
              />
            </div>
          ) : null}
        />
        <dl className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Customer">{order.customer.company}</Detail>
          <Detail label="Delivery destination" className="lg:col-span-2">
            {order.customer.deliveryAddress}
          </Detail>
          <Detail label="Product">{order.productName}</Detail>
          <Detail label="Ordered quantity">{pieces(order.quantity)}</Detail>
          <Detail label="Customer ref.">{order.customerRef || '—'}</Detail>
          <Detail label="Production started">{fmtDateTime(dates.startedAt)}</Detail>
          <Detail label="Production completed">{fmtDateTime(dates.completedAt)}</Detail>
          <Detail label="Payment terms">{order.customer.paymentTerms || '—'}</Detail>
        </dl>
        <div className="grid gap-4 border-t border-rule p-5 md:grid-cols-2">
          {/* Cost and profit are internal: only an account that may read costing sees them.
              Dispatch itself needs the selling amount and the delivery details, which stay. */}
          {canSeeInternals ? (
            <div className="rounded-md bg-surface-2 p-4">
              <p className="vx-mono-label flex items-center gap-2">
                Internal costing summary <Badge tone="slate">Internal</Badge>
              </p>
              {result ? (
                <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <Detail label="Total cost">{moneyPaise(result.totalCost)}</Detail>
                  <Detail label="Production cost / piece">{moneyPrecise(result.costPerPiece)}</Detail>
                  <Detail label="Profit">{moneyPaise(result.profitAmount)}</Detail>
                  <Detail label={result.profitMethod === 'markup' ? 'Markup' : 'Margin'}>{pct(result.profitPct)}</Detail>
                </dl>
              ) : (
                <p className="mt-2 text-sm text-risk">Costing snapshot missing.</p>
              )}
            </div>
          ) : null}
          <div className="rounded-md bg-accent-wash p-4 ring-1 ring-inset ring-accent-edge">
            <p className="vx-mono-label">Customer selling amount</p>
            {result ? (
              <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <Detail label="Selling price / piece (before tax)">{moneyPaise(result.sellingPerPiece)}</Detail>
                <Detail label="Taxable value">{moneyPaise(result.taxableValue)}</Detail>
                <Detail label={`${result.taxLabel} ${result.taxPct}%`}>{moneyPaise(result.taxAmount)}</Detail>
                <Detail label="Order total">{moneyPaise(result.grandTotal)}</Detail>
              </dl>
            ) : null}
          </div>
        </div>
        <div className="border-t border-rule px-5 py-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              ['Completed', balance.completedQty],
              ['Dispatched', balance.dispatchedQty],
              ['Remaining', balance.remainingQty],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="vx-code font-display text-2xl font-semibold text-ink">{Number(value).toLocaleString('en-IN')}</p>
                <p className="text-xs text-muted">{label} ({order.uom})</p>
              </div>
            ))}
          </div>
          <ProgressBar className="mt-3" value={balance.completedQty ? (balance.dispatchedQty / balance.completedQty) * 100 : 0} tone="green" showLabel />
        </div>
      </Card>

      {issued ? (
        <div className="vx-anim-up flex flex-wrap items-center gap-3 rounded-md bg-ok-wash px-4 py-3 text-sm text-ok ring-1 ring-inset ring-ok-edge" role="status">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            Invoice <strong className="vx-code">{issued.number}</strong> issued for {pieces(issued.partial.thisQty)} — {moneyPaise(issued.total)}. It is also listed in Billing.
          </span>
          <InvoiceDocActions invoice={issued} onPreview={onPreview} downloadLabel="Download invoice" />
        </div>
      ) : null}

      {order.status !== 'Completed' ? (
        <Card className="vx-anim-up p-5 text-sm text-muted">Production is not complete. This order becomes dispatchable automatically when its last stage is closed.</Card>
      ) : balance.remainingQty > 0 ? (
        <Card className="vx-anim-up">
          <CardHead title={`New dispatch #${dispatches.length + 1}`} subtitle="Dispatch the full remaining quantity or any part of it" />
          <form
            className="grid gap-x-4 p-5 sm:grid-cols-2"
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              setTouched(true)
              if (canConfirm) setConfirmOpen(true)
            }}
          >
            <Field label={`Quantity (${order.uom})`} required error={fieldErrors.quantity} hint={`Up to ${balance.remainingQty.toLocaleString('en-IN')} available.`} as="div">
              <div className="flex gap-2">
                <NumberInput value={req.quantity} onChange={(v) => setReq({ ...req, quantity: v ?? NaN })} invalid={!!fieldErrors.quantity} aria-label="Dispatch quantity" />
                <Button type="button" variant="secondary" onClick={() => setReq({ ...req, quantity: balance.remainingQty })}>
                  All {balance.remainingQty.toLocaleString('en-IN')}
                </Button>
              </div>
            </Field>
            <Field label="Dispatch date" required error={fieldErrors.date}>
              <Input type="date" min={minDate} value={req.date} onChange={(e) => setReq({ ...req, date: e.target.value })} aria-invalid={!!fieldErrors.date || undefined} />
            </Field>
            <Field label="Delivery address" required error={fieldErrors.deliveryAddress} className="sm:col-span-2">
              <Textarea rows={2} value={req.deliveryAddress} onChange={(e) => setReq({ ...req, deliveryAddress: e.target.value })} aria-invalid={!!fieldErrors.deliveryAddress || undefined} />
            </Field>
            <Field label="Transporter">
              <Input value={req.transporter} onChange={(e) => setReq({ ...req, transporter: e.target.value })} />
            </Field>
            <Field label="Vehicle no.">
              <Input spellCheck={false} value={req.vehicleNo} onChange={(e) => setReq({ ...req, vehicleNo: e.target.value })} />
            </Field>
            <Field label="Dispatch notes" className="sm:col-span-2">
              <Textarea rows={2} value={req.notes} onChange={(e) => setReq({ ...req, notes: e.target.value })} />
            </Field>

            <div className="rounded-md bg-surface-2 p-4 sm:col-span-2" aria-live="polite">
              <p className="vx-mono-label">Invoice preview</p>
              {check?.amounts ? (
                <>
                  <dl className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
                    <Detail label="Rate">{moneyPaise(check.amounts.rate)}</Detail>
                    <Detail label="Line amount">{moneyPaise(check.amounts.subtotal)}</Detail>
                    <Detail label="Discount">{moneyPaise(check.amounts.discount)}</Detail>
                    <Detail label={`Tax ${check.amounts.taxPct}%`}>{moneyPaise(check.amounts.taxAmount)}</Detail>
                    <Detail label="Invoice total">
                      <strong>{moneyPaise(check.amounts.total)}</strong>
                    </Detail>
                  </dl>
                  <p className="mt-2 text-xs text-muted">
                    {check.amounts.isSingleFull
                      ? 'Full order in a single invoice — equals the finalized order total.'
                      : check.amounts.isFinal
                        ? `Final dispatch — absorbs rounding so all ${dispatches.length + 1} invoices total the order value exactly.`
                        : `Partial dispatch — ${check.amounts.remainingAfter.toLocaleString('en-IN')} ${order.uom} will remain.`}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-muted">{check?.error ?? 'Enter a quantity to preview the invoice.'}</p>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 sm:col-span-2">
              <Button type="submit" icon={<Truck className="h-4 w-4" />} loading={submitting} disabled={companyBlocked}>
                Confirm dispatch & issue invoice
              </Button>
              {companyBlocked ? <span className="text-xs text-warn">{can('administration') ? 'Complete the company profile first.' : COMPANY_OWNER_NOTICE}</span> : null}
            </div>
          </form>
        </Card>
      ) : (
        <Card className="vx-anim-up p-5 text-sm text-ok">The full order has been dispatched and invoiced. Download the order statement for a consolidated summary.</Card>
      )}

      <Card className="vx-anim-up overflow-hidden">
        <CardHead
          title="Dispatch history"
          subtitle={`${dispatches.length} dispatch(es) · ${invoices.length} invoice(s) · ${pieces(dispatches.filter(isReceived).reduce((n, d) => n + d.quantity, 0))} received · ${pieces(dispatches.filter((d) => !isReceived(d)).reduce((n, d) => n + d.quantity, 0))} awaiting receipt`}
        />
        {dispatches.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-muted">No dispatches yet.</p>
        ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead>
                  <tr>
                    <th className="vx-th">#</th>
                    <th className="vx-th">Date</th>
                    <th className="vx-th">Dispatch</th>
                    <th className="vx-th text-right">Quantity</th>
                    <th className="vx-th">Delivery</th>
                  </tr>
                </thead>
                <tbody>
                  {dispatches.map((d) => (
                    <tr key={d.id} className="vx-row">
                      <td className="vx-td vx-code">{d.seq}</td>
                      <td className="vx-td">{fmtDate(d.date)}</td>
                      <td className="vx-td">
                        <span className="vx-code block">{d.code}</span>
                        <span className="block text-2xs text-faint">{d.createdBy}</span>
                      </td>
                      <td className="vx-td text-right tabular-nums">{pieces(d.quantity)}</td>
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
                          <>
                            <Badge tone="amber" dot>
                              Awaiting receipt
                            </Badge>
                            {can('dispatch') ? (
                              <Button size="sm" variant="secondary" className="mt-1.5 block" icon={<PackageCheck className="h-3.5 w-3.5" />} onClick={() => setReceiving(d)} aria-label={`Confirm received — ${d.code}`}>
                                Confirm received…
                              </Button>
                            ) : null}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!receiving}
        tone="success"
        title="Confirm delivery received?"
        confirmLabel={receiptBusy ? 'Confirming…' : 'Confirm received'}
        body={
          receiving ? (
            <p>
              Order <strong className="vx-code">{order.code}</strong> ({order.customer.company}), shipment <strong className="vx-code">{receiving.code}</strong> (dispatch #{receiving.seq},{' '}
              {receiving.date}): <strong>{pieces(receiving.quantity)}</strong>. Only this shipment is marked received; its invoice becomes available for download. This cannot be undone.
            </p>
          ) : null
        }
        onCancel={() => setReceiving(null)}
        onConfirm={confirmReceived}
      />

      <ConfirmDialog
        open={confirmOpen}
        tone="success"
        title={`Dispatch ${Number.isFinite(req.quantity) ? req.quantity.toLocaleString('en-IN') : ''} ${order.uom}?`}
        confirmLabel="Confirm & issue invoice"
        body={
          check?.amounts ? (
            <div className="space-y-2">
              <p>
                An invoice for <strong className="text-ink">{moneyPaise(check.amounts.total)}</strong> is issued to {order.customer.company}, dated {fmtDate(req.date)}.
              </p>
              <p>{check.amounts.remainingAfter.toLocaleString('en-IN')} {order.uom} will remain. Issued invoices cannot be edited.</p>
            </div>
          ) : (
            ''
          )
        }
        onCancel={() => setConfirmOpen(false)}
        onConfirm={confirm}
      />
    </div>
  )
}
