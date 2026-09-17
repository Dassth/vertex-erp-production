import { useEffect, useState } from 'react'
import { Percent, Plus, Receipt, Save, Wrench } from 'lucide-react'
import { useStore } from '../../../store/store'
import type { ChargeBasis, CostBasis, OrderChargeTemplate, ProcessCharge, ProfitMethod } from '../../../lib/types'
import type { CostingDefaultsDraft, OrderChargeDraft, ProcessChargeDraft } from '../../../domain/master'
import {
  deleteOrderChargeTemplate,
  deleteProcessCharge,
  productsUsingCharge,
  saveCostingDefaults,
  saveOrderChargeTemplate,
  saveProcessCharge,
  setProcessChargeActive,
} from '../../../domain/master'
import { COST_BASIS_LABEL } from '../../../lib/costing'
import { cx, moneyPaise } from '../../../lib/format'
import { Badge, Button, Card, CardHead, ConfirmDialog, EmptyState, Field, Input, Modal, Select } from '../../../components/ui'
import { ConflictNotice, NumberInput, focusFirstInvalid } from '../../../components/page'
import { ActiveBadge } from '../../../components/status'

const rateText = (v: number | null) => (v === null ? 'Not set' : moneyPaise(v))

/* ----------------------------- Process charges ---------------------------- */

export function ProcessChargesPanel() {
  const { db, run, pushToast } = useStore()
  const [editing, setEditing] = useState<ProcessChargeDraft | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pendingDelete, setPendingDelete] = useState<ProcessCharge | null>(null)
  const charges = db.settings.processCharges

  return (
    <Card className="vx-anim-up overflow-hidden">
      <CardHead
        title="Reusable process charges"
        subtitle="Define a rate once (e.g. die cutting per 1,000) and select it on any product process."
        icon={<Wrench className="h-4 w-4" />}
        actions={
          <Button
            size="sm"
            icon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => {
              setErrors({})
              setEditing({ name: '', basis: 'per_1000', rate: null, setupCharge: 0 })
            }}
          >
            New charge
          </Button>
        }
      />
      {charges.length === 0 ? (
        <EmptyState icon={<Wrench className="h-6 w-6" />} title="No reusable charges" message="Processes can also carry their own custom rate. Create a reusable charge when several products share the same rate." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr>
                <th className="vx-th">Charge</th>
                <th className="vx-th">Basis</th>
                <th className="vx-th text-right">Rate</th>
                <th className="vx-th text-right">Setup charge</th>
                <th className="vx-th">Used by</th>
                <th className="vx-th">Status</th>
                <th className="vx-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {charges.map((c) => {
                const users = productsUsingCharge(db.products, c.id)
                return (
                  <tr key={c.id} className="vx-row">
                    <td className="vx-td font-medium text-ink">{c.name}</td>
                    <td className="vx-td">{COST_BASIS_LABEL[c.basis]}</td>
                    <td className={cx('vx-td text-right tabular-nums', c.rate === null && 'text-risk')}>{rateText(c.rate)}</td>
                    <td className={cx('vx-td text-right tabular-nums', c.setupCharge === null && 'text-risk')}>{rateText(c.setupCharge)}</td>
                    <td className="vx-td vx-td-wrap text-sm">{users.length ? users.map((p) => p.name).join(', ') : <span className="text-faint">Not used</span>}</td>
                    <td className="vx-td">
                      <ActiveBadge active={c.active} />
                    </td>
                    <td className="vx-td">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setErrors({})
                            setEditing({ id: c.id, name: c.name, basis: c.basis, rate: c.rate, setupCharge: c.setupCharge, expectedUpdatedAt: c.updatedAt })
                          }}
                        >
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => run(setProcessChargeActive(c.id, !c.active))}>
                          {c.active ? 'Deactivate' : 'Activate'}
                        </Button>
                        {!users.length ? (
                          <Button size="sm" variant="ghost" className="text-risk hover:bg-risk-wash" onClick={() => setPendingDelete(c)}>
                            Delete…
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit process charge' : 'New process charge'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!editing) return
                const r = await run(saveProcessCharge(editing))
                if (!r.ok) {
                  if (r.conflict) pushToast({ title: 'Changed in another tab', message: r.error, level: 'warn' })
                  setErrors(r.fieldErrors ?? {})
                  focusFirstInvalid()
                  return
                }
                pushToast({ title: 'Process charge saved', message: 'Applies to costings not yet finalized.', level: 'success' })
                setEditing(null)
              }}
            >
              Save charge
            </Button>
          </>
        }
      >
        {editing ? (
          <div className="grid gap-x-3 sm:grid-cols-2">
            <Field label="Name" required error={errors.name} className="sm:col-span-2">
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} aria-invalid={!!errors.name || undefined} />
            </Field>
            <Field label="Basis" className="sm:col-span-2">
              <Select value={editing.basis} onChange={(e) => setEditing({ ...editing, basis: e.target.value as CostBasis })}>
                {(['per_1000', 'per_piece', 'per_hour', 'fixed'] as CostBasis[]).map((b) => (
                  <option key={b} value={b}>
                    {COST_BASIS_LABEL[b]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Rate ₹" error={errors.rate} hint="Blank = not configured.">
              <NumberInput value={editing.rate} onChange={(v) => setEditing({ ...editing, rate: v })} invalid={!!errors.rate} />
            </Field>
            <Field label="Setup charge ₹" error={errors.setupCharge} hint="Once per order.">
              <NumberInput value={editing.setupCharge} onChange={(v) => setEditing({ ...editing, setupCharge: v })} invalid={!!errors.setupCharge} />
            </Field>
            <p className="text-xs text-muted sm:col-span-2">Per run hour uses the process run hours (run h / 1,000 × quantity). Setup hours are covered by the setup charge.</p>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={!!pendingDelete}
        tone="danger"
        title={`Delete “${pendingDelete?.name ?? ''}”?`}
        body="No product uses this charge."
        confirmLabel="Delete charge"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) run(deleteProcessCharge(pendingDelete.id))
          setPendingDelete(null)
        }}
      />
    </Card>
  )
}

