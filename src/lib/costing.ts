/* ---------------------------------------------------------------------------
 * Order costing engine.
 *
 * MATERIALS
 *   Sheet material
 *     pieces needed   = order qty × cut pieces per finished piece
 *     ups             = calculated grid yield (see yield.ts) or validated override
 *     net sheets      = ceil(pieces needed ÷ ups)
 *     wastage sheets  = ceil(net sheets × wastage %)          ← wastage applied ONCE, here
 *     total sheets    = net sheets + wastage sheets
 *     purchase qty    = total, converted to the priced unit (sheets / packs / kg)
 *                       and rounded UP to the purchase multiple
 *   Quantity material
 *     net qty         = order qty × consumption per piece
 *     wastage qty     = net qty × wastage %                   ← wastage applied ONCE, here
 *     purchase qty    = (net + wastage) in the priced unit, rounded UP to the multiple
 *   Material cost     = purchase qty × price  (rounded to paise per line)
 *
 * PROCESSES
 *   hours             = setup hours + run hours per 1,000 × qty ÷ 1,000
 *   run cost          = per_1000: rate × qty ÷ 1,000 · per_piece: rate × qty
 *                       per_hour: rate × run hours · fixed: rate
 *   setup cost        = setup charge (once per order)
 *
 * ORDER CHARGES       = fixed amount · per_1000 × qty ÷ 1,000 · percent of (materials + processes)
 *
 * TOTAL COST          = materials + process run + setup + order charges
 * PROFIT
 *   markup (on cost)  : target selling = cost × (1 + p%)
 *   margin (on price) : target selling = cost ÷ (1 − p%)
 *   selling / piece   = target selling ÷ qty, rounded half-up to paise
 *   total selling     = selling / piece × qty      (exact, so invoices reconcile)
 *   profit amount     = total selling − total cost  (actual, after rounding)
 * DISCOUNT            = amount, or % of total selling (rounded to paise)
 * TAXABLE VALUE       = total selling − discount
 * TAX                 = taxable value × tax %  (rounded to paise)
 * CUSTOMER AMOUNT     = taxable value + tax
 *
 * Missing prices or inputs are never treated as zero: they produce an `error`
 * issue and the costing cannot be finalized.
 * ------------------------------------------------------------------------- */

import type {
  ChargeCostLine,
  CostingInputs,
  CostingIssue,
  CostingResult,
  CostingSettings,
  Material,
  MaterialCostLine,
  ProcessCostLine,
  ProductMaterial,
  ProductSpec,
  ProductStage,
} from './types'
import { calculateYield, ceilSafe, roundUpToMultiple, validateUpsOverride } from './yield'

export const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100
export const toPaise = (value: number): number => Math.round((value + Number.EPSILON) * 100)
export const fromPaise = (paise: number): number => paise / 100
const round4 = (value: number): number => Math.round(value * 10000) / 10000

export const COST_BASIS_LABEL: Record<string, string> = {
  per_1000: 'per 1,000 pcs',
  per_piece: 'per piece',
  per_hour: 'per run hour',
  fixed: 'fixed per order',
  percent: '% of materials + processes',
}

export const PRICING_BASIS_LABEL: Record<Material['pricingBasis'], string> = {
  per_unit: 'Per unit',
  per_pack: 'Per pack',
  per_kg: 'Per kg (by GSM)',
}

export function pricedUnitLabel(m: Pick<Material, 'kind' | 'uom' | 'pricingBasis' | 'packSize'>): string {
  if (m.pricingBasis === 'per_kg') return 'kg'
  if (m.pricingBasis === 'per_pack') return `pack of ${m.packSize ?? '?'} ${m.kind === 'sheet' ? 'sheets' : m.uom}`
  return m.kind === 'sheet' ? 'sheet' : m.uom
}

