import { useMemo, useState } from 'react'
import { Download, Mail, Pencil, Phone, Plus, Truck } from 'lucide-react'
import { useStore } from '../../../store/store'
import type { Supplier, VertexDB } from '../../../lib/types'
import { blankSupplier, saveSupplier, setSupplierActive, validateSupplier } from '../../../domain/suppliers'
import type { SupplierDraft } from '../../../domain/suppliers'
import { sameText } from '../../../domain/common'
import { purchaseTotals } from '../../../lib/gst'
import { cx, moneyPaise } from '../../../lib/format'
import type { ReportTable } from '../../../lib/reportTable'
import { Badge, Button, Card, CardHead, EmptyState, Field, Input, Modal, SearchInput, Textarea } from '../../../components/ui'
import { PageHeader, StatStrip, StatTile, focusFirstInvalid, openRow, useDocumentTitle } from '../../../components/page'
import { DownloadButton, ExcelButton, reportTableDoc, useLatestDb } from '../../../components/DocumentPreview'

/* ---------------------------------------------------------------------------
 * Master → Suppliers: who sells us materials and how to reach them, with
 * what we buy from each (materials) and what we bought (purchase bills).
 * ------------------------------------------------------------------------- */

function supplierStats(db: VertexDB, s: Supplier) {
  const materials = db.materials.filter((m) => sameText(m.supplier, s.name))
  const bills = (db.purchases ?? []).filter((b) => sameText(b.supplierName, s.name))
  const bought = bills.reduce((n, b) => n + purchaseTotals(b, db.company).net, 0)
  return { materials, bills, bought }
}

export function suppliersTable(db: VertexDB): ReportTable {
  const list = [...(db.suppliers ?? [])].sort((a, b) => a.name.localeCompare(b.name))
  return {
    name: 'Suppliers',
    internal: true,
    heading: [db.company.name, 'Suppliers'],
    columns: [
      { label: 'Code', width: 10 },
      { label: 'Supplier', width: 26, wrap: true },
      { label: 'Contact', width: 18, wrap: true },
      { label: 'Phone', width: 15 },
      { label: 'Email', width: 24, wrap: true },
      { label: 'GSTIN', width: 17 },
      { label: 'Address', width: 30, wrap: true },
      { label: 'Materials', width: 10, numeric: true },
      { label: 'Bought (₹)', width: 14, numeric: true },
    ],
    rows: list.map((s) => {
      const st = supplierStats(db, s)
      return { kind: 'row' as const, cells: [s.code, s.name, s.contactPerson, s.phone, s.email, s.gstin, s.address, st.materials.length, Math.round(st.bought * 100) / 100] }
    }),
  }
}

const toDraft = (s: Supplier): SupplierDraft => ({ id: s.id, name: s.name, contactPerson: s.contactPerson, phone: s.phone, email: s.email, address: s.address, gstin: s.gstin, notes: s.notes, expectedUpdatedAt: s.updatedAt })

