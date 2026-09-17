import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { CalendarDays, FileStack, IndianRupee, Percent, ReceiptText, Search } from 'lucide-react'
import { useStore } from '../../store/store'
import type { Invoice } from '../../lib/types'
import { cx, fmtDate, fmtDateTime, moneyPaise, moneyShort, pieces } from '../../lib/format'
import { Badge, Button, Card, CardHead, Drawer, EmptyState, Pagination, SearchInput, Select } from '../../components/ui'
import { Detail, LinkButton, PageHeader, StatStrip, StatTile, useDocumentTitle } from '../../components/page'
import { DocumentPreview, InvoiceDocActions, statementDoc } from '../../components/DocumentPreview'
import type { PreviewDoc } from '../../components/DocumentPreview'

type Sort = 'newest' | 'oldest' | 'amount' | 'customer'
const PAGE_SIZE = 20

function dispatchKind(inv: Invoice): { label: string; tone: 'green' | 'amber' | 'indigo' } {
  if (inv.partial.isSingleFull) return { label: 'Full order', tone: 'green' }
  if (inv.partial.isFinal) return { label: `Final · #${inv.partial.seq}`, tone: 'indigo' }
  return { label: `Partial · #${inv.partial.seq}`, tone: 'amber' }
}

export function BillingPage() {
  useDocumentTitle('Billing')
  const { db } = useStore()
  const [params, setParams] = useSearchParams()
  const [preview, setPreview] = useState<PreviewDoc | null>(null)
  const q = params.get('q') ?? ''
  const customer = params.get('customer') ?? ''
  const month = params.get('month') ?? ''
  const sort = (params.get('sort') ?? 'newest') as Sort
  const page = Math.max(1, Number(params.get('page')) || 1)
  const invoiceId = params.get('invoice')

  const set = (patch: Record<string, string | null>, push = false) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (!v || (k === 'sort' && v === 'newest')) next.delete(k)
      else next.set(k, v)
    }
    if (!('page' in patch) && !('invoice' in patch)) next.delete('page')
    setParams(next, { replace: !push })
  }

  const months = useMemo(() => [...new Set(db.invoices.map((i) => i.issueDate.slice(0, 7)))].sort().reverse(), [db.invoices])
  const customers = useMemo(() => {
    const map = new Map<string, string>()
    for (const i of db.invoices) map.set(i.customer.id, i.customer.company)
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [db.invoices])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    const list = db.invoices.filter(
      (i) =>
        (!customer || i.customer.id === customer) &&
        (!month || i.issueDate.startsWith(month)) &&
        (!term || `${i.number} ${i.customer.company} ${i.refs.orderCode} ${i.refs.dispatchCode} ${i.refs.customerRef} ${i.productName}`.toLowerCase().includes(term)),
    )
    return list.sort((a, b) => {
      if (sort === 'oldest') return a.createdAt.localeCompare(b.createdAt)
      if (sort === 'amount') return b.total - a.total
      if (sort === 'customer') return a.customer.company.localeCompare(b.customer.company) || b.createdAt.localeCompare(a.createdAt)
      return b.createdAt.localeCompare(a.createdAt)
    })
  }, [db.invoices, q, customer, month, sort])

  const thisMonth = format(new Date(), 'yyyy-MM')
  const sum = (list: Invoice[], pick: (i: Invoice) => number) => list.reduce((s, i) => s + pick(i), 0)
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = filtered.slice((Math.min(page, pageCount) - 1) * PAGE_SIZE, Math.min(page, pageCount) * PAGE_SIZE)
  const selected = db.invoices.find((i) => i.id === invoiceId) ?? null

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations · Step 5"
        title="Billing"
        subtitle={
          <>
            Read-only register of issued invoices. Invoices are created only by confirming a dispatch in{' '}
            <Link to="/dispatch" className="vx-focus rounded-xs font-medium text-accent-text hover:underline">
              Dispatch
            </Link>
            , and always print from their saved snapshot.
          </>
        }
        icon={<ReceiptText className="h-4 w-4" />}
      />

      <StatStrip className="grid-cols-2 lg:grid-cols-4">
        <StatTile label="Invoices" value={String(db.invoices.length)} icon={<FileStack className="h-4 w-4" />} tone="indigo" hint={`${new Set(db.invoices.map((i) => i.orderId)).size} orders billed`} />
        <StatTile label="Billed (incl. tax)" value={moneyShort(sum(db.invoices, (i) => i.total))} icon={<IndianRupee className="h-4 w-4" />} tone="green" hint="All invoices" />
        <StatTile label="Tax invoiced" value={moneyShort(sum(db.invoices, (i) => i.taxAmount))} icon={<Percent className="h-4 w-4" />} tone="violet" hint="Across all invoices" />
        <StatTile label="This month" value={moneyShort(sum(db.invoices.filter((i) => i.issueDate.startsWith(thisMonth)), (i) => i.total))} icon={<CalendarDays className="h-4 w-4" />} tone="slate" hint={format(new Date(), 'MMMM yyyy')} onClick={() => set({ month: month === thisMonth ? null : thisMonth })} active={month === thisMonth} />
      </StatStrip>

      <Card className="vx-anim-up overflow-hidden">
        <CardHead
          title="Invoice register"
          subtitle={`${filtered.length} of ${db.invoices.length} invoices`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput value={q} onChange={(v) => set({ q: v })} placeholder="Invoice, customer, order, PO…" className="w-full sm:w-60" />
              <Select aria-label="Filter by customer" value={customer} onChange={(e) => set({ customer: e.target.value })} className="w-full sm:w-48">
                <option value="">All customers</option>
                {customers.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </Select>
              <Select aria-label="Filter by month" value={month} onChange={(e) => set({ month: e.target.value })} className="w-full sm:w-40">
                <option value="">All months</option>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {format(new Date(`${m}-01T00:00:00`), 'MMM yyyy')}
                  </option>
                ))}
              </Select>
              <Select aria-label="Sort invoices" value={sort} onChange={(e) => set({ sort: e.target.value })} className="w-full sm:w-40">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="amount">Highest amount</option>
                <option value="customer">Customer</option>
              </Select>
            </div>
          }
        />
        {db.invoices.length === 0 ? (
          <EmptyState icon={<ReceiptText className="h-6 w-6" />} title="No invoices yet" message="Each confirmed dispatch issues an invoice automatically. Completed production is shipped from Dispatch." action={<LinkButton to="/dispatch">Open Dispatch</LinkButton>} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Search className="h-6 w-6" />} title="No invoices match" message="Clear the filters to see every invoice." action={<Button variant="secondary" onClick={() => setParams(new URLSearchParams(), { replace: true })}>Clear filters</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr>
                  <th className="vx-th">Invoice</th>
                  <th className="vx-th">Date</th>
                  <th className="vx-th">Customer</th>
                  <th className="vx-th">Order · dispatch</th>
                  <th className="vx-th text-right">Qty</th>
                  <th className="vx-th text-right">Taxable</th>
                  <th className="vx-th text-right">Tax</th>
                  <th className="vx-th text-right">Total</th>
                  <th className="vx-th text-right">Documents</th>
                </tr>
              </thead>
              <tbody>
                {current.map((inv) => {
                  const kind = dispatchKind(inv)
                  return (
                    <tr key={inv.id} className="vx-row">
                      <td className="vx-td">
                        <button type="button" onClick={() => set({ invoice: inv.id }, true)} className="vx-code vx-focus rounded-xs font-semibold text-accent-text hover:underline">
                          {inv.number}
                        </button>
                      </td>
                      <td className="vx-td">{fmtDate(inv.issueDate)}</td>
                      <td className="vx-td vx-td-wrap font-medium text-ink">{inv.customer.company}</td>
                      <td className="vx-td">
                        <span className="vx-code block text-sm">
                          {inv.refs.orderCode} · {inv.refs.dispatchCode}
                        </span>
                        <Badge tone={kind.tone}>{kind.label}</Badge>
                      </td>
                      <td className="vx-td text-right tabular-nums">{pieces(inv.partial.thisQty)}</td>
                      <td className="vx-td text-right tabular-nums">{moneyPaise(inv.taxableValue)}</td>
                      <td className="vx-td text-right tabular-nums">{moneyPaise(inv.taxAmount)}</td>
                      <td className="vx-td text-right font-semibold tabular-nums text-ink">{moneyPaise(inv.total)}</td>
                      <td className="vx-td">
                        <InvoiceDocActions invoice={inv} onPreview={setPreview} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length ? <Pagination page={Math.min(page, pageCount)} pageCount={pageCount} total={filtered.length} onChange={(p) => set({ page: String(p) })} label="invoices" /> : null}
      </Card>

      <Drawer open={!!selected} onClose={() => set({ invoice: null })} title={selected?.number ?? ''} subtitle={selected?.customer.company} width="w-full max-w-2xl">
        {selected ? <InvoiceDetail invoice={selected} onPreview={setPreview} /> : null}
      </Drawer>
      <DocumentPreview doc={preview} onClose={() => setPreview(null)} />
    </div>
  )
}

function InvoiceDetail({ invoice: inv, onPreview }: { invoice: Invoice; onPreview: (d: PreviewDoc) => void }) {
  const { db } = useStore()
  const statement = statementDoc(db, inv.orderId)
  const order = db.orders.find((o) => o.id === inv.orderId)
  const taxLines: Array<[string, number]> =
    inv.cgst !== null && inv.sgst !== null
      ? [
          [`CGST ${inv.taxPct / 2}%`, inv.cgst],
          [`SGST ${inv.taxPct / 2}%`, inv.sgst],
        ]
      : inv.igst !== null
        ? [[`IGST ${inv.taxPct}%`, inv.igst]]
        : [[`${inv.taxLabel} ${inv.taxPct}%`, inv.taxAmount]]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-2">
        <InvoiceDocActions invoice={inv} onPreview={onPreview} size="md" className="flex flex-col items-start gap-1" />
        {statement ? (
          <Button variant="ghost" icon={<FileStack className="h-4 w-4" />} onClick={() => onPreview(statement)}>
            Order statement
          </Button>
        ) : null}
      </div>

      <dl className="grid gap-4 sm:grid-cols-2">
        <Detail label="Issue date">{fmtDate(inv.issueDate)}</Detail>
        <Detail label="Issued by">
          {inv.createdBy} · {fmtDateTime(inv.createdAt)}
        </Detail>
        <Detail label="Bill to">
          {inv.customer.company}
          <span className="block text-sm text-muted">{inv.customer.billingAddress}</span>
          {inv.customer.gstin ? <span className="vx-code block text-xs text-muted">GSTIN {inv.customer.gstin}</span> : null}
        </Detail>
        <Detail label="Ship to">{inv.deliveryAddress}</Detail>
        <Detail label="Order">
          {order ? (
            <Link to={`/dispatch?order=${order.id}`} className="vx-code vx-focus rounded-xs text-accent-text hover:underline">
              {inv.refs.orderCode}
            </Link>
          ) : (
            inv.refs.orderCode
          )}
          {inv.refs.customerRef ? <span className="block text-xs text-muted">Customer ref. {inv.refs.customerRef}</span> : null}
        </Detail>
        <Detail label="Dispatch">
          <span className="vx-code">{inv.refs.dispatchCode}</span>
          <span className="block text-xs text-muted">
            {inv.partial.isSingleFull
              ? 'Full order in one invoice'
              : `Dispatch ${inv.partial.seq}: ${inv.partial.previouslyDispatched.toLocaleString('en-IN')} before, ${inv.partial.thisQty.toLocaleString('en-IN')} now, ${inv.partial.remainingAfter.toLocaleString('en-IN')} remaining`}
          </span>
        </Detail>
      </dl>

      <div className="overflow-x-auto rounded-md border border-rule">
        <table className="w-full min-w-[520px]">
          <thead>
            <tr>
              <th className="vx-th">Description</th>
              <th className="vx-th">HSN</th>
              <th className="vx-th text-right">Qty</th>
              <th className="vx-th text-right">Rate</th>
              <th className="vx-th text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.lines.map((l, i) => (
              <tr key={i} className="vx-row">
                <td className="vx-td vx-td-wrap">{l.description}</td>
                <td className="vx-td vx-code">{l.hsn || '—'}</td>
                <td className="vx-td text-right tabular-nums">
                  {l.quantity.toLocaleString('en-IN')} {l.uom}
                </td>
                <td className="vx-td text-right tabular-nums">{moneyPaise(l.rate)}</td>
                <td className="vx-td text-right tabular-nums">{moneyPaise(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="ml-auto max-w-sm space-y-1.5 text-sm">
        {(
          [
            ['Subtotal', inv.subtotal],
            ...(inv.discount > 0 ? [['Discount', -inv.discount] as [string, number]] : []),
            ['Taxable value', inv.taxableValue],
            ...taxLines,
          ] as Array<[string, number]>
        ).map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-muted">{label}</dt>
            <dd className="vx-code text-ink">{moneyPaise(value)}</dd>
          </div>
        ))}
        <div className={cx('flex justify-between gap-4 border-t border-rule pt-2 font-semibold')}>
          <dt className="text-ink">Invoice total</dt>
          <dd className="vx-code text-ink">{moneyPaise(inv.total)}</dd>
        </div>
      </dl>

      <p className="rounded-md bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-muted">{inv.allocationNote}</p>
    </div>
  )
}
