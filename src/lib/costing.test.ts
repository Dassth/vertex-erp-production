import { describe, expect, it } from 'vitest'
import { computeOrderCosting } from './costing'
import type { CostingInputs, Material } from './types'
import { NOW, seedMaster } from '../test/fixtures'

const inputs = (over: Partial<CostingInputs> = {}): CostingInputs => ({
  profitMethod: 'markup',
  profitPct: 20,
  taxPct: 18,
  charges: [{ id: 'c1', templateId: null, name: 'Transport', basis: 'fixed', amount: 1000 }],
  discountType: 'amount',
  discountValue: 0,
  ...over,
})

function run(over: Partial<CostingInputs> = {}, patchMaterials: (m: Material[]) => Material[] = (m) => m, quantity = 1000) {
  const { db, productId } = seedMaster()
  const product = db.products.find((p) => p.id === productId)!
  return computeOrderCosting({
    quantity,
    product: { productId, stages: product.stages, materials: product.materials },
    materials: patchMaterials(db.materials),
    settings: db.settings,
    inputs: inputs(over),
  })
}

describe('order costing totals', () => {
  it('calculates sheets, wastage, purchase rounding and every total', () => {
    const r = run()
    expect(r.valid).toBe(true)
    const sheet = r.materialLines.find((l) => l.kind === 'sheet')!
    expect(sheet.sheet?.ups).toBe(18)
    expect(sheet.piecesNeeded).toBe(2000)
    expect(sheet.netQty).toBe(112) // ceil(2000/18)
    expect(sheet.wastageQty).toBe(6) // ceil(112 × 5%) — applied once
    expect(sheet.totalQty).toBe(118)
    expect(sheet.amount).toBe(1416)

    const glue = r.materialLines.find((l) => l.kind === 'quantity')!
    expect(glue.netQty).toBe(4)
    expect(glue.wastageQty).toBeCloseTo(0.4)
    expect(glue.purchaseQty).toBe(4.5) // rounded up to 0.5 kg
    expect(glue.amount).toBe(900)

    // processes: offset print 500 run + 250 setup; die cut 2 run h × 300; others 0
    expect(r.processRunCost).toBe(1100)
    expect(r.setupCost).toBe(250)
    expect(r.chargesCost).toBe(1000)
    expect(r.totalCost).toBe(4666)
    expect(r.costPerPiece).toBeCloseTo(4.666)

    // markup 20 % → 5599.20 → 5.60 / pc → 5,600
    expect(r.sellingPerPiece).toBe(5.6)
    expect(r.totalSelling).toBe(5600)
    expect(r.profitAmount).toBe(934)
    expect(r.taxAmount).toBe(1008)
    expect(r.grandTotal).toBe(6608)
  })

  it('distinguishes margin on selling price from markup on cost', () => {
    const r = run({ profitMethod: 'margin', profitPct: 20 })
    // 4666 ÷ 0.8 = 5832.50 → 5.83 / pc
    expect(r.sellingPerPiece).toBe(5.83)
    expect(r.totalSelling).toBe(5830)
    expect(r.effectiveMarginPct).toBeCloseTo(19.97, 1)
    expect(run({ profitMethod: 'margin', profitPct: 100 }).valid).toBe(false)
  })

  it('applies discount before tax', () => {
    const r = run({ discountType: 'percent', discountValue: 10 })
    expect(r.discountAmount).toBe(560)
    expect(r.taxableValue).toBe(5040)
    expect(r.taxAmount).toBe(907.2)
    expect(r.grandTotal).toBe(5947.2)
  })

  it('never treats a missing price as zero', () => {
    const missing = run({}, (ms) => ms.map((m) => (m.kind === 'sheet' ? { ...m, price: null } : m)))
    expect(missing.valid).toBe(false)
    expect(missing.issues.some((i) => i.level === 'error' && /Price missing/.test(i.message))).toBe(true)
    expect(missing.issues.find((i) => /Price missing/.test(i.message))?.fix?.to).toMatch(/^\/master\/costing\?material=/)

    const zero = run({}, (ms) => ms.map((m) => (m.kind === 'sheet' ? { ...m, price: 0 } : m)))
    expect(zero.valid).toBe(true)
    expect(zero.materialCost).toBe(900)
  })

  it('prices sheets per pack and per kg', () => {
    const pack = run({}, (ms) => ms.map((m) => (m.kind === 'sheet' ? { ...m, pricingBasis: 'per_pack', packSize: 100, price: 1100 } : m)))
    const packLine = pack.materialLines.find((l) => l.kind === 'sheet')!
    expect(packLine.purchaseQty).toBe(2)
    expect(packLine.surplusQty).toBe(82)
    expect(packLine.amount).toBe(2200)

    const kg = run({}, (ms) => ms.map((m) => (m.kind === 'sheet' ? { ...m, pricingBasis: 'per_kg', gsm: 300, price: 80 } : m)))
    const kgLine = kg.materialLines.find((l) => l.kind === 'sheet')!
    // 1 m × 0.7 m × 300 g = 0.21 kg/sheet × 118 = 24.78 → 25 kg
    expect(kgLine.purchaseQty).toBe(25)
    expect(kgLine.amount).toBe(2000)
  })

  it('flags invalid quantities and missing charge amounts', () => {
    expect(run({}, (m) => m, 0).valid).toBe(false)
    expect(run({ charges: [{ id: 'x', templateId: null, name: 'Design', basis: 'fixed', amount: null }] }).valid).toBe(false)
  })

  it('uses a validated ups override', () => {
    const { db, productId } = seedMaster()
    const product = db.products.find((p) => p.id === productId)!
    const materials = product.materials.map((l) => (l.id === 'bom-sheet' ? { ...l, upsOverride: 20, upsOverrideReason: 'Interlocking die' } : l))
    const r = computeOrderCosting({ quantity: 1000, product: { productId, stages: product.stages, materials }, materials: db.materials, settings: db.settings, inputs: inputs() })
    const sheet = r.materialLines.find((l) => l.kind === 'sheet')!
    expect(sheet.sheet?.upsSource).toBe('override')
    expect(sheet.netQty).toBe(100)
    expect(NOW).toBeInstanceOf(Date)
  })
})
