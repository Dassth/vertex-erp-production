/* ---------------------------------------------------------------------------
 * Shop-floor working-hours arithmetic.
 * Vertex Print Pack runs a single shift, 9:00 AM – 6:00 PM, Monday to Saturday.
 * Every planned stage timing in the demo is computed with these helpers so the
 * schedule never places work at 2 AM or on a Sunday.
 * ------------------------------------------------------------------------- */

export const WORK_START_HOUR = 9
export const WORK_END_HOUR = 18
export const WORK_HOURS_PER_DAY = WORK_END_HOUR - WORK_START_HOUR
const MIN = 60_000

export const SHIFTS = [
  { name: 'Shift A', from: 9, to: 18 },
  { name: 'Shift B', from: 18, to: 24 },
  { name: 'Night Hold', from: 0, to: 9 },
] as const

export function currentShift(now: Date = new Date()): string {
  const h = now.getHours()
  const found = SHIFTS.find((s) => h >= s.from && h < s.to)
  return found ? found.name : 'Shift A'
}

export function isWorkingDay(d: Date): boolean {
  return d.getDay() !== 0 // Sunday off
}

function atHour(d: Date, hour: number): Date {
  const out = new Date(d)
  out.setHours(hour, 0, 0, 0)
  return out
}

function nextWorkingDayStart(d: Date): Date {
  const out = atHour(d, WORK_START_HOUR)
  out.setDate(out.getDate() + 1)
  while (!isWorkingDay(out)) out.setDate(out.getDate() + 1)
  return out
}

/** Move a timestamp forward to the next moment the floor is actually running. */
export function alignForward(date: Date): Date {
  let d = new Date(date)
  for (let guard = 0; guard < 400; guard++) {
    if (!isWorkingDay(d)) {
      d = atHour(d, WORK_START_HOUR)
      d.setDate(d.getDate() + 1)
      continue
    }
    if (d < atHour(d, WORK_START_HOUR)) return atHour(d, WORK_START_HOUR)
    if (d >= atHour(d, WORK_END_HOUR)) {
      d = nextWorkingDayStart(d)
      continue
    }
    return d
  }
  return d
}

/** Move a timestamp backward to the previous working moment. */
export function alignBackward(date: Date): Date {
  let d = new Date(date)
  for (let guard = 0; guard < 400; guard++) {
    if (!isWorkingDay(d)) {
      d.setDate(d.getDate() - 1)
      d = atHour(d, WORK_END_HOUR)
      continue
    }
    if (d > atHour(d, WORK_END_HOUR)) return atHour(d, WORK_END_HOUR)
    if (d <= atHour(d, WORK_START_HOUR)) {
      d.setDate(d.getDate() - 1)
      d = atHour(d, WORK_END_HOUR)
      continue
    }
    return d
  }
  return d
}

/** Add N working hours, skipping evenings and Sundays. */
export function addWorkingHours(start: Date, hours: number): Date {
  let cursor = alignForward(start)
  let remaining = Math.max(0, Math.round(hours * 60))
  for (let guard = 0; guard < 2000 && remaining > 0; guard++) {
    const dayEnd = atHour(cursor, WORK_END_HOUR)
    const availableMin = Math.max(0, (dayEnd.getTime() - cursor.getTime()) / MIN)
    if (remaining <= availableMin) {
      return new Date(cursor.getTime() + remaining * MIN)
    }
    remaining -= availableMin
    cursor = nextWorkingDayStart(cursor)
  }
  return cursor
}

/** Subtract N working hours — used when planning backwards from a deadline. */
export function subWorkingHours(end: Date, hours: number): Date {
  let cursor = alignBackward(end)
  let remaining = Math.max(0, Math.round(hours * 60))
  for (let guard = 0; guard < 2000 && remaining > 0; guard++) {
    const dayStart = atHour(cursor, WORK_START_HOUR)
    const availableMin = Math.max(0, (cursor.getTime() - dayStart.getTime()) / MIN)
    if (remaining <= availableMin) {
      return new Date(cursor.getTime() - remaining * MIN)
    }
    remaining -= availableMin
    const prev = new Date(cursor)
    prev.setDate(prev.getDate() - 1)
    cursor = alignBackward(atHour(prev, WORK_END_HOUR))
  }
  return cursor
}

/** Net working hours available between two timestamps (0 if inverted). */
export function workingHoursBetween(from: Date, to: Date): number {
  if (to <= from) return 0
  let cursor = alignForward(from)
  const target = to
  let total = 0
  for (let guard = 0; guard < 2000; guard++) {
    if (cursor >= target) break
    const dayEnd = atHour(cursor, WORK_END_HOUR)
    const sliceEnd = dayEnd < target ? dayEnd : target
    total += Math.max(0, (sliceEnd.getTime() - cursor.getTime()) / MIN / 60)
    if (dayEnd >= target) break
    cursor = nextWorkingDayStart(cursor)
  }
  return Number(total.toFixed(2))
}
