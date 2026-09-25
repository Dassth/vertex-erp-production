import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { addMonths, format, parse } from 'date-fns'
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, HandCoins, Pencil, Plus, Scale, Trash2, Wallet } from 'lucide-react'
import { useStore } from '../../store/store'
import type { MoneyDirection, MoneyEntry, MoneyMode } from '../../lib/types'
import { CATEGORIES, CUSTOMER_PAYMENT, MODE_LABEL, MODES, SUPPLIER_PAYMENT, balances, entriesOfMonth, summarise, sumDue, toCollect, toPay } from '../../lib/cashbook'
import { cx, fmtDate, moneyPaise } from '../../lib/format'
import { deleteMoneyEntry, saveMoneyEntry, validateMoney } from '../../domain/cashbook'
import type { MoneyDraft } from '../../domain/cashbook'
import { Badge, Button, Card, CardHead, ConfirmDialog, EmptyState, Field, IconButton, Input, Modal, Segmented, Select, Textarea } from '../../components/ui'
import { NumberInput, PageHeader, StatStrip, StatTile, useDocumentTitle } from '../../components/page'
import { ExcelButton } from '../../components/DocumentPreview'
import type { ReportTable } from '../../lib/reportTable'

/* ---------------------------------------------------------------------------
 * Income & expenses. Money in and money out, month by month, and
 * what is still due: customers' unpaid invoices ("To collect") and suppliers'
 * unpaid bills ("To pay"). Month and tab live in the URL.
 * ------------------------------------------------------------------------- */

type Tab = 'entries' | 'collect' | 'pay' | 'summary'
const TABS: Tab[] = ['entries', 'collect', 'pay', 'summary']
const amountClass = 'text-right tabular-nums'

const blank = (direction: MoneyDirection, over: Partial<MoneyDraft> = {}): MoneyDraft => ({
  id: '',
  direction,
  date: format(new Date(), 'yyyy-MM-dd'),
  amount: NaN,
  mode: 'upi',
  category: direction === 'in' ? CUSTOMER_PAYMENT : SUPPLIER_PAYMENT,
  party: '',
  invoiceId: null,
  purchaseId: null,
  reference: '',
  notes: '',
  ...over,
})

const toDraft = (m: MoneyEntry): MoneyDraft => ({
  id: m.id,
  direction: m.direction,
  date: m.date,
  amount: m.amount,
  mode: m.mode,
  category: m.category,
  party: m.party,
  invoiceId: m.invoiceId,
  purchaseId: m.purchaseId,
  reference: m.reference,
  notes: m.notes,
  expectedUpdatedAt: m.updatedAt,
})

