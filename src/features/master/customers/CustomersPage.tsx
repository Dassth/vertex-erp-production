import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Building2, FileWarning, Plus, ReceiptText, Save, Search, Users } from 'lucide-react'
import { useStore } from '../../../store/store'
import type { Customer } from '../../../lib/types'
import type { CustomerDraft } from '../../../domain/master'
import { blankCustomerDraft, deleteCustomer, saveCustomer, setCustomerActive } from '../../../domain/master'
import { cx, fmtDate, money } from '../../../lib/format'
import { Badge, Button, Card, CardHead, ConfirmDialog, EmptyState, Field, Input, SearchInput, Select, Textarea } from '../../../components/ui'
import { ConflictNotice, PageHeader, StatStrip, StatTile, focusFirstInvalid, useDocumentTitle, useUnsavedChanges } from '../../../components/page'
import { ActiveBadge, PlanStatusBadge } from '../../../components/status'

const toDraft = (c?: Customer): CustomerDraft =>
  c
    ? {
        id: c.id,
        code: c.code,
        company: c.company,
        contactPerson: c.contactPerson,
        phone: c.phone,
        email: c.email,
        billingAddress: c.billingAddress,
        deliveryAddress: c.deliveryAddress,
        gstin: c.gstin,
        placeOfSupply: c.placeOfSupply,
        paymentTerms: c.paymentTerms,
        notes: c.notes,
        expectedUpdatedAt: c.updatedAt,
      }
    : blankCustomerDraft()

