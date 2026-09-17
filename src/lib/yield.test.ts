import { describe, expect, it } from 'vitest'
import { calculateYield, ceilSafe, fromMm, roundUpToMultiple, toMm, validateUpsOverride } from './yield'

const base = { sheetLengthMm: 1000, sheetWidthMm: 700, cutLengthMm: 200, cutWidthMm: 150, edgeMarginMm: 5, cutGapMm: 3, rotationAllowed: false }

describe('sheet yield (ups)', () => {
  it('fits a grid with edge allowance and cutting gap', () => {
    // usable 990 × 690 → along floor(993/203)=4, across floor(693/153)=4
    const y = calculateYield(base)
    expect(y.ups).toBe(16)
    expect(y.along).toBe(4)
    expect(y.across).toBe(4)
    expect(y.orientation).toBe('as-drawn')
  })

  it('uses the rotated orientation when it yields more and rotation is allowed', () => {
    // rotated: along floor(993/153)=6, across floor(693/203)=3 → 18
    const y = calculateYield({ ...base, rotationAllowed: true })
    expect(y.ups).toBe(18)
    expect(y.orientation).toBe('rotated')
  })

  it('counts exact fits with no gap or margin', () => {
    const y = calculateYield({ ...base, sheetLengthMm: 600, sheetWidthMm: 400, cutLengthMm: 200, cutWidthMm: 200, edgeMarginMm: 0, cutGapMm: 0 })
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
    expect(calculateYield({ ...base, edgeMarginMm: 400 }).error).toMatch(/no usable area/)
  })
})

describe('ups override validation', () => {
  it('requires a whole number, a reason and the area limit', () => {
    expect(validateUpsOverride(20, 'Nested die-line', base)).toBeNull()
    expect(validateUpsOverride(2.5, 'x', base)).toMatch(/whole number/)
    expect(validateUpsOverride(20, '  ', base)).toMatch(/why/)
    // usable 990×690 / (200×150) = 22.77 → limit 22
    expect(validateUpsOverride(23, 'too many', base)).toMatch(/physical area limit of 22/)
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
