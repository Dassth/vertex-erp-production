import { describe, expect, it } from 'vitest'
import { onDay } from './unitDay'

describe('planned on a day', () => {
  const day = new Date('2026-09-24T12:00:00')
  it('includes windows that start, end or run through the day', () => {
    expect(onDay('2026-09-24T09:00:00', '2026-09-24T11:00:00', day)).toBe(true)
    expect(onDay('2026-09-23T16:00:00', '2026-09-24T10:00:00', day)).toBe(true)
    expect(onDay('2026-09-22T09:00:00', '2026-09-26T18:00:00', day)).toBe(true)
  })
  it('leaves out other days and unreadable dates', () => {
    expect(onDay('2026-09-23T09:00:00', '2026-09-23T18:00:00', day)).toBe(false)
    expect(onDay('2026-09-25T00:00:00', '2026-09-25T09:00:00', day)).toBe(false)
    expect(onDay('not a date', '2026-09-24T09:00:00', day)).toBe(false)
  })
})
