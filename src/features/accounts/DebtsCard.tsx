import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Download, Landmark, Pencil, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../../store/store'
import type { Debt, MoneyMode } from '../../lib/types'
import { MODE_LABEL, MODES, debtRows, debtsTable } from '../../lib/cashbook'
import { deleteDebt, saveDebt, validateDebt } from '../../domain/cashbook'
import type { DebtDraft } from '../../domain/cashbook'
import { fmtDate, moneyPaise } from '../../lib/format'
import { Button, Card, CardHead, ConfirmDialog, EmptyState, Field, IconButton, Input, Modal, Select, Textarea } from '../../components/ui'
import { NumberInput, focusFirstInvalid } from '../../components/page'
import { DownloadButton, ExcelButton, reportTableDoc, useLatestDb } from '../../components/DocumentPreview'

/* ---------------------------------------------------------------------------
 * Debts: money borrowed — from whom, how much, when, why. Kept apart from
 * income. Money out can say it was paid with a loan's money, and an EMI says
 * which loan it pays back; each loan shows what was spent from it, what is
 * paid back and what is still owed.
 * ------------------------------------------------------------------------- */

const blankDebt = (): DebtDraft => ({ id: '', lender: '', date: format(new Date(), 'yyyy-MM-dd'), amount: NaN, purpose: '', mode: 'bank', reference: '', notes: '' })
const toDraft = (x: Debt): DebtDraft => ({ id: x.id, lender: x.lender, date: x.date, amount: x.amount, purpose: x.purpose, mode: x.mode, reference: x.reference, notes: x.notes, expectedUpdatedAt: x.updatedAt })

export function DebtsCard() {
  const { db, run, pushToast } = useStore()
  const read = useLatestDb()
  const rows = useMemo(() => debtRows(db), [db])
  const [editing, setEditing] = useState<DebtDraft | null>(null)
  const [deleting, setDeleting] = useState<Debt | null>(null)
  const total = (k: 'used' | 'repaid' | 'outstanding') => rows.reduce((n, r) => n + r[k], 0)

  return (
    <Card className="vx-anim-up overflow-hidden">
      <CardHead
        title="Debts"
        subtitle={rows.length ? `Borrowed ${moneyPaise(rows.reduce((n, r) => n + r.debt.amount, 0))} · paid back ${moneyPaise(total('repaid'))} · still owed ${moneyPaise(total('outstanding'))}` : 'Money borrowed — from whom, how much and why'}
        icon={<Landmark className="h-4 w-4" />}
        actions={
          <div className="flex flex-wrap gap-2">
            {rows.length ? (
              <>
                <DownloadButton size="sm" icon={<Download className="h-3.5 w-3.5" />} doc={() => reportTableDoc(read, debtsTable, 'Debts', 'debts.pdf')} aria-label="Download the debts as a PDF">
                  PDF
                </DownloadButton>
                <ExcelButton size="sm" variant="secondary" stem="debts" table={() => debtsTable(read())} aria-label="Download the debts as a spreadsheet" />
              </>
            ) : null}
            <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setEditing(blankDebt())}>
              New loan…
            </Button>
          </div>
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon={<Landmark className="h-6 w-6" />} title="No loans recorded" message="Record money borrowed. Then, in Money out, choose “Paid from” a loan, or which loan an EMI pays back." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead>
              <tr>
                <th className="vx-th">Date</th>
                <th className="vx-th">Borrowed from</th>
                <th className="vx-th">For</th>
                <th className="vx-th text-right">Borrowed</th>
                <th className="vx-th text-right">Spent from it</th>
                <th className="vx-th text-right">Paid back</th>
                <th className="vx-th text-right">Still owed</th>
                <th className="vx-th">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.debt.id} className="vx-row">
                  <td className="vx-td">
                    {fmtDate(r.debt.date)}
                    <span className="vx-code block text-2xs text-faint">{r.debt.code}</span>
                  </td>
                  <td className="vx-td vx-td-wrap">{r.debt.lender}</td>
                  <td className="vx-td vx-td-wrap text-ink-2">{r.debt.purpose || '—'}</td>
                  <td className="vx-td text-right tabular-nums">{moneyPaise(r.debt.amount)}</td>
                  <td className="vx-td text-right tabular-nums">{moneyPaise(r.used)}</td>
                  <td className="vx-td text-right tabular-nums">{moneyPaise(r.repaid)}</td>
                  <td className={`vx-td text-right font-medium tabular-nums ${r.outstanding > 0 ? 'text-warn' : 'text-ok'}`}>{r.outstanding > 0 ? moneyPaise(r.outstanding) : 'Cleared'}</td>
                  <td className="vx-td">
                    <div className="flex justify-end gap-1">
                      <IconButton label={`Edit loan ${r.debt.code}`} onClick={() => setEditing(toDraft(r.debt))}>
                        <Pencil className="h-4 w-4" />
                      </IconButton>
                      <IconButton label={`Delete loan ${r.debt.code}`} className="hover:text-risk" onClick={() => setDeleting(r.debt)}>
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing ? <DebtEditor draft={editing} onClose={() => setEditing(null)} /> : null}
      <ConfirmDialog
        open={!!deleting}
        tone="danger"
        title="Delete this loan?"
        body={deleting ? `${deleting.code} — ${moneyPaise(deleting.amount)} from ${deleting.lender} on ${fmtDate(deleting.date)}.` : ''}
        confirmLabel="Delete loan"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          const r = await run(deleteDebt(deleting.id))
          pushToast(r.ok ? { title: 'Loan deleted', level: 'info' } : { title: 'Not deleted', message: r.error, level: 'danger' })
          setDeleting(null)
        }}
      />
    </Card>
  )
}