/** Configuration problems on a material itself, independent of any product. */
export function materialConfigIssues(m: Material): string[] {
  const out: string[] = []
  if (m.price === null) out.push('Price missing')
  else if (!(m.price >= 0)) out.push('Price must not be negative')
  if (m.pricingBasis === 'per_pack' && !(m.packSize && m.packSize > 0)) out.push('Pack size missing')
  if (!(m.purchaseMultiple > 0)) out.push('Purchase rounding must be greater than zero')
  if (!(m.wastagePct >= 0 && m.wastagePct < 100)) out.push('Wastage must be between 0 and 99.99%')
  if (m.kind === 'sheet') {
    if (!(m.sheetLengthMm && m.sheetLengthMm > 0) || !(m.sheetWidthMm && m.sheetWidthMm > 0))
      out.push('Sheet size missing')
    if (m.pricingBasis === 'per_kg' && !(m.gsm && m.gsm > 0)) out.push('GSM missing for per-kg pricing')
  } else if (m.pricingBasis === 'per_kg') {
    out.push('Per-kg pricing applies to sheet materials; use per unit with uom kg')
  }
  return out
}

/** Configuration problems on one product usage of a sheet material. */
export function usageConfigIssues(line: ProductMaterial, m: Material): string[] {
  const out: string[] = []
  if (m.kind === 'sheet') {
    if (line.piecesPerProduct === null) out.push('Cut pieces per product not entered')
    else if (!(line.piecesPerProduct > 0)) out.push('Cut pieces per product must be greater than zero')
    if (!(line.cutLengthMm && line.cutLengthMm > 0) || !(line.cutWidthMm && line.cutWidthMm > 0))
      out.push('Cut-piece size missing')
    if (m.sheetLengthMm && m.sheetWidthMm && line.cutLengthMm && line.cutWidthMm) {
      const input = {
        sheetLengthMm: m.sheetLengthMm,
        sheetWidthMm: m.sheetWidthMm,
        cutLengthMm: line.cutLengthMm,
        cutWidthMm: line.cutWidthMm,
        edgeMarginMm: m.edgeMarginMm,
        cutGapMm: m.cutGapMm,
        rotationAllowed: line.rotationAllowed,
      }
      const overrideError = validateUpsOverride(line.upsOverride, line.upsOverrideReason, input)
      if (overrideError) out.push(overrideError)
      else if (line.upsOverride === null) {
        const y = calculateYield(input)
        if (y.ups === 0) out.push(y.error ?? 'Piece does not fit on the sheet')
      }
    }
  } else if (line.qtyPerPiece === null) {
    out.push('Consumption per piece not entered')
  } else if (!(line.qtyPerPiece > 0)) {
    out.push('Consumption per piece must be greater than zero')
  }
  return out
}

export interface CostingSource {
  productId: string
  stages: ProductStage[]
  materials: ProductMaterial[]
  /** A proposed (unconfirmed) customer specification blocks final costing. */
  spec?: ProductSpec | null
}

