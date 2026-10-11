/* ---------------------------------------------------------------------------
 * Order size vs the product's base (average) size.
 *
 * A product is set up once at its usual size (Master → Products → Basic
 * information): cut sizes, quantities and wastage are entered for THAT size.
 * A plan may be for a bigger or smaller box; everything that depends on the
 * size then follows in proportion:
 *   • sheet pieces — cut length × (order L ÷ base L), cut width × (order B ÷ base B)
 *   • roll / glue / other by quantity — × the average of those two ratios
 *   • ready-made items (magnet, lock) — unchanged: a box still takes 2 magnets
 * Times and rates per piece do not depend on the size and are not changed.
 * A size not given on either side leaves that direction as it is.
 * ------------------------------------------------------------------------- */

import type { LengthUnit, Material, ProductMaterial, ProductSize } from './types'
import { toMm } from './yield'

export interface SizeFactors {
  length: number
  breadth: number
  /** Anything differs from the base. */
  scaled: boolean
}

const mm = (v: number | null | undefined, unit: LengthUnit) => (v !== null && v !== undefined && Number.isFinite(v) && v > 0 ? toMm(v, unit) : null)

export function sizeFactors(base: ProductSize | null | undefined, order: ProductSize | null | undefined): SizeFactors {
  const ratio = (b: number | null, o: number | null) => (b && o ? o / b : 1)
  if (!base || !order) return { length: 1, breadth: 1, scaled: false }
  const length = ratio(mm(base.length, base.unit), mm(order.length, order.unit))
  const breadth = ratio(mm(base.breadth, base.unit), mm(order.breadth, order.unit))
  const near = (x: number) => Math.abs(x - 1) < 1e-9
  return { length, breadth, scaled: !near(length) || !near(breadth) }
}

const round1 = (n: number) => Math.round(n * 10) / 10
const round4 = (n: number) => Math.round(n * 10000) / 10000

/** The product's material uses for an order of `order` size (unchanged when it is the base size). */
export function scaleMaterialLines(lines: ProductMaterial[], materials: Pick<Material, 'id' | 'kind' | 'form'>[], f: SizeFactors): ProductMaterial[] {
  if (!f.scaled) return lines
  const avg = (f.length + f.breadth) / 2
  return lines.map((l) => {
    const m = materials.find((x) => x.id === l.materialId)
    if (!m) return l
    if (m.kind === 'sheet')
      return {
        ...l,
        cutLengthMm: l.cutLengthMm !== null ? round1(l.cutLengthMm * f.length) : null,
        cutWidthMm: l.cutWidthMm !== null ? round1(l.cutWidthMm * f.breadth) : null,
        // A hand-counted layout was for the base size; the new size is recalculated.
        upsOverride: null,
        upsOverrideReason: '',
      }
    if (m.form === 'readymade') return l
    return { ...l, qtyPerPiece: l.qtyPerPiece !== null ? round4(l.qtyPerPiece * avg) : null }
  })
}

export function sizeText(s: ProductSize | null | undefined): string {
  if (!s) return ''
  const parts = [s.length, s.breadth, s.height].filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v) && v > 0)
  return parts.length ? `${parts.join(' × ')} ${s.unit}` : ''
}

export function hasSize(s: ProductSize | null | undefined): s is ProductSize {
  return !!s && [s.length, s.breadth, s.height].some((v) => v !== null && v !== undefined && Number.isFinite(v) && v > 0)
}

export const sameSize = (a: ProductSize | null | undefined, b: ProductSize | null | undefined) => !!a && !!b && sizeText(a) === sizeText(b)
