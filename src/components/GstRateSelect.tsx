import { useMemo, useState } from 'react'
import { useStore } from '../store/store'
import { Select } from './ui'
import { NumberInput } from './page'

/* ---------------------------------------------------------------------------
 * GST rate as a list: every rate the government notifies, plus any rate
 * already used in this business — and "Other rate…" to type a new one, which
 * then joins the list wherever it is used.
 * ------------------------------------------------------------------------- */

/** GST and cess-free rates notified in India (0.1 % merchant exports, 0.25 % rough stones, 1.5 % / 3 % / 6 % gold & jewellery work, 7.5 % job work, 40 % special). */
export const GST_RATES = [0, 0.1, 0.25, 1.5, 3, 5, 6, 7.5, 12, 18, 28, 40]

const label = (r: number) => `${r}%`

export function GstRateSelect({
  value,
  onChange,
  defaultPct,
  invalid,
  id,
}: {
  value: number | null
  onChange: (v: number | null) => void
  /** Shown as the "use the default" choice (value null); omit to require a rate. */
  defaultPct?: number
  invalid?: boolean
  id?: string
}) {
  const { db } = useStore()
  // Rates already used anywhere join the standard ones.
  const rates = useMemo(() => {
    const used = [db.settings.taxPct, ...db.products.map((p) => p.taxPct), ...db.invoices.map((i) => i.taxPct)].filter((r): r is number => typeof r === 'number' && Number.isFinite(r) && r >= 0 && r <= 100)
    return [...new Set([...GST_RATES, ...used])].sort((a, b) => a - b)
  }, [db.settings.taxPct, db.products, db.invoices])
  const known = value === null || rates.includes(value)
  const [other, setOther] = useState(!known)

  return (
    <div className="flex gap-2">
      <Select
        id={id}
        aria-invalid={invalid || undefined}
        value={other ? 'other' : value === null ? '' : String(value)}
        onChange={(e) => {
          const v = e.target.value
          if (v === 'other') {
            setOther(true)
            return
          }
          setOther(false)
          onChange(v === '' ? null : Number(v))
        }}
        className={other ? 'w-36' : undefined}
      >
        {defaultPct !== undefined ? <option value="">Default ({label(defaultPct)})</option> : null}
        {rates.map((r) => (
          <option key={r} value={String(r)}>
            {label(r)}
          </option>
        ))}
        <option value="other">Other rate…</option>
      </Select>
      {other ? <NumberInput aria-label="GST rate %" value={value} onChange={onChange} invalid={invalid} placeholder="e.g. 2.5" /> : null}
    </div>
  )
}