export function computeOrderCosting(args: {
  quantity: number
  product: CostingSource
  materials: Material[]
  settings: Pick<CostingSettings, 'processCharges' | 'taxLabel'>
  inputs: CostingInputs
}): CostingResult {
  const { product, settings, inputs } = args
  const issues: CostingIssue[] = []
  const error = (message: string, fix?: CostingIssue['fix']) => issues.push({ level: 'error', message, fix })
  const warn = (message: string, fix?: CostingIssue['fix']) => issues.push({ level: 'warning', message, fix })
  const productFix = { label: 'Open product in Master', to: `/master/products/${product.productId}` }

  const qty = args.quantity
  if (!Number.isInteger(qty) || qty < 1) error('Requested quantity must be a whole number of at least 1.')
  const q = Number.isInteger(qty) && qty > 0 ? qty : 0

  if (product.spec?.status === 'proposed') {
    const open = product.spec.openItems.length ? ` Open: ${product.spec.openItems.slice(0, 3).join('; ')}${product.spec.openItems.length > 3 ? '; …' : ''}.` : ''
    error(`Specification is a proposal awaiting customer confirmation (size ${product.spec.rawSize || 'not given'}, unit ${product.spec.sizeUnit ?? 'unknown'}).${open}`, productFix)
  }
  if (!product.stages.length) error('The product has no stages.', productFix)
  for (const s of product.stages) {
    if (!s.processes.length) error(`Stage “${s.name}” has no processes.`, productFix)
  }

  const byId = new Map(args.materials.map((m) => [m.id, m]))
  const stageName = (id: string | null) => product.stages.find((s) => s.id === id)?.name ?? ''
  const processName = (id: string | null) =>
    product.stages.flatMap((s) => s.processes).find((p) => p.id === id)?.name ?? ''

  /* -------------------------------- materials ------------------------------ */
  const materialLines: MaterialCostLine[] = []
  if (!product.materials.length) warn('No materials are defined for this product — only process costs are included.', productFix)

  for (const bom of product.materials) {
    const m = byId.get(bom.materialId)
    if (!m) {
      error('A material used by this product no longer exists in the registry.', productFix)
      continue
    }
    const materialFix = { label: `Configure ${m.name}`, to: `/master/costing?material=${m.id}` }
    if (!m.active) warn(`${m.name} is deactivated in Master but still used by this product.`, materialFix)
    for (const problem of materialConfigIssues(m)) error(`${m.name}: ${problem}.`, materialFix)
    for (const problem of usageConfigIssues(bom, m)) error(`${m.name}: ${problem}.`, materialFix)

    const line: MaterialCostLine = {
      bomLineId: bom.id,
      materialId: m.id,
      code: m.code,
      name: m.name,
      kind: m.kind,
      uom: m.uom,
      stageName: stageName(bom.stageId),
      processName: processName(bom.processId),
      price: m.price,
      pricingBasis: m.pricingBasis,
      pricedUnitLabel: pricedUnitLabel(m),
      sheet: null,
      piecesNeeded: 0,
      netQty: 0,
      wastagePct: m.wastagePct,
      wastageQty: 0,
      totalQty: 0,
      purchaseQty: 0,
      purchaseUnit: pricedUnitLabel(m),
      surplusQty: 0,
      amount: 0,
    }
    const wastagePct = m.wastagePct >= 0 && m.wastagePct < 100 ? m.wastagePct : 0
    const multiple = m.purchaseMultiple > 0 ? m.purchaseMultiple : 1

    if (m.kind === 'sheet') {
      const ready =
        m.sheetLengthMm && m.sheetWidthMm && bom.cutLengthMm && bom.cutWidthMm && bom.piecesPerProduct !== null && bom.piecesPerProduct > 0
      if (ready) {
        const input = {
          sheetLengthMm: m.sheetLengthMm!,
          sheetWidthMm: m.sheetWidthMm!,
          cutLengthMm: bom.cutLengthMm!,
          cutWidthMm: bom.cutWidthMm!,
          edgeMarginMm: m.edgeMarginMm,
          cutGapMm: m.cutGapMm,
          rotationAllowed: bom.rotationAllowed,
        }
        const y = calculateYield(input)
        const overrideOk = bom.upsOverride !== null && !validateUpsOverride(bom.upsOverride, bom.upsOverrideReason, input)
        const ups = overrideOk ? bom.upsOverride! : y.ups
        line.sheet = {
          ...input,
          calculatedUps: y.ups,
          ups,
          upsSource: overrideOk ? 'override' : 'calculated',
          orientation: y.orientation,
          across: y.across,
          along: y.along,
          overrideReason: overrideOk ? bom.upsOverrideReason : '',
          yieldPct: overrideOk
            ? (ups * input.cutLengthMm * input.cutWidthMm * 100) / (input.sheetLengthMm * input.sheetWidthMm)
            : y.yieldPct,
        }
        if (ups > 0) {
          line.piecesNeeded = q * bom.piecesPerProduct!
          line.netQty = ceilSafe(line.piecesNeeded / ups)
          line.wastageQty = ceilSafe((line.netQty * wastagePct) / 100)
          line.totalQty = line.netQty + line.wastageQty

          if (m.pricingBasis === 'per_pack' && m.packSize && m.packSize > 0) {
            line.purchaseQty = roundUpToMultiple(ceilSafe(line.totalQty / m.packSize), multiple)
            line.surplusQty = line.purchaseQty * m.packSize - line.totalQty
          } else if (m.pricingBasis === 'per_kg' && m.gsm && m.gsm > 0) {
            const kgPerSheet = (input.sheetLengthMm / 1000) * (input.sheetWidthMm / 1000) * (m.gsm / 1000)
            line.purchaseQty = roundUpToMultiple(round4(line.totalQty * kgPerSheet), multiple)
            line.surplusQty = round4(line.purchaseQty / kgPerSheet - line.totalQty)
          } else {
            line.purchaseQty = roundUpToMultiple(line.totalQty, multiple)
            line.surplusQty = round4(line.purchaseQty - line.totalQty)
          }
        }
      }
    } else if (bom.qtyPerPiece !== null && bom.qtyPerPiece > 0) {
      line.netQty = round4(q * bom.qtyPerPiece)
      line.piecesNeeded = line.netQty
      line.wastageQty = round4((line.netQty * wastagePct) / 100)
      line.totalQty = round4(line.netQty + line.wastageQty)
      if (m.pricingBasis === 'per_pack' && m.packSize && m.packSize > 0) {
        line.purchaseQty = roundUpToMultiple(ceilSafe(line.totalQty / m.packSize), multiple)
        line.surplusQty = round4(line.purchaseQty * m.packSize - line.totalQty)
      } else {
        line.purchaseQty = roundUpToMultiple(line.totalQty, multiple)
        line.surplusQty = round4(line.purchaseQty - line.totalQty)
      }
    }

    line.amount = m.price !== null && m.price >= 0 ? round2(line.purchaseQty * m.price) : 0
    materialLines.push(line)
  }

  /* -------------------------------- processes ------------------------------ */
  const processLines: ProcessCostLine[] = []
  for (const stage of product.stages) {
    for (const p of stage.processes) {
      if (p.setupHours === null) error(`${stage.name} › ${p.name}: setup time not entered (enter 0 if none).`, productFix)
      if (p.runHoursPer1000 === null) error(`${stage.name} › ${p.name}: run time not entered.`, productFix)
      const runHours = (Math.max(0, p.runHoursPer1000 ?? 0) * q) / 1000
      const hours = round2(Math.max(0, p.setupHours ?? 0) + runHours)
      let basis = p.costBasis
      let rate = p.rate
      let setupCharge = p.setupCharge
      let chargeName: string | null = null

      if (p.chargeId) {
        const charge = settings.processCharges.find((c) => c.id === p.chargeId)
        const chargeFix = { label: 'Open process charges', to: '/master/costing?tab=charges' }
        if (!charge) {
          error(`${stage.name} › ${p.name}: its process charge was removed from Master.`, productFix)
          rate = null
          setupCharge = null
        } else {
          chargeName = charge.name
          basis = charge.basis
          rate = charge.rate
          setupCharge = charge.setupCharge
          if (!charge.active) warn(`Process charge “${charge.name}” is deactivated but still referenced.`, chargeFix)
          if (rate === null) error(`Process charge “${charge.name}” has no rate.`, chargeFix)
          if (setupCharge === null) error(`Process charge “${charge.name}” has no setup charge (enter 0 if none).`, chargeFix)
        }
      } else {
        if (rate === null) error(`${stage.name} › ${p.name}: process rate missing (enter 0 if no charge).`, productFix)
        if (setupCharge === null)
          error(`${stage.name} › ${p.name}: setup charge missing (enter 0 if none).`, productFix)
      }
      if ((rate !== null && rate < 0) || (setupCharge !== null && setupCharge < 0))
        error(`${stage.name} › ${p.name}: charges cannot be negative.`, productFix)

      const r = rate !== null && rate >= 0 ? rate : 0
      const runCost =
        basis === 'per_1000'
          ? (r * q) / 1000
          : basis === 'per_piece'
            ? r * q
            : basis === 'per_hour'
              ? r * runHours
              : r
      const setupCost = setupCharge !== null && setupCharge >= 0 ? setupCharge : 0
      processLines.push({
        stageId: stage.id,
        stageName: stage.name,
        processId: p.id,
        processName: p.name,
        chargeName,
        basis,
        rate,
        setupCharge,
        hours,
        runCost: round2(runCost),
        setupCost: round2(setupCost),
        amount: round2(runCost + setupCost),
      })
    }
  }

  const materialCost = round2(materialLines.reduce((s, l) => s + l.amount, 0))
  const processRunCost = round2(processLines.reduce((s, l) => s + l.runCost, 0))
  const setupCost = round2(processLines.reduce((s, l) => s + l.setupCost, 0))

  /* ------------------------------ order charges ---------------------------- */
  const chargeLines: ChargeCostLine[] = []
  for (const c of inputs.charges) {
    const label = c.name.trim() || 'Unnamed charge'
    if (!c.name.trim()) error('Every additional order charge needs a name.')
    if (c.amount === null) error(`${label}: amount missing (enter 0 or remove the charge).`)
    else if (c.amount < 0) error(`${label}: amount cannot be negative.`)
    const a = c.amount !== null && c.amount >= 0 ? c.amount : 0
    const amount =
      c.basis === 'fixed' ? a : c.basis === 'per_1000' ? (a * q) / 1000 : ((materialCost + processRunCost + setupCost) * a) / 100
    chargeLines.push({ id: c.id, name: label, basis: c.basis, input: c.amount, amount: round2(amount) })
  }
  const chargesCost = round2(chargeLines.reduce((s, l) => s + l.amount, 0))

  const totalCost = round2(materialCost + processRunCost + setupCost + chargesCost)
  const costPerPiece = q ? totalCost / q : 0

  /* --------------------------------- pricing ------------------------------- */
  let p = inputs.profitPct
  if (!Number.isFinite(p) || p < 0) {
    error('Profit percentage must be zero or more.')
    p = 0
  } else if (inputs.profitMethod === 'margin' && p >= 100) {
    error('Margin on selling price must be below 100%.')
    p = 0
  } else if (p > 1000) {
    error('Profit percentage looks wrong (over 1000%).')
    p = 0
  }
  const targetSelling = inputs.profitMethod === 'margin' ? totalCost / (1 - p / 100) : totalCost * (1 + p / 100)
  const sellingPerPiece = q ? round2(targetSelling / q) : 0
  const totalSelling = fromPaise(toPaise(sellingPerPiece) * q)
  const profitAmount = round2(totalSelling - totalCost)
  if (q && totalCost > 0 && profitAmount < 0) warn('Selling price is below total cost after rounding.')

  let discountAmount = 0
  if (!Number.isFinite(inputs.discountValue) || inputs.discountValue < 0) {
    error('Discount cannot be negative.')
  } else if (inputs.discountType === 'percent') {
    if (inputs.discountValue > 100) error('Discount percentage cannot exceed 100%.')
    else discountAmount = round2((totalSelling * inputs.discountValue) / 100)
  } else if (inputs.discountValue > totalSelling) {
    error('Discount cannot exceed the total selling price.')
  } else {
    discountAmount = round2(inputs.discountValue)
  }

  let taxPct = inputs.taxPct
  if (!Number.isFinite(taxPct) || taxPct < 0 || taxPct > 100) {
    error('Tax percentage must be between 0 and 100.')
    taxPct = 0
  }
  const taxableValue = round2(totalSelling - discountAmount)
  const taxAmount = round2((taxableValue * taxPct) / 100)

  return {
    quantity: q,
    materialLines,
    processLines,
    chargeLines,
    materialCost,
    processRunCost,
    setupCost,
    chargesCost,
    totalCost,
    costPerPiece,
    profitMethod: inputs.profitMethod,
    profitPct: p,
    sellingPerPiece,
    totalSelling,
    profitAmount,
    effectiveMarkupPct: totalCost > 0 ? (profitAmount / totalCost) * 100 : 0,
    effectiveMarginPct: totalSelling > 0 ? (profitAmount / totalSelling) * 100 : 0,
    discountAmount,
    taxableValue,
    taxLabel: settings.taxLabel,
    taxPct,
    taxAmount,
    grandTotal: round2(taxableValue + taxAmount),
    issues,
    valid: !issues.some((i) => i.level === 'error'),
  }
}
