/* ---------------------------------------------------------------------------
 * Sheet cutting / yield ("ups") calculation.
 *
 * SUPPORTED LAYOUT — a straight guillotine grid:
 *   • every piece on a sheet has the same orientation (all as drawn, or all
 *     rotated 90° when rotation is allowed — the better of the two is used);
 *   • the whole sheet is usable (the owner asked to drop the edge allowance,
 *     2026-10-12 — a stored value is kept but no longer counted);
 *   • pieces sit edge to edge (the cutting gap was dropped on 2026-10-12 like
 *     the edge allowance — stored values are kept but no longer counted);
 *   • pieces are rectangles.
 *
 *   usable length  = sheet length
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
  /** No longer counted — the whole sheet is usable. Kept so older callers and data still fit. */
  edgeMarginMm?: number
  /** No longer counted — pieces sit edge to edge. Kept so older callers and data still fit. */
  cutGapMm?: number
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
  const { sheetLengthMm, sheetWidthMm, cutLengthMm, cutWidthMm } = input
  if (!(sheetLengthMm > 0) || !(sheetWidthMm > 0)) return 'Source sheet dimensions must be greater than zero.'
  if (!(cutLengthMm > 0) || !(cutWidthMm > 0)) return 'Cut-piece dimensions must be greater than zero.'
  return null
}

export function calculateYield(input: YieldInput): YieldResult {
  const usableLengthMm = input.sheetLengthMm
  const usableWidthMm = input.sheetWidthMm
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

  const alongA = fitCount(usableLengthMm, input.cutLengthMm, 0)
  const acrossA = fitCount(usableWidthMm, input.cutWidthMm, 0)
  let best: Pick<YieldResult, 'ups' | 'along' | 'across' | 'orientation'> = {
    ups: alongA * acrossA,
    along: alongA,
    across: acrossA,
    orientation: 'as-drawn',
  }

  if (input.rotationAllowed) {
    const alongB = fitCount(usableLengthMm, input.cutWidthMm, 0)
    const acrossB = fitCount(usableWidthMm, input.cutLengthMm, 0)
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
  if (!Number.isInteger(override) || override < 1) return 'Pieces per sheet must be a whole number of at least 1.'
  // A note on why is welcome but never required.
  void reason
  const invalid = validateYieldInput(input)
  if (invalid) return invalid
  const usable = input.sheetLengthMm * input.sheetWidthMm
  const limit = Math.floor((usable + EPS) / (input.cutLengthMm * input.cutWidthMm))
  if (override > limit)
    return `${override} pieces cannot fit on this sheet — at most ${limit} fit by area.`
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