export function SuppliersPage() {
  useDocumentTitle('Master · Suppliers')
  const { db, can, run, pushToast } = useStore()
  const read = useLatestDb()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<SupplierDraft | null>(null)
  const rows = useMemo(
    () =>
      [...(db.suppliers ?? [])]
        .filter((s) => !q.trim() || `${s.name} ${s.contactPerson} ${s.phone} ${s.email} ${s.gstin} ${s.code}`.toLowerCase().includes(q.trim().toLowerCase()))
        .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
        .map((s) => ({ s, ...supplierStats(db, s) })),
    [db, q],
  )
  const all = db.suppliers ?? []
  const missingContact = all.filter((s) => !s.phone && !s.email).length

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Master"
        title="Suppliers"
        subtitle="Who sells you materials and how to reach them. A supplier named on a material or a purchase bill is added here by itself — fill in the rest any time."
        icon={<Truck className="h-4 w-4" />}
        actions={
          <div className="flex flex-wrap gap-2">
            {all.length ? (
              <>
                <DownloadButton variant="secondary" icon={<Download className="h-4 w-4" />} doc={() => reportTableDoc(read, suppliersTable, 'Suppliers', 'suppliers.pdf')}>
                  PDF
                </DownloadButton>
                <ExcelButton variant="secondary" stem="suppliers" table={() => suppliersTable(read())} aria-label="Download the suppliers as a spreadsheet" />
              </>
            ) : null}
            {can('master') ? (
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing(blankSupplier())}>
                Add supplier…
              </Button>
            ) : null}
          </div>
        }
      />

      <StatStrip className="grid-cols-2 lg:grid-cols-3">
        <StatTile label="Suppliers" value={String(all.length)} icon={<Truck className="h-4 w-4" />} tone="indigo" hint={`${all.filter((s) => s.active).length} active`} />
        <StatTile label="No phone or email" value={String(missingContact)} icon={<Phone className="h-4 w-4" />} tone="amber" hint="Add how to reach them" />
        <StatTile label="Bought from suppliers" value={moneyPaise(rows.reduce((n, r) => n + r.bought, 0))} icon={<Download className="h-4 w-4" />} tone="green" hint="All purchase bills" />
      </StatStrip>

      <Card className="vx-anim-up overflow-hidden">
        <CardHead title="Supplier list" subtitle={`${rows.length} of ${all.length}`} actions={<SearchInput value={q} onChange={setQ} placeholder="Search name, phone, GSTIN…" className="w-full sm:w-64" />} />
        {all.length === 0 ? (
          <EmptyState icon={<Truck className="h-6 w-6" />} title="No suppliers yet" message="Add one here, or name a supplier on a material or a purchase bill — it appears here by itself." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px]">
              <thead>
                <tr>
                  <th className="vx-th">Supplier</th>
                  <th className="vx-th">Contact</th>
                  <th className="vx-th">GSTIN</th>
                  <th className="vx-th">Materials</th>
                  <th className="vx-th text-right">Bought</th>
                  <th className="vx-th">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ s, materials, bills, bought }) => (
                  <tr key={s.id} {...(can('master') ? openRow(() => setEditing(toDraft(s))) : {})} className={cx('vx-row', can('master') && 'cursor-pointer')}>
                    <td className="vx-td vx-td-wrap">
                      <span className="font-medium text-ink">{s.name}</span>
                      <span className="block text-2xs text-faint">
                        <span className="vx-code">{s.code}</span>
                        {s.address ? ` · ${s.address}` : ''}
                      </span>
                      {!s.active ? <Badge tone="slate">Inactive</Badge> : null}
                    </td>
                    <td className="vx-td vx-td-wrap text-sm">
                      {s.contactPerson ? <span className="block text-ink">{s.contactPerson}</span> : null}
                      {s.phone ? (
                        <a href={`tel:${s.phone.replace(/\s/g, '')}`} className="vx-focus flex items-center gap-1 rounded-xs text-accent-text hover:underline">
                          <Phone className="h-3 w-3" aria-hidden="true" />
                          {s.phone}
                        </a>
                      ) : null}
                      {s.email ? (
                        <a href={`mailto:${s.email}`} className="vx-focus flex items-center gap-1 rounded-xs text-accent-text hover:underline">
                          <Mail className="h-3 w-3" aria-hidden="true" />
                          {s.email}
                        </a>
                      ) : null}
                      {!s.phone && !s.email && !s.contactPerson ? <span className="text-muted">Not added yet</span> : null}
                    </td>
                    <td className="vx-td vx-code text-xs">{s.gstin || '—'}</td>
                    <td className="vx-td vx-td-wrap text-sm text-ink-2">{materials.length ? materials.map((m) => m.name).slice(0, 3).join(', ') + (materials.length > 3 ? ` +${materials.length - 3}` : '') : '—'}</td>
                    <td className="vx-td text-right tabular-nums">
                      {bills.length ? moneyPaise(bought) : '—'}
                      {bills.length ? <span className="block text-2xs text-faint">{bills.length} bill(s)</span> : null}
                    </td>
                    <td className="vx-td">
                      {can('master') ? (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="secondary" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(toDraft(s))} aria-label={`Edit ${s.name}`}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              const r = await run(setSupplierActive(s.id, !s.active))
                              if (!r.ok) pushToast({ title: 'Not changed', message: r.error, level: 'danger' })
                            }}
                          >
                            {s.active ? 'Deactivate' : 'Reactivate'}
                          </Button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {editing ? <SupplierEditor draft={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  )
}

export function SupplierEditor({ draft, onClose, onSaved }: { draft: SupplierDraft; onClose: () => void; onSaved?: (s: Supplier) => void }) {
  const { db, run, pushToast } = useStore()
  const [d, setD] = useState<SupplierDraft>(draft)
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const errors = touched ? validateSupplier(d, db.suppliers ?? []) : {}
  const set = (patch: Partial<SupplierDraft>) => setD((x) => ({ ...x, ...patch }))
  const save = async () => {
    setTouched(true)
    if (busy) return
    if (Object.keys(validateSupplier(d, db.suppliers ?? [])).length) return focusFirstInvalid()
    setBusy(true)
    try {
      const r = await run(saveSupplier(d))
      if (!r.ok) return pushToast({ title: 'Supplier not saved', message: r.error, level: 'danger' })
      pushToast({ title: d.id ? 'Supplier updated' : `${r.value.name} added`, level: 'success' })
      onSaved?.(r.value)
      onClose()
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={d.id ? 'Edit supplier' : 'New supplier'}
      subtitle="Only the name is needed — the rest can be added later."
      icon={<Truck className="h-5 w-5" />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void save()}>
            Save supplier
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="grid gap-x-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Field label="Supplier name" required error={errors.name} className="sm:col-span-2">
          <Input value={d.name} onChange={(e) => set({ name: e.target.value })} aria-invalid={!!errors.name || undefined} autoComplete="organization" />
        </Field>
        <Field label="Contact person">
          <Input value={d.contactPerson} onChange={(e) => set({ contactPerson: e.target.value })} autoComplete="name" />
        </Field>
        <Field label="Phone">
          <Input type="tel" inputMode="tel" value={d.phone} onChange={(e) => set({ phone: e.target.value })} autoComplete="tel" placeholder="+91 …" />
        </Field>
        <Field label="Email" error={errors.email}>
          <Input type="email" value={d.email} onChange={(e) => set({ email: e.target.value })} aria-invalid={!!errors.email || undefined} autoComplete="email" spellCheck={false} />
        </Field>
        <Field label="GSTIN" error={errors.gstin}>
          <Input value={d.gstin} onChange={(e) => set({ gstin: e.target.value.toUpperCase() })} aria-invalid={!!errors.gstin || undefined} spellCheck={false} placeholder="15-character GSTIN…" />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <Textarea rows={2} value={d.address} onChange={(e) => set({ address: e.target.value })} autoComplete="street-address" />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Input value={d.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="What they supply, credit days…" />
        </Field>
      </form>
    </Modal>
  )
}
