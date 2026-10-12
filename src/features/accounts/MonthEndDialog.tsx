import { useMemo, useState } from 'react'
import { CalendarCheck } from 'lucide-react'
import { useStore } from '../../store/store'
import type { MoneyMode } from '../../lib/types'
import { MODE_LABEL, MODES, monthDocsToRecord } from '../../lib/cashbook'
import type { MonthDoc } from '../../lib/cashbook'
import { recordMonthDocuments } from '../../domain/cashbook'
import { fmtDate, moneyPaise } from '../../lib/format'
import { Button, Field, Modal, Select } from '../../components/ui'

/**
 * Month end in one press: shows every sale and purchase bill of the month that
 * is not recorded yet, asks once, then adds each as its own entry.
 */
export function MonthEndDialog({ month, monthLabel, onClose }: { month: string; monthLabel: string; onClose: () => void }) {
  const { db, run, pushToast } = useStore()
  const docs = useMemo(() => monthDocsToRecord(db, month), [db, month])
  const [sales, setSales] = useState(true)
  const [purchases, setPurchases] = useState(true)
  const [mode, setMode] = useState<MoneyMode>('bank')
  const [busy, setBusy] = useState(false)
  const count = (sales ? docs.sales.length : 0) + (purchases ? docs.purchases.length : 0)
  const nothing = !docs.sales.length && !docs.purchases.length

  const add = async () => {
    if (busy || !count) return
    setBusy(true)
    try {
      const r = await run(recordMonthDocuments({ month, mode, sales, purchases }))
      if (!r.ok) return pushToast({ title: 'Nothing added', message: r.error, level: 'danger' })
      pushToast({
        title: `${r.value.sales + r.value.purchases} entries added for ${monthLabel}`,
        message: [r.value.sales ? `${r.value.sales} sale(s) · ${moneyPaise(r.value.moneyIn)} in` : '', r.value.purchases ? `${r.value.purchases} purchase bill(s) · ${moneyPaise(r.value.moneyOut)} out` : ''].filter(Boolean).join(' · '),
        level: 'success',
      })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      pinnedFooter
      title={`Add ${monthLabel} sales & purchases`}
      subtitle="Each sale and each purchase bill becomes its own entry — who, which invoice or bill, date and amount — ready for the month’s report and printing."
      icon={<CalendarCheck className="h-5 w-5" />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {nothing ? 'Close' : 'Cancel'}
          </Button>
          {nothing ? null : (
            <Button icon={<CalendarCheck className="h-4 w-4" />} loading={busy} disabled={!count} onClick={() => void add()}>
              {count ? `Yes, add ${count} ${count === 1 ? 'entry' : 'entries'}` : 'Choose sales or purchases'}
            </Button>
          )}
        </>
      }
    >
      {nothing ? (
        <p className="text-base text-ink-2">Nothing to add — every sale and purchase bill of {monthLabel} is already recorded (or there were none).</p>
      ) : (
        <div className="space-y-5">
          <DocList title="Sales — money in" hint="Sales invoices of this month not paid in full" docs={docs.sales} checked={sales} onChecked={setSales} />
          <DocList title="Purchases — money out" hint="Purchase bills of this month not paid in full" docs={docs.purchases} checked={purchases} onChecked={setPurchases} />
          <Field label="Received / paid by" hint="Used for every entry added now; each one can be changed later." className="max-w-xs">
            <Select value={mode} onChange={(e) => setMode(e.target.value as MoneyMode)}>
              {MODES.map((m) => (
                <option key={m} value={m}>
                  {MODE_LABEL[m]}
                </option>
              ))}
            </Select>
          </Field>
          <p className="text-sm text-muted">Only what is still due is added, so pressing this again later never adds the same sale or bill twice.</p>
        </div>
      )}
    </Modal>
  )
}

function DocList({ title, hint, docs, checked, onChecked }: { title: string; hint: string; docs: MonthDoc[]; checked: boolean; onChecked: (v: boolean) => void }) {
  const total = docs.reduce((n, d) => n + Math.round(d.due * 100), 0) / 100
  return (
    <section className="rounded-md border border-rule-2">
      <label className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-rule px-4 py-2">
        <input type="checkbox" className="h-4 w-4 accent-[var(--color-accent)]" checked={checked && docs.length > 0} disabled={!docs.length} onChange={(e) => onChecked(e.target.checked)} />
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-ink">{title}</span>
          <span className="block text-xs text-muted">{docs.length ? hint : 'Nothing to add'}</span>
        </span>
        <span className="vx-code shrink-0 text-sm text-ink-2">
          {docs.length} · {moneyPaise(total)}
        </span>
      </label>
      {docs.length ? (
        <ul className="max-h-48 divide-y divide-rule overflow-y-auto overscroll-contain text-sm">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-4 py-1.5">
              <span className="w-24 shrink-0 tabular-nums text-muted">{fmtDate(d.date)}</span>
              <span className="min-w-0 flex-1 truncate text-ink">{d.party || '—'}</span>
              <span className="hidden shrink-0 text-xs text-muted sm:inline" translate="no">
                {d.number}
              </span>
              <span className="vx-code w-28 shrink-0 text-right">{moneyPaise(d.due)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