function DebtEditor({ draft, onClose }: { draft: DebtDraft; onClose: () => void }) {
  const { db, run, pushToast } = useStore()
  const [d, setD] = useState<DebtDraft>(draft)
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const errors = touched ? validateDebt(d, db) : {}
  const set = (patch: Partial<DebtDraft>) => setD((x) => ({ ...x, ...patch }))

  const save = async () => {
    setTouched(true)
    if (busy) return
    if (Object.keys(validateDebt(d, db)).length) return focusFirstInvalid()
    setBusy(true)
    try {
      const r = await run(saveDebt(d))
      if (!r.ok) return pushToast({ title: 'Loan not saved', message: r.error, level: 'danger' })
      pushToast({ title: d.id ? 'Loan updated' : `Loan ${r.value.code} recorded`, level: 'success' })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={d.id ? 'Edit loan' : 'New loan'}
      subtitle="Money borrowed — kept apart from income"
      icon={<Landmark className="h-5 w-5" />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void save()}>
            Save loan
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
        <Field label="Borrowed from" required error={errors.lender} className="sm:col-span-2">
          <Input value={d.lender} onChange={(e) => set({ lender: e.target.value })} aria-invalid={!!errors.lender || undefined} placeholder="e.g. Indian Bank, a relative…" autoComplete="off" />
        </Field>
        <Field label="Date" required error={errors.date}>
          <Input type="date" value={d.date} onChange={(e) => set({ date: e.target.value })} aria-invalid={!!errors.date || undefined} />
        </Field>
        <Field label="Amount (₹)" required error={errors.amount}>
          <NumberInput value={d.amount} onChange={(v) => set({ amount: v ?? NaN })} invalid={!!errors.amount} inputMode="decimal" placeholder="0.00" />
        </Field>
        <Field label="For what" className="sm:col-span-2">
          <Input value={d.purpose} onChange={(e) => set({ purpose: e.target.value })} placeholder="e.g. New die-cutting machine…" />
        </Field>
        <Field label="Received by">
          <Select value={d.mode} onChange={(e) => set({ mode: e.target.value as MoneyMode })}>
            {MODES.map((m) => (
              <option key={m} value={m}>
                {MODE_LABEL[m]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Reference">
          <Input value={d.reference} onChange={(e) => set({ reference: e.target.value })} placeholder="Loan account / cheque no." spellCheck={false} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea rows={2} value={d.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Interest rate, EMI, tenure…" />
        </Field>
      </form>
    </Modal>
  )
}