export function CustomersPage() {
  useDocumentTitle('Master · Customers')
  const { db } = useStore()
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('id')
  const q = params.get('q') ?? ''
  const status = params.get('status') ?? 'active'

  const set = (patch: Record<string, string | null>, replace = true) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace })
  }

  const list = useMemo(
    () =>
      db.customers
        .filter((c) => (status === 'active' ? c.active : status === 'inactive' ? !c.active : status === 'incomplete' ? !c.gstin || !c.billingAddress : true))
        .filter((c) => !q.trim() || `${c.company} ${c.code} ${c.contactPerson} ${c.phone} ${c.email} ${c.gstin}`.toLowerCase().includes(q.trim().toLowerCase()))
        .sort((a, b) => a.company.localeCompare(b.company)),
    [db.customers, q, status],
  )

  const selected = selectedId && selectedId !== 'new' ? db.customers.find((c) => c.id === selectedId) : undefined
  const withOrders = new Set(db.plans.map((p) => p.customerId)).size

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Master"
        title="Customers"
        subtitle="Billing, delivery, GST and payment details. Planning selects customers from here; issued documents keep the details they were created with."
        icon={<Building2 className="h-4 w-4" />}
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => set({ id: 'new' }, false)}>
            New customer
          </Button>
        }
      />

      <StatStrip className="grid-cols-2 lg:grid-cols-4">
        <StatTile label="Customers" value={String(db.customers.length)} icon={<Users className="h-4 w-4" />} tone="indigo" hint="In the master" onClick={() => set({ status: 'all' })} active={status === 'all'} />
        <StatTile label="Active" value={String(db.customers.filter((c) => c.active).length)} icon={<Building2 className="h-4 w-4" />} tone="green" hint="Selectable in planning" onClick={() => set({ status: 'active' })} active={status === 'active'} />
        <StatTile label="Incomplete" value={String(db.customers.filter((c) => !c.gstin || !c.billingAddress).length)} icon={<FileWarning className="h-4 w-4" />} tone="amber" hint="GSTIN or billing address" onClick={() => set({ status: 'incomplete' })} active={status === 'incomplete'} />
        <StatTile label="With orders" value={String(withOrders)} icon={<ReceiptText className="h-4 w-4" />} tone="slate" hint="Referenced by plans" />
      </StatStrip>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)] xl:items-start">
        <Card className="vx-anim-up flex max-h-[820px] flex-col overflow-hidden">
          <div className="space-y-2.5 border-b border-rule bg-surface-2 p-4">
            <SearchInput value={q} onChange={(v) => set({ q: v })} placeholder="Search company, contact, GSTIN…" />
            <Select aria-label="Filter customers" value={status} onChange={(e) => set({ status: e.target.value })}>
              <option value="active">Active customers</option>
              <option value="inactive">Inactive customers</option>
              <option value="incomplete">Incomplete details</option>
              <option value="all">All customers</option>
            </Select>
          </div>
          <div className="flex-1 overflow-y-auto">
            {db.customers.length === 0 ? (
              <EmptyState icon={<Users className="h-6 w-6" />} title="No customers yet" message="Add the first customer to start planning orders." action={<Button onClick={() => set({ id: 'new' }, false)}>Add customer</Button>} />
            ) : list.length === 0 ? (
              <EmptyState icon={<Search className="h-6 w-6" />} title="No customer found" message="Try another search or filter." />
            ) : (
              <ul>
                {list.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => set({ id: c.id }, false)}
                      aria-current={selectedId === c.id ? 'true' : undefined}
                      className={cx('vx-press vx-focus relative flex w-full items-center gap-3 border-b border-rule px-4 py-3 text-left', selectedId === c.id ? 'bg-accent-wash' : 'hover:bg-surface-2')}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-semibold text-ink">{c.company}</span>
                        <span className="block truncate text-xs text-muted">
                          <span className="vx-code">{c.code}</span>
                          {c.contactPerson ? ` · ${c.contactPerson}` : ''}
                        </span>
                      </span>
                      {!c.active ? <Badge tone="slate">Inactive</Badge> : !c.gstin ? <Badge tone="amber">No GSTIN</Badge> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {selectedId === 'new' || selected ? (
          <CustomerForm key={selectedId} customer={selected} onSaved={(id) => set({ id }, true)} onClosed={() => set({ id: null })} />
        ) : (
          <Card className="vx-anim-up">
            <EmptyState icon={<Building2 className="h-6 w-6" />} title="Select a customer" message="Choose a customer from the list to view or edit their details, or create a new one." />
          </Card>
        )}
      </div>
    </div>
  )
}

function CustomerForm({ customer, onSaved, onClosed }: { customer?: Customer; onSaved: (id: string) => void; onClosed: () => void }) {
  const { db, run, pushToast } = useStore()
  const [draft, setDraft] = useState<CustomerDraft>(() => toDraft(customer))
  const [baseline, setBaseline] = useState(() => JSON.stringify(toDraft(customer)))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sameAsBilling, setSameAsBilling] = useState(() => !!customer && (!customer.deliveryAddress || customer.deliveryAddress === customer.billingAddress))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [conflict, setConflict] = useState('')
  const saving = useRef(false)
  const dirty = JSON.stringify(draft) !== baseline
  const guard = useUnsavedChanges(dirty)
  const plans = customer ? db.plans.filter((p) => p.customerId === customer.id) : []
  const invoices = customer ? db.invoices.filter((i) => i.customer.id === customer.id) : []

  const patch = (p: Partial<CustomerDraft>) =>
    setDraft((d) => {
      const next = { ...d, ...p }
      if (sameAsBilling && p.billingAddress !== undefined) next.deliveryAddress = p.billingAddress
      return next
    })

  const loadLatest = () => {
    const next = toDraft(db.customers.find((c) => c.id === customer?.id))
    setDraft(next)
    setBaseline(JSON.stringify(next))
    setErrors({})
    setConflict('')
  }

  // Another tab saved this customer: follow along unless there are unsaved edits here.
  useEffect(() => {
    if (!customer || dirty || customer.updatedAt === draft.expectedUpdatedAt) return
    loadLatest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.updatedAt])

  const save = async () => {
    if (saving.current) return
    saving.current = true
    const r = await run(saveCustomer(draft))
    saving.current = false
    if (!r.ok) {
      if (r.conflict) setConflict(r.error)
      setErrors(r.fieldErrors ?? {})
      focusFirstInvalid()
      return
    }
    setErrors({})
    const saved = toDraft(r.value)
    setDraft(saved)
    setBaseline(JSON.stringify(saved))
    pushToast({ title: customer ? 'Customer updated' : 'Customer created', message: customer ? 'Issued invoices keep the details they were created with.' : `${r.value.code} is available in Planning.`, level: 'success' })
    if (!customer) {
      guard.bypass()
      onSaved(r.value.id)
    }
  }

  const e = (k: string) => errors[k]

  return (
    <div className="space-y-5">
      <Card className="vx-anim-up">
        <CardHead
          title={customer ? customer.company : 'New customer'}
          subtitle={customer ? `${customer.code} · created ${fmtDate(customer.createdAt)} by ${customer.createdBy}` : 'Company, addresses, GST and terms'}
          actions={customer ? <ActiveBadge active={customer.active} /> : null}
        />
        {conflict ? (
          <div className="px-5 pt-4">
            <ConflictNotice message={conflict} onReload={loadLatest} />
          </div>
        ) : null}
        <form
          className="grid gap-x-4 p-5 sm:grid-cols-2"
          noValidate
          onSubmit={(ev) => {
            ev.preventDefault()
            save()
          }}
        >
          <Field label="Company name" required error={e('company')} className="sm:col-span-2">
            <Input name="organization" autoComplete="organization" value={draft.company} onChange={(ev) => patch({ company: ev.target.value })} aria-invalid={!!e('company') || undefined} />
          </Field>
          <Field label="Contact person">
            <Input name="name" autoComplete="name" value={draft.contactPerson} onChange={(ev) => patch({ contactPerson: ev.target.value })} />
          </Field>
          <Field label="Customer code" error={e('code')} hint="Blank numbers automatically.">
            <Input spellCheck={false} value={draft.code} onChange={(ev) => patch({ code: ev.target.value })} aria-invalid={!!e('code') || undefined} />
          </Field>
          <Field label="Phone" error={e('phone')}>
            <Input type="tel" name="tel" autoComplete="tel" value={draft.phone} onChange={(ev) => patch({ phone: ev.target.value })} aria-invalid={!!e('phone') || undefined} />
          </Field>
          <Field label="Email" error={e('email')}>
            <Input type="email" name="email" autoComplete="email" spellCheck={false} value={draft.email} onChange={(ev) => patch({ email: ev.target.value })} aria-invalid={!!e('email') || undefined} />
          </Field>
          <Field label="Billing address" required error={e('billingAddress')} className="sm:col-span-2">
            <Textarea rows={3} name="billing-address" autoComplete="billing street-address" value={draft.billingAddress} onChange={(ev) => patch({ billingAddress: ev.target.value })} aria-invalid={!!e('billingAddress') || undefined} />
          </Field>
          <div className="sm:col-span-2">
            <label className="mb-2 flex min-h-6 cursor-pointer items-center gap-2 text-sm text-ink-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--color-accent)]"
                checked={sameAsBilling}
                onChange={(ev) => {
                  setSameAsBilling(ev.target.checked)
                  if (ev.target.checked) setDraft((d) => ({ ...d, deliveryAddress: d.billingAddress }))
                }}
              />
              Delivery address is the same as billing
            </label>
            {!sameAsBilling ? (
              <Field label="Delivery address" hint="Default destination on dispatches; can be changed per dispatch.">
                <Textarea rows={3} name="shipping-address" autoComplete="shipping street-address" value={draft.deliveryAddress} onChange={(ev) => patch({ deliveryAddress: ev.target.value })} />
              </Field>
            ) : null}
          </div>
          <Field label="GSTIN" error={e('gstin')} hint="Optional for unregistered customers.">
            <Input spellCheck={false} value={draft.gstin} onChange={(ev) => patch({ gstin: ev.target.value.toUpperCase() })} aria-invalid={!!e('gstin') || undefined} placeholder="15-character GSTIN…" />
          </Field>
          <Field label="Place of supply" hint="State name or 2-digit state code.">
            <Input value={draft.placeOfSupply} onChange={(ev) => patch({ placeOfSupply: ev.target.value })} />
          </Field>
          <Field label="Payment terms" className="sm:col-span-2">
            <Input value={draft.paymentTerms} onChange={(ev) => patch({ paymentTerms: ev.target.value })} placeholder="e.g. 30 days from invoice…" />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea rows={2} value={draft.notes} onChange={(ev) => patch({ notes: ev.target.value })} />
          </Field>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <Button type="submit" icon={<Save className="h-4 w-4" />} disabled={!dirty && !!customer}>
              {customer ? 'Save changes' : 'Create customer'}
            </Button>
            <span className="text-xs text-muted" aria-live="polite">
              {dirty ? 'Unsaved changes' : customer ? 'Saved' : ''}
            </span>
            {customer ? (
              <span className="ml-auto flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const r = await run(setCustomerActive(customer.id, !customer.active))
                    if (r.ok) pushToast({ title: customer.active ? 'Customer deactivated' : 'Customer reactivated', message: customer.active ? 'Existing plans, orders and invoices are unaffected.' : undefined, level: 'info' })
                  }}
                >
                  {customer.active ? 'Deactivate' : 'Activate'}
                </Button>
                {!plans.length ? (
                  <Button type="button" size="sm" variant="ghost" className="text-risk hover:bg-risk-wash" onClick={() => setConfirmDelete(true)}>
                    Delete…
                  </Button>
                ) : null}
              </span>
            ) : (
              <Button type="button" variant="ghost" onClick={onClosed}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Card>

      {customer ? (
        <Card className="vx-anim-up overflow-hidden">
          <CardHead title="History" subtitle={`${plans.length} plan(s) · ${invoices.length} invoice(s) · ${money(invoices.reduce((s, i) => s + i.total, 0))} billed`} />
          {plans.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-muted">No plans for this customer yet.</p>
          ) : (
            <ul className="divide-y divide-rule">
              {plans.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
                  <Link to={`/planning/${p.id}`} className="vx-code vx-focus rounded-xs font-medium text-accent-text hover:underline">
                    {p.code}
                  </Link>
                  <span className="min-w-0 flex-1 truncate text-ink-2">
                    {db.products.find((x) => x.id === p.productId)?.name ?? '—'} · {p.quantity.toLocaleString('en-IN')} pcs
                  </span>
                  <PlanStatusBadge status={p.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        tone="danger"
        title={`Delete ${customer?.company ?? ''}?`}
        body="This customer has no plans or documents and will be removed."
        confirmLabel="Delete customer"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          if (!customer) return
          const r = await run(deleteCustomer(customer.id))
          setConfirmDelete(false)
          if (r.ok) {
            guard.bypass()
            onClosed()
          } else pushToast({ title: 'Cannot delete', message: r.error, level: 'danger' })
        }}
      />
      {guard.dialog}
    </div>
  )
}
