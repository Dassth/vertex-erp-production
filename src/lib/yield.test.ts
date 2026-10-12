import { describe, expect, it } from 'vitest'
import { calculateYield, ceilSafe, fromMm, roundUpToMultiple, toMm, validateUpsOverride } from './yield'

const base = { sheetLengthMm: 1000, sheetWidthMm: 700, cutLengthMm: 200, cutWidthMm: 150, edgeMarginMm: 5, cutGapMm: 3, rotationAllowed: false }

describe('sheet yield (ups)', () => {
  it('fits a grid edge to edge on the whole sheet', () => {
    // 1000 × 700 sheet, 200 × 150 pieces → along 5, across 4
    const y = calculateYield(base)
    expect(y).toMatchObject({ ups: 20, along: 5, across: 4, orientation: 'as-drawn' })
  })

  it('uses the rotated orientation when it yields more and rotation is allowed', () => {
    const y = calculateYield({ ...base, cutLengthMm: 350, cutWidthMm: 160, rotationAllowed: true })
    // as drawn: 2 × 4 = 8; turned: 6 × 2 = 12
    expect(y.ups).toBe(12)
    expect(y.orientation).toBe('rotated')
  })

  it('counts exact fits', () => {
    const y = calculateYield({ ...base, sheetLengthMm: 600, sheetWidthMm: 400, cutLengthMm: 200, cutWidthMm: 200 })
    expect(y.ups).toBe(6)
    expect(y.yieldPct).toBeCloseTo(100)
  })

  it('reports a piece that does not fit', () => {
    const y = calculateYield({ ...base, cutLengthMm: 1200 })
    expect(y.ups).toBe(0)
    expect(y.error).toMatch(/does not fit/)
  })

  it('rejects invalid dimensions', () => {
    expect(calculateYield({ ...base, sheetWidthMm: 0 }).error).toMatch(/greater than zero/)
  })

  it('ignores an old edge allowance and cutting gap — pieces sit edge to edge on the whole sheet', () => {
    expect(calculateYield({ ...base, edgeMarginMm: 400, cutGapMm: 30 })).toMatchObject({ ups: 20, error: null })
  })
})

describe('ups override validation', () => {
  it('requires a whole number within the area limit; a note is optional', () => {
    expect(validateUpsOverride(20, 'Nested die-line', base)).toBeNull()
    expect(validateUpsOverride(2.5, 'x', base)).toMatch(/whole number/)
    expect(validateUpsOverride(20, '  ', base)).toBeNull()
    // whole sheet 1000×700 / (200×150) = 23.33 → limit 23
    expect(validateUpsOverride(23, 'fits', base)).toBeNull()
    expect(validateUpsOverride(24, 'too many', base)).toMatch(/at most 23 fit/)
    expect(validateUpsOverride(null, '', base)).toBeNull()
  })
})

describe('units and rounding helpers', () => {
  it('converts lengths consistently', () => {
    expect(toMm(10, 'cm')).toBe(100)
    expect(toMm(1, 'in')).toBe(25.4)
    expect(fromMm(254, 'in')).toBe(10)
  })
  it('rounds without float noise', () => {
    expect(ceilSafe(0.1 * 3 * 10)).toBe(3)
    expect(roundUpToMultiple(4.4, 0.5)).toBe(4.5)
    expect(roundUpToMultiple(118, 100)).toBe(200)
  })
})
