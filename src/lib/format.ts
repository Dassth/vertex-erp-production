import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns'

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const inrPaise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const num = new Intl.NumberFormat('en-IN')

/** ₹ 1,24,500 — Indian grouping, whole rupees. */
export function money(value: number): string {
  if (!Number.isFinite(value)) return '₹ 0'
  return inr.format(Math.round(value)).replace('₹', '₹ ')
}

/** ₹ 12.45 — for per-piece values where paise matter. */
export function moneyPaise(value: number): string {
  if (!Number.isFinite(value)) return '₹ 0.00'
  return inrPaise.format(value).replace('₹', '₹ ')
}

/** ₹ 9.216 — unrounded unit values (e.g. production cost per piece), up to 4 decimals. */
export function moneyPrecise(value: number): string {
  if (!Number.isFinite(value)) return '₹ 0.00'
  return `₹ ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
}

/** Compact lakh / crore display for KPI tiles. */
export function moneyShort(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1e7) return `₹ ${(value / 1e7).toFixed(2)} Cr`
  if (abs >= 1e5) return `₹ ${(value / 1e5).toFixed(2)} L`
  if (abs >= 1e3) return `₹ ${(value / 1e3).toFixed(1)} K`
  return money(value)
}

export function qty(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '0'
  const rounded = Number(value.toFixed(digits))
  return num.format(rounded)
}

export function pieces(value: number): string {
  return `${num.format(Math.round(value))} pcs`
}

export function pct(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '0%'
  return `${value.toFixed(digits)}%`
}

export function toDate(value: string | Date | undefined | null): Date | null {
  if (!value) return null
  const d = typeof value === 'string' ? parseISO(value) : value
  return isValid(d) ? d : null
}

export function fmtDate(value?: string | Date | null, pattern = 'dd MMM yyyy'): string {
  const d = toDate(value ?? null)
  return d ? format(d, pattern) : '—'
}

export function fmtTime(value?: string | Date | null): string {
  const d = toDate(value ?? null)
  return d ? format(d, 'hh:mm a') : '—'
}

export function fmtDateTime(value?: string | Date | null): string {
  const d = toDate(value ?? null)
  return d ? format(d, 'dd MMM yyyy, hh:mm a') : '—'
}

export function fromNow(value?: string | Date | null): string {
  const d = toDate(value ?? null)
  if (!d) return '—'
  const diff = d.getTime() - Date.now()
  const label = formatDistanceToNowStrict(d)
  return diff > 0 ? `in ${label}` : `${label} ago`
}

/** "2d 4h left" / "6h overdue" — used on deadline countdowns. */
export function countdown(value?: string | Date | null): { text: string; overdue: boolean } {
  const d = toDate(value ?? null)
  if (!d) return { text: '—', overdue: false }
  const ms = d.getTime() - Date.now()
  const overdue = ms < 0
  let mins = Math.floor(Math.abs(ms) / 60000)
  const days = Math.floor(mins / 1440)
  mins -= days * 1440
  const hours = Math.floor(mins / 60)
  mins -= hours * 60
  const parts: string[] = []
  if (days) parts.push(`${days}d`)
  if (hours) parts.push(`${hours}h`)
  if (!days && !hours) parts.push(`${mins}m`)
  return { text: `${parts.join(' ')} ${overdue ? 'overdue' : 'left'}`, overdue }
}


/**
 * "26 Aug, 09:00 AM → 11:30 AM" when a stage finishes the same day, or
 * "26 Aug, 05:50 PM → 27 Aug, 01:43 PM" when it runs across the shift end.
 */
export function planWindow(start?: string | null, end?: string | null): string {
  const a = toDate(start ?? null)
  const b = toDate(end ?? null)
  if (!a || !b) return '—'
  const sameDay = a.toDateString() === b.toDateString()
  return sameDay
    ? `${format(a, 'dd MMM')}, ${format(a, 'hh:mm a')} → ${format(b, 'hh:mm a')}`
    : `${format(a, 'dd MMM')}, ${format(a, 'hh:mm a')} → ${format(b, 'dd MMM')}, ${format(b, 'hh:mm a')}`
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

/** Simple deterministic-ish id; good enough for a browser-only demo. */
export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/** File name for an issued invoice: slashes in the number are not path separators. */
export const invoiceFileName = (invoiceNumber: string) => `${invoiceNumber.replace(/[\\/]/g, '-')}.pdf`