export function AccountsPage() {
  useDocumentTitle('Income & Expenses')
  const { db, run, pushToast } = useStore()
  const [params, setParams] = useSearchParams()
  const month = /^\d{4}-\d{2}$/.test(params.get('month') ?? '') ? params.get('month')! : format(new Date(), 'yyyy-MM')
  const tab = (TABS as string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as Tab) : 'entries'
  const [editing, setEditing] = useState<MoneyDraft | null>(null)
  const [deleting, setDeleting] = useState<MoneyEntry | null>(null)

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: true })
  }

  // Quick access arrives with ?new=in or ?new=out: open the form once and drop the flag.
  const wanted = params.get('new')
  useEffect(() => {
    if (wanted !== 'in' && wanted !== 'out') return
    setEditing(blank(wanted))
    const next = new URLSearchParams(params)
    next.delete('new')
    setParams(next, { replace: true })
  }, [wanted, params, setParams])

  const entries = useMemo(() => entriesOfMonth(db, month), [db, month])
  const sum = useMemo(() => summarise(entries), [entries])
  const bal = useMemo(() => balances(db, month), [db, month])
  const collect = useMemo(() => toCollect(db), [db])
  const pay = useMemo(() => toPay(db), [db])
  const monthLabel = format(parse(`${month}-01`, 'yyyy-MM-dd', new Date()), 'MMMM yyyy')
  const shift = (n: number) => set({ month: format(addMonths(parse(`${month}-01`, 'yyyy-MM-dd', new Date()), n), 'yyyy-MM') })

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Billing · Money"
        title="Income & Expenses"
        subtitle="Record every rupee that comes in and goes out. See the balance each month, what customers still owe you, and what you still owe suppliers."
        icon={<Wallet className="h-4 w-4" />}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button icon={<ArrowDownLeft className="h-4 w-4" />} onClick={() => setEditing(blank('in'))}>
              Money in…
            </Button>
            <Button variant="secondary" icon={<ArrowUpRight className="h-4 w-4" />} onClick={() => setEditing(blank('out'))}>
              Money out…
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <IconButton label="Previous month" onClick={() => shift(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </IconButton>
        <Input type="month" aria-label="Month" value={month} onChange={(e) => e.target.value && set({ month: e.target.value })} className="h-9 w-44" />
        <IconButton label="Next month" onClick={() => shift(1)}>
          <ChevronRight className="h-4 w-4" />
        </IconButton>
        <span className="text-sm text-muted">{monthLabel}</span>
      </div>

      <StatStrip className="grid-cols-2 lg:grid-cols-4">
        <StatTile label="Money in" value={moneyPaise(sum.moneyIn)} icon={<ArrowDownLeft className="h-4 w-4" />} tone="green" hint={`${entries.filter((e) => e.direction === 'in').length} receipt(s) in ${monthLabel}`} />
        <StatTile label="Money out" value={moneyPaise(sum.moneyOut)} icon={<ArrowUpRight className="h-4 w-4" />} tone="amber" hint={`${entries.filter((e) => e.direction === 'out').length} payment(s) in ${monthLabel}`} />
        <StatTile label="This month" value={moneyPaise(sum.balance)} icon={<Scale className="h-4 w-4" />} tone={sum.balance < 0 ? 'red' : 'indigo'} hint={sum.balance < 0 ? 'More went out than came in' : 'Money in − money out'} />
        <StatTile label="Balance at month end" value={moneyPaise(bal.closing)} icon={<Wallet className="h-4 w-4" />} tone={bal.closing < 0 ? 'red' : 'blue'} hint={`Brought forward ${moneyPaise(bal.opening)}`} />
      </StatStrip>

      <Segmented
        value={tab}
        onChange={(v) => set({ tab: v === 'entries' ? null : v })}
        options={[
          { value: 'entries', label: 'Entries', count: entries.length },
          { value: 'collect', label: `To collect · ${moneyPaise(sumDue(collect))}`, count: collect.length },
          { value: 'pay', label: `To pay · ${moneyPaise(sumDue(pay))}`, count: pay.length },
          { value: 'summary', label: 'Summary' },
        ]}
      />

      {tab === 'entries' ? <EntriesCard entries={entries} monthLabel={monthLabel} month={month} onEdit={(m) => setEditing(toDraft(m))} onDelete={setDeleting} onNew={(d) => setEditing(blank(d))} /> : null}

      {tab === 'collect' ? (
        <Card className="vx-anim-up overflow-hidden">
          <CardHead title="To collect from customers" subtitle="Sales invoices not fully paid yet, oldest first" icon={<HandCoins className="h-4 w-4" />} />
          {collect.length === 0 ? (
            <EmptyState icon={<HandCoins className="h-6 w-6" />} title="Nothing to collect" message="Every sales invoice is fully paid." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead>
                  <tr>
                    <th className="vx-th">Invoice</th>
                    <th className="vx-th">Date</th>
                    <th className="vx-th">Customer</th>
                    <th className={cx('vx-th', amountClass)}>Invoice total</th>
                    <th className={cx('vx-th', amountClass)}>Received</th>
                    <th className={cx('vx-th', amountClass)}>Still due</th>
                    <th className="vx-th" />
                  </tr>
                </thead>
                <tbody>
                  {collect.map((d) => (
                    <tr key={d.record.id} className="border-t border-rule">
                      <td className="vx-td vx-code font-semibold">{d.record.number}</td>
                      <td className="vx-td">{fmtDate(d.record.issueDate)}</td>
                      <td className="vx-td">{d.record.customer.company}</td>
                      <td className={cx('vx-td', amountClass)}>{moneyPaise(d.total)}</td>
                      <td className={cx('vx-td', amountClass)}>{moneyPaise(d.settled)}</td>
                      <td className={cx('vx-td font-semibold text-ink', amountClass)}>{moneyPaise(d.due)}</td>
                      <td className="vx-td text-right">
                        <Button size="sm" variant="secondary" onClick={() => setEditing(blank('in', { invoiceId: d.record.id, amount: d.due, party: d.record.customer.company }))}>
                          Record payment…
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}

      {tab === 'pay' ? (
        <Card className="vx-anim-up overflow-hidden">
          <CardHead title="To pay suppliers" subtitle="Purchase bills not fully paid yet, oldest first" icon={<ArrowUpRight className="h-4 w-4" />} />
          {pay.length === 0 ? (
            <EmptyState icon={<ArrowUpRight className="h-6 w-6" />} title="Nothing to pay" message="Every purchase bill is fully paid." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead>
                  <tr>
                    <th className="vx-th">Bill</th>
                    <th className="vx-th">Date</th>
                    <th className="vx-th">Supplier</th>
                    <th className={cx('vx-th', amountClass)}>Bill total</th>
                    <th className={cx('vx-th', amountClass)}>Paid</th>
                    <th className={cx('vx-th', amountClass)}>Still due</th>
                    <th className="vx-th" />
                  </tr>
                </thead>
                <tbody>
                  {pay.map((d) => (
                    <tr key={d.record.id} className="border-t border-rule">
                      <td className="vx-td">
                        <span className="vx-code font-semibold">{d.record.code}</span>
                        {d.record.supplierInvoiceNo ? <span className="block text-2xs text-faint">Their no. {d.record.supplierInvoiceNo}</span> : null}
                      </td>
                      <td className="vx-td">{fmtDate(d.record.date)}</td>
                      <td className="vx-td">{d.record.supplierName}</td>
                      <td className={cx('vx-td', amountClass)}>{moneyPaise(d.total)}</td>
                      <td className={cx('vx-td', amountClass)}>{moneyPaise(d.settled)}</td>
                      <td className={cx('vx-td font-semibold text-ink', amountClass)}>{moneyPaise(d.due)}</td>
                      <td className="vx-td text-right">
                        <Button size="sm" variant="secondary" onClick={() => setEditing(blank('out', { purchaseId: d.record.id, amount: d.due, party: d.record.supplierName }))}>
                          Record payment…
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}

      {tab === 'summary' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {(['in', 'out'] as const).map((dir) => {
            const rows = sum.byCategory.filter((c) => c.direction === dir)
            const total = dir === 'in' ? sum.moneyIn : sum.moneyOut
            return (
              <Card key={dir} className="vx-anim-up overflow-hidden">
                <CardHead title={dir === 'in' ? 'Money in by kind' : 'Money out by kind'} subtitle={`${monthLabel} · ${moneyPaise(total)}`} />
                {rows.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-muted">Nothing recorded this month.</p>
                ) : (
                  <ul className="divide-y divide-rule">
                    {rows.map((c) => (
                      <li key={c.category} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                        <span className="min-w-0">
                          <span className="block text-ink">{c.category}</span>
                          <span className="text-2xs text-faint">
                            {c.count} entr{c.count === 1 ? 'y' : 'ies'} · {total ? Math.round((c.amount / total) * 100) : 0}%
                          </span>
                        </span>
                        <span className="font-semibold text-ink tabular-nums">{moneyPaise(c.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )
          })}
          <Card className="vx-anim-up overflow-hidden lg:col-span-2">
            <CardHead title="How the money moved" subtitle="By payment mode, this month" />
            {sum.byMode.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">Nothing recorded this month.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="vx-th">Mode</th>
                    <th className={cx('vx-th', amountClass)}>Money in</th>
                    <th className={cx('vx-th', amountClass)}>Money out</th>
                  </tr>
                </thead>
                <tbody>
                  {sum.byMode.map((m) => (
                    <tr key={m.mode} className="border-t border-rule">
                      <td className="vx-td">{MODE_LABEL[m.mode]}</td>
                      <td className={cx('vx-td', amountClass)}>{moneyPaise(m.moneyIn)}</td>
                      <td className={cx('vx-td', amountClass)}>{moneyPaise(m.moneyOut)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      ) : null}

      {editing ? <MoneyEditor draft={editing} onClose={() => setEditing(null)} /> : null}

      <ConfirmDialog
        open={!!deleting}
        tone="danger"
        title={`Delete ${deleting?.code ?? 'entry'}?`}
        body={deleting ? `${deleting.direction === 'in' ? 'Money in' : 'Money out'} of ${moneyPaise(deleting.amount)} on ${fmtDate(deleting.date)} (${deleting.category}${deleting.party ? `, ${deleting.party}` : ''}) is removed. Any invoice or bill it paid becomes due again.` : ''}
        confirmLabel="Delete entry"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          const entry = deleting
          setDeleting(null)
          if (!entry) return
          const r = await run(deleteMoneyEntry(entry.id))
          if (!r.ok) pushToast({ title: 'Could not delete', message: r.error, level: 'danger' })
          else pushToast({ title: `${entry.code} deleted`, level: 'success' })
        }}
      />
    </div>
  )
}

function EntriesCard({ entries, month, monthLabel, onEdit, onDelete, onNew }: { entries: MoneyEntry[]; month: string; monthLabel: string; onEdit: (m: MoneyEntry) => void; onDelete: (m: MoneyEntry) => void; onNew: (d: MoneyDirection) => void }) {
  const { db } = useStore()
  const doc = (m: MoneyEntry) => (m.invoiceId ? db.invoices.find((i) => i.id === m.invoiceId)?.number : m.purchaseId ? db.purchases.find((p) => p.id === m.purchaseId)?.code : null)
  const table = (): ReportTable => {
    const s = summarise(entries)
    return {
      name: `Income & expenses ${month}`,
      internal: true,
      heading: [db.company.name, `Income & expenses — ${monthLabel}`],
      columns: [
        { label: 'Date', width: 12 },
        { label: 'No.', width: 11 },
        { label: 'In / Out', width: 9 },
        { label: 'Kind', width: 22, wrap: true },
        { label: 'Party', width: 26, wrap: true },
        { label: 'Mode', width: 13 },
        { label: 'Invoice / bill', width: 18 },
        { label: 'Money in', width: 14, numeric: true },
        { label: 'Money out', width: 14, numeric: true },
      ],
      rows: [
        ...[...entries].reverse().map((m) => ({
          kind: 'row' as const,
          cells: [fmtDate(m.date), m.code, m.direction === 'in' ? 'In' : 'Out', m.category, m.party, MODE_LABEL[m.mode], doc(m) ?? '', m.direction === 'in' ? m.amount : null, m.direction === 'out' ? m.amount : null],
        })),
        { kind: 'grand' as const, cells: ['Total', '', '', '', '', '', '', s.moneyIn, s.moneyOut] },
        { kind: 'total' as const, cells: ['Balance (in − out)', '', '', '', '', '', '', s.balance, null] },
      ],
    }
  }
  return (
    <Card className="vx-anim-up overflow-hidden">
      <CardHead
        title={`Entries — ${monthLabel}`}
        subtitle="Newest first"
        actions={entries.length ? <ExcelButton size="sm" variant="secondary" stem={`income-expenses-${month}`} table={table} aria-label={`Download ${monthLabel} entries as a spreadsheet`} /> : undefined}
      />
      {entries.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-6 w-6" />}
          title={`Nothing recorded in ${monthLabel}`}
          message="Record money a customer paid you, or money you paid out — a supplier, salary, electricity, rent."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => onNew('in')}>
                Money in…
              </Button>
              <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => onNew('out')}>
                Money out…
              </Button>
            </div>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr>
                <th className="vx-th">Date</th>
                <th className="vx-th">No.</th>
                <th className="vx-th">Kind</th>
                <th className="vx-th">Party</th>
                <th className="vx-th">Mode</th>
                <th className={cx('vx-th', amountClass)}>Money in</th>
                <th className={cx('vx-th', amountClass)}>Money out</th>
                <th className="vx-th" />
              </tr>
            </thead>
            <tbody>
              {entries.map((m) => (
                <tr key={m.id} className="border-t border-rule">
                  <td className="vx-td">{fmtDate(m.date)}</td>
                  <td className="vx-td">
                    <span className="vx-code font-semibold">{m.code}</span>
                    <Badge tone={m.direction === 'in' ? 'green' : 'amber'} className="ml-2">
                      {m.direction === 'in' ? 'In' : 'Out'}
                    </Badge>
                  </td>
                  <td className="vx-td">
                    {m.category}
                    {doc(m) ? <span className="block text-2xs text-faint">for {doc(m)}</span> : null}
                  </td>
                  <td className="vx-td">
                    <span className="block max-w-[16rem] truncate">{m.party || '—'}</span>
                    {m.notes ? <span className="block max-w-[16rem] truncate text-2xs text-faint">{m.notes}</span> : null}
                  </td>
                  <td className="vx-td">
                    {MODE_LABEL[m.mode]}
                    {m.reference ? <span className="block text-2xs text-faint">{m.reference}</span> : null}
                  </td>
                  <td className={cx('vx-td font-semibold text-ok', amountClass)}>{m.direction === 'in' ? moneyPaise(m.amount) : ''}</td>
                  <td className={cx('vx-td font-semibold text-ink', amountClass)}>{m.direction === 'out' ? moneyPaise(m.amount) : ''}</td>
                  <td className="vx-td">
                    <span className="flex justify-end gap-1">
                      <IconButton label={`Edit ${m.code}`} onClick={() => onEdit(m)}>
                        <Pencil className="h-4 w-4" />
                      </IconButton>
                      <IconButton label={`Delete ${m.code}`} onClick={() => onDelete(m)}>
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

const CATEGORY_LIST_ID = 'vx-money-categories'

function MoneyEditor({ draft, onClose }: { draft: MoneyDraft; onClose: () => void }) {
  const { db, run, pushToast } = useStore()
  const [d, setD] = useState<MoneyDraft>(draft)
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const editing = !!draft.id
  const errors = touched ? validateMoney(d, db) : {}
  const set = (patch: Partial<MoneyDraft>) => setD((x) => ({ ...x, ...patch }))
  const isIn = d.direction === 'in'

  // Documents still due — plus the one this entry already pays, when editing.
  const invoices = useMemo(() => toCollect(db, false, d.id || undefined), [db, d.id])
  const bills = useMemo(() => toPay(db, false, d.id || undefined), [db, d.id])
  const linked = isIn ? invoices.find((x) => x.record.id === d.invoiceId) : bills.find((x) => x.record.id === d.purchaseId)

  const save = async () => {
    setTouched(true)
    if (Object.keys(validateMoney(d, db)).length || inFlight.current) return
    inFlight.current = true
    setSaving(true)
    setServerError(null)
    try {
      const r = await run(saveMoneyEntry({ ...d, party: d.party.trim(), reference: d.reference.trim(), notes: d.notes.trim() }))
      if (!r.ok) {
        setServerError(r.error)
        return
      }
      pushToast({ title: `${r.value.code} saved`, message: `${r.value.direction === 'in' ? 'Money in' : 'Money out'} ${moneyPaise(r.value.amount)}.`, level: 'success' })
      onClose()
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      icon={isIn ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
      title={editing ? `Edit ${draft.id ? (db.cashbook.find((m) => m.id === draft.id)?.code ?? '') : ''}` : isIn ? 'Money in' : 'Money out'}
      subtitle={isIn ? 'Money you received — from a customer against an invoice, or any other income.' : 'Money you paid — a supplier’s bill, salary, electricity, rent or any other expense.'}
      footer={
        <>
          {serverError ? (
            <p role="alert" className="mr-auto text-sm text-risk">
              {serverError}
            </p>
          ) : null}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="money-form" loading={saving}>
            {editing ? 'Save changes' : isIn ? 'Save money in' : 'Save money out'}
          </Button>
        </>
      }
    >
      <form
        id="money-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
        className="grid gap-x-4 gap-y-1 sm:grid-cols-2"
      >
        {!editing ? (
          <div className="sm:col-span-2 mb-2">
            <Segmented
              value={d.direction}
              onChange={(v) => set({ direction: v, category: v === 'in' ? CUSTOMER_PAYMENT : SUPPLIER_PAYMENT, invoiceId: null, purchaseId: null })}
              options={[
                { value: 'in', label: 'Money in' },
                { value: 'out', label: 'Money out' },
              ]}
            />
          </div>
        ) : null}

        <Field label="Kind" required error={errors.category} hint="Choose one, or type your own">
          <Input
            name="category"
            list={CATEGORY_LIST_ID}
            value={d.category}
            autoComplete="off"
            onChange={(e) => set({ category: e.target.value, ...(e.target.value !== CUSTOMER_PAYMENT && e.target.value !== SUPPLIER_PAYMENT ? { invoiceId: null, purchaseId: null } : {}) })}
            placeholder={isIn ? 'e.g. Customer payment…' : 'e.g. Electricity…'}
          />
          <datalist id={CATEGORY_LIST_ID}>
            {CATEGORIES[d.direction].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>

        {isIn && d.category === CUSTOMER_PAYMENT ? (
          <Field label="For invoice" error={errors.invoiceId} hint={linked ? `Still due ${moneyPaise(linked.due)}` : 'Optional — choose the invoice this pays'}>
            <Select
              value={d.invoiceId ?? ''}
              onChange={(e) => {
                const inv = invoices.find((x) => x.record.id === e.target.value)
                set({ invoiceId: e.target.value || null, ...(inv ? { party: inv.record.customer.company, amount: Number.isFinite(d.amount) ? d.amount : inv.due } : {}) })
              }}
            >
              <option value="">— Not for a particular invoice —</option>
              {invoices.map((x) => (
                <option key={x.record.id} value={x.record.id}>
                  {x.record.number} · {x.record.customer.company} · due {moneyPaise(x.due)}
                </option>
              ))}
            </Select>
          </Field>
        ) : !isIn && d.category === SUPPLIER_PAYMENT ? (
          <Field label="For purchase bill" error={errors.purchaseId} hint={linked ? `Still due ${moneyPaise(linked.due)}` : 'Optional — choose the bill this pays'}>
            <Select
              value={d.purchaseId ?? ''}
              onChange={(e) => {
                const bill = bills.find((x) => x.record.id === e.target.value)
                set({ purchaseId: e.target.value || null, ...(bill ? { party: bill.record.supplierName, amount: Number.isFinite(d.amount) ? d.amount : bill.due } : {}) })
              }}
            >
              <option value="">— Not for a particular bill —</option>
              {bills.map((x) => (
                <option key={x.record.id} value={x.record.id}>
                  {x.record.code} · {x.record.supplierName} · due {moneyPaise(x.due)}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <div className="hidden sm:block" />
        )}

        <Field label="Amount (₹)" required error={errors.amount} as="div">
          <NumberInput value={d.amount} onChange={(v) => set({ amount: v ?? NaN })} invalid={!!errors.amount} aria-label="Amount in rupees" inputMode="decimal" placeholder="0.00" />
        </Field>
        <Field label="Date" required error={errors.date}>
          <Input type="date" name="date" value={d.date} onChange={(e) => set({ date: e.target.value })} />
        </Field>

        <Field label={isIn ? 'Received from' : 'Paid to'} error={errors.party}>
          <Input name="party" value={d.party} autoComplete="off" onChange={(e) => set({ party: e.target.value })} placeholder={isIn ? 'Customer or person…' : 'Supplier, person or office…'} />
        </Field>
        <Field label="Mode" required error={errors.mode}>
          <Select value={d.mode} onChange={(e) => set({ mode: e.target.value as MoneyMode })}>
            {MODES.map((m) => (
              <option key={m} value={m}>
                {MODE_LABEL[m]}
              </option>
            ))}
          </Select>
        </Field>

        {d.mode !== 'cash' ? (
          <Field label={d.mode === 'cheque' ? 'Cheque number' : 'Reference'} hint="Optional">
            <Input name="reference" value={d.reference} spellCheck={false} autoComplete="off" onChange={(e) => set({ reference: e.target.value })} placeholder={d.mode === 'upi' ? 'UPI ref. no.…' : d.mode === 'cheque' ? 'e.g. 104233…' : 'UTR / transaction no.…'} />
          </Field>
        ) : null}
        <Field label="Notes" hint="Optional" className={d.mode !== 'cash' ? '' : 'sm:col-span-2'}>
          <Textarea name="notes" rows={2} value={d.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Anything to remember…" />
        </Field>
      </form>
    </Modal>
  )
}
