/* ---------------------------------------------------------------------------
 * Sheet cutting / yield ("ups") calculation.
 *
 * SUPPORTED LAYOUT — a straight guillotine grid:
 *   • every piece on a sheet has the same orientation (all as drawn, or all
 *     rotated 90° when rotation is allowed — the better of the two is used);
 *   • an edge allowance is kept clear on all four sides of the sheet;
 *   • a uniform cutting gap separates adjacent pieces (none at the outer edge);
 *   • pieces are rectangles.
 *
 *   usable length  = sheet length − 2 × edge allowance
 *   pieces along   = floor((usable length + gap) ÷ (piece length + gap))
 *   ups            = pieces along × pieces across
 *
 * NOT SUPPORTED — mixed-orientation nesting, staggered/interlocking die-lines,
 * irregular shapes, multi-product gang runs. This is not a packing optimiser.
 * For those layouts enter a validated ups override (see validateUpsOverride).
 * ------------------------------------------------------------------------- */

import type { LengthUnit } from './types'

const EPS = 1e-9

export interface YieldInput {
  sheetLengthMm: number
  sheetWidthMm: number
  cutLengthMm: number
  cutWidthMm: number
  edgeMarginMm: number
  cutGapMm: number
  rotationAllowed: boolean
}

export interface YieldResult {
  ups: number
  orientation: 'as-drawn' | 'rotated'
  /** Pieces along the sheet length. */
  along: number
  /** Pieces across the sheet width. */
  across: number
  usableLengthMm: number
  usableWidthMm: number
  /** Share of the full sheet area covered by pieces. */
  yieldPct: number
  /** Upper bound from area alone — no layout can exceed it. */
  areaLimit: number
  error: string | null
}

export function fitCount(usable: number, piece: number, gap: number): number {
  if (!(piece > 0) || usable + EPS < piece) return 0
  return Math.floor((usable + gap + EPS) / (piece + gap))
}

export function validateYieldInput(input: YieldInput): string | null {
  const { sheetLengthMm, sheetWidthMm, cutLengthMm, cutWidthMm, edgeMarginMm, cutGapMm } = input
  if (!(sheetLengthMm > 0) || !(sheetWidthMm > 0)) return 'Source sheet dimensions must be greater than zero.'
  if (!(cutLengthMm > 0) || !(cutWidthMm > 0)) return 'Cut-piece dimensions must be greater than zero.'
  if (!(edgeMarginMm >= 0) || !(cutGapMm >= 0)) return 'Edge allowance and cutting gap cannot be negative.'
  if (sheetLengthMm - 2 * edgeMarginMm <= 0 || sheetWidthMm - 2 * edgeMarginMm <= 0)
    return 'The edge allowance leaves no usable area on the sheet.'
  return null
}

export function calculateYield(input: YieldInput): YieldResult {
  const usableLengthMm = input.sheetLengthMm - 2 * input.edgeMarginMm
  const usableWidthMm = input.sheetWidthMm - 2 * input.edgeMarginMm
  const empty: YieldResult = {
    ups: 0,
    orientation: 'as-drawn',
    along: 0,
    across: 0,
    usableLengthMm: Math.max(0, usableLengthMm),
    usableWidthMm: Math.max(0, usableWidthMm),
    yieldPct: 0,
    areaLimit: 0,
    error: null,
  }
  const invalid = validateYieldInput(input)
  if (invalid) return { ...empty, error: invalid }

  const pieceArea = input.cutLengthMm * input.cutWidthMm
  const areaLimit = Math.floor((usableLengthMm * usableWidthMm + EPS) / pieceArea)

  const alongA = fitCount(usableLengthMm, input.cutLengthMm, input.cutGapMm)
  const acrossA = fitCount(usableWidthMm, input.cutWidthMm, input.cutGapMm)
  let best: Pick<YieldResult, 'ups' | 'along' | 'across' | 'orientation'> = {
    ups: alongA * acrossA,
    along: alongA,
    across: acrossA,
    orientation: 'as-drawn',
  }

  if (input.rotationAllowed) {
    const alongB = fitCount(usableLengthMm, input.cutWidthMm, input.cutGapMm)
    const acrossB = fitCount(usableWidthMm, input.cutLengthMm, input.cutGapMm)
    if (alongB * acrossB > best.ups) {
      best = { ups: alongB * acrossB, along: alongB, across: acrossB, orientation: 'rotated' }
    }
  }

  const sheetArea = input.sheetLengthMm * input.sheetWidthMm
  return {
    ...empty,
    ups: best.ups,
    along: best.along,
    across: best.across,
    orientation: best.orientation,
    yieldPct: sheetArea > 0 ? (best.ups * pieceArea * 100) / sheetArea : 0,
    areaLimit,
    error:
      best.ups === 0
        ? input.rotationAllowed
          ? 'The cut piece does not fit on the usable sheet area in either orientation.'
          : 'The cut piece does not fit on the usable sheet area. Allow rotation or check the sizes.'
        : null,
  }
}

/**
 * A manual ups override is accepted only when it is a whole number of at least
 * one, a reason is recorded, and it does not exceed the physical area limit of
 * the usable sheet — no layout can place more pieces than the area holds.
 */
export function validateUpsOverride(
  override: number | null,
  reason: string,
  input: YieldInput,
): string | null {
  if (override === null) return null
  if (!Number.isInteger(override) || override < 1) return 'Ups override must be a whole number of at least 1.'
  if (!reason.trim()) return 'Record why the calculated layout is being overridden.'
  const invalid = validateYieldInput({ ...input, cutGapMm: 0 })
  if (invalid) return invalid
  const usable = (input.sheetLengthMm - 2 * input.edgeMarginMm) * (input.sheetWidthMm - 2 * input.edgeMarginMm)
  const limit = Math.floor((usable + EPS) / (input.cutLengthMm * input.cutWidthMm))
  if (override > limit)
    return `Ups override ${override} exceeds the physical area limit of ${limit} pieces for this sheet.`
  return null
}

/* ------------------------------ Length units ----------------------------- */

export const MM_PER: Record<LengthUnit, number> = { mm: 1, cm: 10, in: 25.4 }

export function toMm(value: number, unit: LengthUnit): number {
  return Number((value * MM_PER[unit]).toFixed(4))
}

export function fromMm(value: number | null, unit: LengthUnit): number | null {
  if (value === null || !Number.isFinite(value)) return null
  return Number((value / MM_PER[unit]).toFixed(unit === 'mm' ? 2 : 3))
}

/** ceil() that ignores float noise such as 2.0000000000000004. */
export function ceilSafe(value: number): number {
  return Math.ceil(value - EPS)
}

export function roundUpToMultiple(value: number, multiple: number): number {
  if (!(multiple > 0)) return value
  return Number((ceilSafe(value / multiple) * multiple).toFixed(6))
}
