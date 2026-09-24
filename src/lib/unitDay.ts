/** True when a planned window [start, end] touches the calendar day of `day` (local time). */
export function onDay(start: string, end: string, day: Date): boolean {
  const from = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime()
  const to = from + 24 * 60 * 60 * 1000
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  if (Number.isNaN(s) || Number.isNaN(e)) return false
  return s < to && e >= from
}
