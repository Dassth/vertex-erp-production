import { describe, expect, it } from 'vitest'
import { scaleMaterialLines, sizeFactors, sizeText } from './sizeScale'
import type { Material, ProductMaterial } from './types'
import { ADMIN, PROCESS_UNITS, ctxFor, must, seedMaster } from '../test/fixtures'
import { savePlan, submitPlan } from '../domain/planning'
import { finalizeCosting, openCosting, previewCosting } from '../domain/orderCosting'
import { saveProduct } from '../domain/master'

const line = (over: Partial<ProductMaterial>): ProductMaterial => ({
  id: 'l', materialId: 'm', stageId: null, processId: null, qtyPerPiece: null, piecesPerProduct: 1, cutLengthMm: null, cutWidthMm: null, rotationAllowed: true, upsOverride: null, upsOverrideReason: '', note: '', ...over,
})
const mats = [
  { id: 'board', kind: 'sheet', form: 'sheet' },
  { id: 'glue', kind: 'quantity', form: 'bulk' },
  { id: 'magnet', kind: 'quantity', form: 'readymade' },
] as Pick<Material, 'id' | 'kind' | 'form'>[]

describe('order size vs base size', () => {
  it('follows the size in proportion: 50 × 50 → 100 × 100 doubles cut pieces and glue, magnets stay', () => {
    const f = sizeFactors({ length: 50, breadth: 50, height: 30, unit: 'mm' }, { length: 100, breadth: 100, height: 30, unit: 'mm' })
    expect(f).toEqual({ length: 2, breadth: 2, scaled: true })
    const out = scaleMaterialLines(
      [line({ materialId: 'board', cutLengthMm: 180, cutWidthMm: 120, upsOverride: 20 }), line({ materialId: 'glue', qtyPerPiece: 0.004 }), line({ materialId: 'magnet', qtyPerPiece: 2 })],
      mats,
      f,
    )
    expect(out[0]).toMatchObject({ cutLengthMm: 360, cutWidthMm: 240, upsOverride: null })
    expect(out[1].qtyPerPiece).toBe(0.008)
    expect(out[2].qtyPerPiece).toBe(2)
  })

  it('compares sizes in any unit, and leaves a missing side as it is', () => {
    expect(sizeFactors({ length: 10, breadth: 10, height: null, unit: 'cm' }, { length: 150, breadth: null, height: null, unit: 'mm' })).toEqual({ length: 1.5, breadth: 1, scaled: true })
    expect(sizeFactors(null, { length: 100, breadth: 100, height: null, unit: 'mm' }).scaled).toBe(false)
    expect(sizeText({ length: 100, breadth: 80, height: 40, unit: 'mm' })).toBe('100 × 80 × 40 mm')
  })

  it('a plan for a bigger box costs more, and its order keeps the cut sizes for that size', () => {
    const seeded = seedMaster()
    const product = seeded.db.products[0]
    // Base size of the seeded carton: its sheet piece is 200 × 150 mm.
    let db = must(saveProduct({ ...product, code: product.code, baseSize: { length: 200, breadth: 150, height: null, unit: 'mm' }, expectedUpdatedAt: product.updatedAt })(seeded.db, ctxFor(ADMIN[0]))).db
    const planFor = (size: { length: number; breadth: number }) => ({
      customerId: seeded.customerId,
      productId: seeded.productId,
      quantity: 1000,
      orderDate: '2026-09-15',
      deliveryDate: '2026-10-10',
      priority: 'Normal' as const,
      customerRef: '',
      dimensions: '',
      options: '',
      instructions: '',
      processUnits: PROCESS_UNITS,
      size: { ...size, height: null, unit: 'mm' as const },
    })
    const base = must(savePlan(planFor({ length: 200, breadth: 150 }))(db, ctxFor(ADMIN[0])))
    const big = must(savePlan(planFor({ length: 400, breadth: 300 }))(base.db, ctxFor(ADMIN[0])))
    db = big.db
    const costBase = must(openCosting(base.value.id)(must(submitPlan(base.value.id)(db, ctxFor(ADMIN[0]))).db, ctxFor(ADMIN[0])))
    db = costBase.db
    db = must(submitPlan(big.value.id)(db, ctxFor(ADMIN[0]))).db
    const costBig = must(openCosting(big.value.id)(db, ctxFor(ADMIN[0])))
    db = costBig.db
    const small = previewCosting(db, db.costings.find((c) => c.id === costBase.value.id)!)!
    const large = previewCosting(db, db.costings.find((c) => c.id === costBig.value.id)!)!
    const sheet = (r: typeof small) => r.materialLines.find((l) => l.kind === 'sheet')!
    expect(sheet(large).netQty).toBeGreaterThan(sheet(small).netQty * 3)
    expect(large.totalCost).toBeGreaterThan(small.totalCost)

    const fin = must(finalizeCosting(costBig.value.id)(db, ctxFor(ADMIN[0])))
    const cut = fin.value.costing.snapshot!.product.materials.find((l) => l.cutLengthMm !== null)!
    expect([cut.cutLengthMm, cut.cutWidthMm]).toEqual([400, 300])
  })
})