/* ------------------------- Defaults & order charges ----------------------- */

export function DefaultsPanel() {
  const { db, run, pushToast } = useStore()
  const fromSettings = (): CostingDefaultsDraft => ({
    taxLabel: db.settings.taxLabel,
    taxPct: db.settings.taxPct,
    profitMethod: db.settings.profitMethod,
    profitPct: db.settings.profitPct,
    bufferHours: db.settings.bufferHours,
    expectedUpdatedAt: db.settings.updatedAt,
  })
  const [draft, setDraft] = useState<CostingDefaultsDraft>(fromSettings)
  const [base, setBase] = useState<CostingDefaultsDraft>(fromSettings)
  const [conflict, setConflict] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState<OrderChargeDraft | null>(null)
  const [chargeErrors, setChargeErrors] = useState<Record<string, string>>({})
  const [pendingDelete, setPendingDelete] = useState<OrderChargeTemplate | null>(null)
  const dirty = JSON.stringify(draft) !== JSON.stringify(base)
  const loadLatest = () => {
    setDraft(fromSettings())
    setBase(fromSettings())
    setErrors({})
    setConflict('')
  }

  useEffect(() => {
    // Follow another tab's saved defaults, but never discard edits made on this screen.
    if (!dirty) loadLatest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db.settings.updatedAt])

  return (
    <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
      <Card className="vx-anim-up">
        <CardHead title="Costing defaults" subtitle="Pre-filled on every new order costing; adjustable per order." icon={<Percent className="h-4 w-4" />} />
        {conflict ? (
          <div className="px-5 pt-4">
            <ConflictNotice message={conflict} onReload={loadLatest} />
          </div>
        ) : null}
        <form
          className="grid gap-x-4 p-5 sm:grid-cols-2"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault()
            const r = await run(saveCostingDefaults(draft))
            if (!r.ok) {
              if (r.conflict) setConflict(r.error)
              setErrors(r.fieldErrors ?? {})
              focusFirstInvalid()
              return
            }
            setErrors({})
            const saved = { ...draft, expectedUpdatedAt: r.value.updatedAt }
            setDraft(saved)
            setBase(saved)
            pushToast({ title: 'Costing defaults saved', level: 'success' })
          }}
        >
          <Field label="Profit method" as="div" className="sm:col-span-2">
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Profit method">
              {(
                [
                  ['markup', 'Markup on cost', 'Profit = cost × %. Selling = cost × (1 + %).'],
                  ['margin', 'Margin on selling price', 'Profit = selling × %. Selling = cost ÷ (1 − %).'],
                ] as Array<[ProfitMethod, string, string]>
              ).map(([m, label, hint]) => (
                <label key={m} className={cx('vx-press flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2.5', draft.profitMethod === m ? 'border-accent bg-accent-wash' : 'border-rule-2 hover:bg-surface-2')}>
                  <input type="radio" name="profit-method" className="mt-1 accent-[var(--color-accent)]" checked={draft.profitMethod === m} onChange={() => setDraft({ ...draft, profitMethod: m })} />
                  <span>
                    <span className="block text-sm font-medium text-ink">{label}</span>
                    <span className="block text-xs text-muted">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </Field>
          <Field label={draft.profitMethod === 'markup' ? 'Markup %' : 'Margin %'} error={errors.profitPct}>
            <NumberInput value={draft.profitPct} onChange={(v) => setDraft({ ...draft, profitPct: v ?? NaN })} invalid={!!errors.profitPct} />
          </Field>
          <Field label="Scheduling buffer (working hours)" error={errors.bufferHours} hint="Kept free before delivery; scaled by priority.">
            <NumberInput value={draft.bufferHours} onChange={(v) => setDraft({ ...draft, bufferHours: v ?? NaN })} invalid={!!errors.bufferHours} />
          </Field>
          <Field label="Tax label" error={errors.taxLabel}>
            <Input value={draft.taxLabel} onChange={(e) => setDraft({ ...draft, taxLabel: e.target.value })} aria-invalid={!!errors.taxLabel || undefined} />
          </Field>
          <Field label="Default tax %" error={errors.taxPct} hint="A product can set its own rate.">
            <NumberInput value={draft.taxPct} onChange={(v) => setDraft({ ...draft, taxPct: v ?? NaN })} invalid={!!errors.taxPct} />
          </Field>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Button type="submit" icon={<Save className="h-4 w-4" />} disabled={!dirty}>
              Save defaults
            </Button>
            <span className="text-xs text-muted" aria-live="polite">
              {dirty ? 'Unsaved changes' : 'Saved'}
            </span>
          </div>
        </form>
      </Card>

      <Card className="vx-anim-up overflow-hidden">
        <CardHead
          title="Order charge templates"
          subtitle="Additional charges such as transport or design that can be added to an order costing."
          icon={<Receipt className="h-4 w-4" />}
          actions={
            <Button
              size="sm"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => {
                setChargeErrors({})
                setEditing({ name: '', basis: 'fixed', amount: null, applyByDefault: false, active: true })
              }}
            >
              New template
            </Button>
          }
        />
        {db.settings.orderCharges.length === 0 ? (
          <EmptyState icon={<Receipt className="h-6 w-6" />} title="No order charge templates" message="Charges can still be added directly on an order costing." />
        ) : (
          <ul className="divide-y divide-rule">
            {db.settings.orderCharges.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{c.name}</p>
                  <p className="text-xs text-muted">
                    {c.amount === null ? 'Amount not set' : c.basis === 'percent' ? `${c.amount}% of materials + processes` : `${moneyPaise(c.amount)} ${COST_BASIS_LABEL[c.basis]}`}
                    {c.applyByDefault ? ' · added to new costings' : ''}
                  </p>
                </div>
                {!c.active ? <Badge tone="slate">Inactive</Badge> : null}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setChargeErrors({})
                    setEditing({ ...c })
                  }}
                >
                  Edit
                </Button>
                <Button size="sm" variant="ghost" className="text-risk hover:bg-risk-wash" onClick={() => setPendingDelete(c)}>
                  Delete…
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit order charge' : 'New order charge'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!editing) return
                const r = await run(saveOrderChargeTemplate(editing))
                if (!r.ok) {
                  setChargeErrors(r.fieldErrors ?? {})
                  focusFirstInvalid()
                  return
                }
                setEditing(null)
              }}
            >
              Save template
            </Button>
          </>
        }
      >
        {editing ? (
          <div className="grid gap-x-3 sm:grid-cols-2">
            <Field label="Name" required error={chargeErrors.name} className="sm:col-span-2">
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} aria-invalid={!!chargeErrors.name || undefined} />
            </Field>
            <Field label="Basis">
              <Select value={editing.basis} onChange={(e) => setEditing({ ...editing, basis: e.target.value as ChargeBasis })}>
                {(['fixed', 'per_1000', 'percent'] as ChargeBasis[]).map((b) => (
                  <option key={b} value={b}>
                    {COST_BASIS_LABEL[b]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={editing.basis === 'percent' ? 'Percent' : 'Amount ₹'} error={chargeErrors.amount}>
              <NumberInput value={editing.amount} onChange={(v) => setEditing({ ...editing, amount: v })} invalid={!!chargeErrors.amount} />
            </Field>
            <label className="flex min-h-6 cursor-pointer items-center gap-2 text-sm text-ink-2 sm:col-span-2">
              <input type="checkbox" className="h-4 w-4 accent-[var(--color-accent)]" checked={editing.applyByDefault} onChange={(e) => setEditing({ ...editing, applyByDefault: e.target.checked })} />
              Add automatically to new order costings
            </label>
            <label className="mt-2 flex min-h-6 cursor-pointer items-center gap-2 text-sm text-ink-2 sm:col-span-2">
              <input type="checkbox" className="h-4 w-4 accent-[var(--color-accent)]" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
              Active
            </label>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={!!pendingDelete}
        tone="danger"
        title={`Delete “${pendingDelete?.name ?? ''}”?`}
        body="Existing costings keep the charge values they already copied."
        confirmLabel="Delete template"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) run(deleteOrderChargeTemplate(pendingDelete.id))
          setPendingDelete(null)
        }}
      />
    </div>
  )
}
