import type {
  ChargeBasis,
  CostBasis,
  CostingSettings,
  Customer,
  LengthUnit,
  Material,
  MaterialKind,
  OrderChargeTemplate,
  PricingBasis,
  ProcessCharge,
  Product,
  ProductMaterial,
  ProductSpec,
  ProductStage,
  ProfitMethod,
} from '../lib/types'
import { isValidGstin } from '../lib/billing'
import {
  audit,
  docCode,
  fail,
  hasFieldErrors,
  isFiniteNumber,
  nextSeq,
  ok,
  requireCapability,
  sameText,
  staleRecord,
  stampNew,
  stampUpdate,
  validationFailure,
  command,
} from './common'
import type { Op } from './common'

const nonNeg = (v: number | null) => v === null || (isFiniteNumber(v) && v >= 0)
const positiveOrNull = (v: number | null) => v === null || (isFiniteNumber(v) && v > 0)

/* ================================ Materials ================================ */

export interface MaterialDraft {
  id?: string
  code: string
  name: string
  kind: MaterialKind
  uom: string
  price: number | null
  pricingBasis: PricingBasis
  packSize: number | null
  gsm: number | null
  sizeUnit: LengthUnit
  sheetLengthMm: number | null
  sheetWidthMm: number | null
  edgeMarginMm: number
  cutGapMm: number
  wastagePct: number
  purchaseMultiple: number
  supplier: string
  notes: string
  /** Researched candidate vs approved material. Omitted = keep the stored value. */
  approval?: 'approved' | 'candidate'
  /** Supplier-stated thickness in mm, kept separately from GSM. */
  thicknessMm?: number | null
  /** `updatedAt` of the record when the editor loaded it (stale-edit protection). */
  expectedUpdatedAt?: string
}

export function blankMaterialDraft(kind: MaterialKind = 'quantity'): MaterialDraft {
  return {
    code: '',
    name: '',
    kind,
    uom: kind === 'sheet' ? 'sheet' : 'nos',
    price: null,
    pricingBasis: 'per_unit',
    packSize: null,
    gsm: null,
    sizeUnit: 'mm',
    sheetLengthMm: null,
    sheetWidthMm: null,
    edgeMarginMm: kind === 'sheet' ? 5 : 0,
    cutGapMm: kind === 'sheet' ? 3 : 0,
    wastagePct: 0,
    purchaseMultiple: 1,
    supplier: '',
    notes: '',
  }
}

export function materialToDraft(m: Material): MaterialDraft {
  return {
    id: m.id,
    code: m.code,
    name: m.name,
    kind: m.kind,
    uom: m.uom,
    price: m.price,
    pricingBasis: m.pricingBasis,
    packSize: m.packSize,
    gsm: m.gsm,
    sizeUnit: m.sizeUnit,
    sheetLengthMm: m.sheetLengthMm,
    sheetWidthMm: m.sheetWidthMm,
    edgeMarginMm: m.edgeMarginMm,
    cutGapMm: m.cutGapMm,
    wastagePct: m.wastagePct,
    purchaseMultiple: m.purchaseMultiple,
    supplier: m.supplier,
    notes: m.notes,
    approval: m.approval,
    thicknessMm: m.thicknessMm ?? null,
    expectedUpdatedAt: m.updatedAt,
  }
}

export function productsUsingMaterial(products: Product[], materialId: string): Product[] {
  return products.filter((p) => p.materials.some((l) => l.materialId === materialId))
}

export function validateMaterialDraft(materials: Material[], products: Product[], d: MaterialDraft): Record<string, string> {
  const e: Record<string, string> = {}
  const name = d.name.trim()
  if (!name) e.name = 'Enter the material name.'
  else {
    const dup = materials.find((m) => m.id !== d.id && sameText(m.name, name))
    if (dup) e.name = `“${dup.name}” already exists (${dup.code}). Select it instead of creating a duplicate.`
  }
  const code = d.code.trim()
  if (code && materials.some((m) => m.id !== d.id && sameText(m.code, code))) e.code = 'This code is already used by another material.'
  if (d.kind === 'quantity' && !d.uom.trim()) e.uom = 'Enter the unit of measure (e.g. kg, nos, mtr).'
  if (d.price !== null && !(isFiniteNumber(d.price) && d.price >= 0)) e.price = 'Price must be zero or more — or leave it blank if unknown.'
  if (d.pricingBasis === 'per_pack' && !positiveOrNull(d.packSize)) e.packSize = 'Pack size must be greater than zero.'
  if (d.pricingBasis === 'per_pack' && d.packSize === null) e.packSize = 'Enter how many units are in one pack.'
  if (d.pricingBasis === 'per_kg' && d.kind !== 'sheet') e.pricingBasis = 'Per-kg pricing needs sheet size and GSM. For bulk items use per unit with uom “kg”.'
  if (d.kind === 'sheet' && d.pricingBasis === 'per_kg' && !positiveOrNull(d.gsm)) e.gsm = 'GSM must be greater than zero.'
  if (d.thicknessMm !== undefined && !positiveOrNull(d.thicknessMm)) e.thicknessMm = 'Thickness must be greater than zero — or leave it blank.'
  if (!positiveOrNull(d.sheetLengthMm)) e.sheetLengthMm = 'Sheet length must be greater than zero.'
  if (!positiveOrNull(d.sheetWidthMm)) e.sheetWidthMm = 'Sheet width must be greater than zero.'
  if (!(isFiniteNumber(d.edgeMarginMm) && d.edgeMarginMm >= 0)) e.edgeMarginMm = 'Edge allowance cannot be negative.'
  if (!(isFiniteNumber(d.cutGapMm) && d.cutGapMm >= 0)) e.cutGapMm = 'Cutting gap cannot be negative.'
  if (
    d.kind === 'sheet' &&
    d.sheetLengthMm &&
    d.sheetWidthMm &&
    (d.sheetLengthMm - 2 * d.edgeMarginMm <= 0 || d.sheetWidthMm - 2 * d.edgeMarginMm <= 0)
  )
    e.edgeMarginMm = 'The edge allowance leaves no usable area on this sheet.'
  if (!(isFiniteNumber(d.wastagePct) && d.wastagePct >= 0 && d.wastagePct < 100)) e.wastagePct = 'Wastage must be between 0 and 99.99%.'
  if (!(isFiniteNumber(d.purchaseMultiple) && d.purchaseMultiple > 0)) e.purchaseMultiple = 'Purchase rounding must be greater than zero.'
  if (d.id) {
    const current = materials.find((m) => m.id === d.id)
    if (current && current.kind !== d.kind && productsUsingMaterial(products, d.id).length)
      e.kind = 'This material is used by products; its type cannot change. Create a new material instead.'
  }
  return e
}

export const saveMaterial = command(
  'saveMaterial',
  (draft: MaterialDraft): Op<Material> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'master')
    if (denied) return denied
    const errors = validateMaterialDraft(db.materials, db.products, draft)
    if (hasFieldErrors(errors)) return validationFailure(errors)

    const fields = {
      name: draft.name.trim(),
      kind: draft.kind,
      uom: draft.kind === 'sheet' ? 'sheet' : draft.uom.trim(),
      price: draft.price,
      pricingBasis: draft.pricingBasis,
      packSize: draft.pricingBasis === 'per_pack' ? draft.packSize : null,
      gsm: draft.kind === 'sheet' ? draft.gsm : null,
      sizeUnit: draft.sizeUnit,
      sheetLengthMm: draft.kind === 'sheet' ? draft.sheetLengthMm : null,
      sheetWidthMm: draft.kind === 'sheet' ? draft.sheetWidthMm : null,
      edgeMarginMm: draft.kind === 'sheet' ? draft.edgeMarginMm : 0,
      cutGapMm: draft.kind === 'sheet' ? draft.cutGapMm : 0,
      wastagePct: draft.wastagePct,
      purchaseMultiple: draft.purchaseMultiple,
      supplier: draft.supplier.trim(),
      notes: draft.notes.trim(),
      ...(draft.approval ? { approval: draft.approval } : {}),
      ...(draft.thicknessMm !== undefined ? { thicknessMm: draft.thicknessMm } : {}),
    }

    if (!draft.id) {
      let next = db
      let seq: number
      ;[next, seq] = nextSeq(next, 'material')
      const material: Material = {
        id: ctx.newId('MAT'),
        code: draft.code.trim() || docCode('MAT', seq),
        ...fields,
        active: true,
        priceUpdatedAt: draft.price !== null ? ctx.now.toISOString() : null,
        priceUpdatedBy: draft.price !== null ? ctx.actor.name : null,
        ...stampNew(ctx),
      }
      next = { ...next, materials: [...next.materials, material] }
      next = audit(next, ctx, {
        action: 'Material created',
        entity: 'Material',
        entityId: material.id,
        entityLabel: `${material.code} — ${material.name}`,
        field: 'Price',
        newValue: material.price === null ? 'Not set' : String(material.price),
      })
      return ok(next, material)
    }

    const current = db.materials.find((m) => m.id === draft.id)
    if (!current) return fail('Material not found.')
    const stale = staleRecord(current.name, current, draft.expectedUpdatedAt)
    if (stale) return stale
    const priceChanged = current.price !== draft.price
    const updated: Material = stampUpdate(
      {
        ...current,
        code: draft.code.trim() || current.code,
        ...fields,
        priceUpdatedAt: priceChanged ? ctx.now.toISOString() : current.priceUpdatedAt,
        priceUpdatedBy: priceChanged ? ctx.actor.name : current.priceUpdatedBy,
      },
      ctx,
    )
    let next = { ...db, materials: db.materials.map((m) => (m.id === current.id ? updated : m)) }
    next = audit(next, ctx, {
      action: priceChanged ? 'Material price changed' : 'Material updated',
      entity: 'Material',
      entityId: current.id,
      entityLabel: `${updated.code} — ${updated.name}`,
      field: priceChanged ? 'Price' : undefined,
      oldValue: priceChanged ? (current.price === null ? 'Not set' : String(current.price)) : undefined,
      newValue: priceChanged ? (updated.price === null ? 'Not set' : String(updated.price)) : undefined,
    })
    return ok(next, updated)
  },
)

export const setMaterialActive = command(
  'setMaterialActive',
  (id: string, active: boolean): Op<Material> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'master')
    if (denied) return denied
    const m = db.materials.find((x) => x.id === id)
    if (!m) return fail('Material not found.')
    const updated = stampUpdate({ ...m, active }, ctx)
    const next = audit({ ...db, materials: db.materials.map((x) => (x.id === id ? updated : x)) }, ctx, {
      action: active ? 'Material reactivated' : 'Material deactivated',
      entity: 'Material',
      entityId: id,
      entityLabel: `${m.code} — ${m.name}`,
    })
    return ok(next, updated)
  },
)

export const deleteMaterial = command(
  'deleteMaterial',
  (id: string): Op<null> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'master')
    if (denied) return denied
    const m = db.materials.find((x) => x.id === id)
    if (!m) return fail('Material not found.')
    const users = productsUsingMaterial(db.products, id)
    if (users.length)
      return fail(`${m.name} is used by ${users.map((p) => p.name).join(', ')}. Remove it from those products or deactivate it instead.`)
    const next = audit({ ...db, materials: db.materials.filter((x) => x.id !== id) }, ctx, {
      action: 'Material deleted',
      entity: 'Material',
      entityId: id,
      entityLabel: `${m.code} — ${m.name}`,
    })
    return ok(next, null)
  },
)

/** Edit one product's usage of a material (cut size, rotation, override, consumption) from Master → Costing. */
export const saveMaterialUsage =
  (
    productId: string,
    bomLineId: string,
    patch: Partial<
      Pick<ProductMaterial, 'piecesPerProduct' | 'cutLengthMm' | 'cutWidthMm' | 'rotationAllowed' | 'upsOverride' | 'upsOverrideReason' | 'qtyPerPiece'>
    >,
    expectedUpdatedAt?: string,
  ): Op<Product> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'master')
    if (denied) return denied
    const product = db.products.find((p) => p.id === productId)
    const line = product?.materials.find((l) => l.id === bomLineId)
    if (!product || !line) return fail('Product usage not found.')
    const stale = staleRecord(product.name, product, expectedUpdatedAt)
    if (stale) return stale
    const material = db.materials.find((m) => m.id === line.materialId)
    if (!material) return fail('Material not found.')
    const merged: ProductMaterial = { ...line, ...patch }
    const errors = validateBomLine(merged, material, product.stages, 'usage')
    if (hasFieldErrors(errors)) return validationFailure(errors)
    const updated = stampUpdate(
      { ...product, version: product.version + 1, materials: product.materials.map((l) => (l.id === bomLineId ? merged : l)) },
      ctx,
    )
    const next = audit({ ...db, products: db.products.map((p) => (p.id === productId ? updated : p)) }, ctx, {
      action: 'Material usage updated',
      entity: 'Product',
      entityId: productId,
      entityLabel: `${product.code} — ${product.name} · ${material.name}`,
      field: merged.upsOverride !== null ? 'Ups override' : undefined,
      newValue: merged.upsOverride !== null ? `${merged.upsOverride} (${merged.upsOverrideReason})` : undefined,
    })
    return ok(next, updated)
  }

/* ================================ Products ================================= */

export interface ProductDraft {
  id?: string
  code: string
  name: string
  category: string
  description: string
  hsn: string
  uom: string
  taxPct: number | null
  stages: ProductStage[]
  materials: ProductMaterial[]
  /** Customer specification. Omitted = keep the stored one. */
  spec?: ProductSpec | null
  expectedUpdatedAt?: string
}

/** A specification can be marked confirmed only once its measurements are known. */
export function validateSpec(spec: ProductSpec | null | undefined): Record<string, string> {
  const e: Record<string, string> = {}
  if (!spec) return e
  const positive = (v: number | null) => v === null || (isFiniteNumber(v) && v > 0)
  if (!positive(spec.lengthMm)) e['spec.lengthMm'] = 'Length must be greater than zero — or leave it blank.'
  if (!positive(spec.widthMm)) e['spec.widthMm'] = 'Width must be greater than zero — or leave it blank.'
  if (!positive(spec.heightMm)) e['spec.heightMm'] = 'Height must be greater than zero — or leave it blank.'
  if (spec.requestedQty !== null && !(Number.isInteger(spec.requestedQty) && spec.requestedQty >= 1))
    e['spec.requestedQty'] = 'Requested quantity must be a whole number of at least 1.'
  if (spec.status === 'confirmed') {
    if (!spec.sizeUnit?.trim()) e['spec.sizeUnit'] = 'Record the confirmed size unit before marking the specification confirmed.'
    if (!spec.dimensionBasis) e['spec.dimensionBasis'] = 'State whether the dimensions are internal or external.'
    if (spec.lengthMm === null) e['spec.lengthMm'] = 'Enter the confirmed length.'
    if (spec.widthMm === null) e['spec.widthMm'] = 'Enter the confirmed width.'
    if (spec.heightMm === null) e['spec.heightMm'] = 'Enter the confirmed height.'
  }
  return e
}

/**
 * What blocks SAVING a material usage. Only values the product model cannot hold
 * are refused (negative sizes, fractional piece counts, broken references).
 * Incomplete or not-yet-workable settings — a missing cut size, a piece that does
 * not fit the sheet, an ups override still waiting for its reason — are saved as
 * entered and reported by costing readiness instead (lib/costing usageConfigIssues).
 */
function validateBomLine(
  line: ProductMaterial,
  m: Material,
  stages: ProductStage[],
  prefix: string,
): Record<string, string> {
  const e: Record<string, string> = {}
  const key = (f: string) => `${prefix}.${line.id}.${f}`
  if (line.stageId && !stages.some((s) => s.id === line.stageId)) e[key('stage')] = 'The linked stage no longer exists.'
  if (line.processId) {
    const stage = stages.find((s) => s.id === line.stageId)
    if (!stage || !stage.processes.some((p) => p.id === line.processId)) e[key('process')] = 'The linked process must belong to the selected stage.'
  }
  if (m.kind === 'sheet') {
    if (line.piecesPerProduct !== null && !(Number.isInteger(line.piecesPerProduct) && line.piecesPerProduct >= 1))
      e[key('piecesPerProduct')] = 'Cut pieces per product must be a whole number of at least 1 — or leave it blank until the cut list is approved.'
    if (!positiveOrNull(line.cutLengthMm)) e[key('cutLengthMm')] = 'Cut length must be greater than zero — or leave it blank.'
    if (!positiveOrNull(line.cutWidthMm)) e[key('cutWidthMm')] = 'Cut width must be greater than zero — or leave it blank.'
    if (line.upsOverride !== null && !(Number.isInteger(line.upsOverride) && line.upsOverride >= 1))
      e[key('upsOverride')] = 'Ups override must be a whole number of at least 1.'
  } else if (line.qtyPerPiece !== null && !(isFiniteNumber(line.qtyPerPiece) && line.qtyPerPiece > 0)) {
    e[key('qtyPerPiece')] = 'Consumption per piece must be greater than zero — or leave it blank until it is measured.'
  }
  return e
}

export function validateProductDraft(
  products: Product[],
  materials: Material[],
  charges: ProcessCharge[],
  d: ProductDraft,
): Record<string, string> {
  const e: Record<string, string> = {}
  if (!d.name.trim()) e.name = 'Enter the product name.'
  else if (products.some((p) => p.id !== d.id && sameText(p.name, d.name))) e.name = 'A product with this name already exists.'
  if (d.code.trim() && products.some((p) => p.id !== d.id && sameText(p.code, d.code))) e.code = 'This code is already used by another product.'
  if (!d.uom.trim()) e.uom = 'Enter the finished-goods unit (e.g. pcs).'
  if (d.taxPct !== null && !(isFiniteNumber(d.taxPct) && d.taxPct >= 0 && d.taxPct <= 100)) e.taxPct = 'Tax must be between 0 and 100%.'
  if (!d.stages.length) e.stages = 'Add at least one stage.'
  Object.assign(e, validateSpec(d.spec))

  d.stages.forEach((s, i) => {
    if (!s.name.trim()) e[`stage.${s.id}.name`] = `Name stage ${i + 1}.`
    else if (d.stages.some((o) => o.id !== s.id && sameText(o.name, s.name))) e[`stage.${s.id}.name`] = 'Stage names must be unique within the product.'
    if (!s.processes.length) e[`stage.${s.id}.processes`] = `Add at least one process to stage ${i + 1}.`
    s.processes.forEach((p, j) => {
      const k = (f: string) => `process.${p.id}.${f}`
      if (!p.name.trim()) e[k('name')] = `Name process ${j + 1} of stage ${i + 1}.`
      if (!nonNeg(p.setupHours)) e[k('setupHours')] = 'Setup hours cannot be negative — or leave blank until measured.'
      if (!nonNeg(p.runHoursPer1000)) e[k('runHoursPer1000')] = 'Run hours cannot be negative — or leave blank until measured.'
      if (p.chargeId) {
        if (!charges.some((c) => c.id === p.chargeId)) e[k('chargeId')] = 'Select an existing process charge.'
      } else {
        if (!nonNeg(p.rate)) e[k('rate')] = 'Rate must be zero or more.'
        if (!nonNeg(p.setupCharge)) e[k('setupCharge')] = 'Setup charge must be zero or more.'
      }
    })
  })

  d.materials.forEach((line) => {
    const m = materials.find((x) => x.id === line.materialId)
    if (!m) {
      e[`material.${line.id}.materialId`] = 'Select a material.'
      return
    }
    Object.assign(e, validateBomLine(line, m, d.stages, 'material'))
  })
  return e
}

function normaliseProduct(d: ProductDraft) {
  return {
    name: d.name.trim(),
    category: d.category.trim(),
    description: d.description.trim(),
    hsn: d.hsn.trim(),
    uom: d.uom.trim(),
    taxPct: d.taxPct,
    stages: d.stages.map((s) => ({
      ...s,
      name: s.name.trim(),
      description: s.description.trim(),
      processes: s.processes.map((p) => ({
        ...p,
        name: p.name.trim(),
        description: p.description.trim(),
        rate: p.chargeId ? null : p.rate,
        setupCharge: p.chargeId ? null : p.setupCharge,
      })),
    })),
    materials: d.materials.map((l) => ({ ...l, upsOverrideReason: l.upsOverrideReason.trim(), note: l.note.trim() })),
    ...(d.spec !== undefined ? { spec: d.spec ? { ...d.spec, sizeUnit: d.spec.sizeUnit?.trim() || null, notes: d.spec.notes.trim() } : null } : {}),
  }
}

export const saveProduct = command(
  'saveProduct',
  (draft: ProductDraft): Op<Product> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'master')
    if (denied) return denied
    const errors = validateProductDraft(db.products, db.materials, db.settings.processCharges, draft)
    if (hasFieldErrors(errors)) return validationFailure(errors)
    const processCount = draft.stages.reduce((s, st) => s + st.processes.length, 0)
    const summary = `${draft.stages.length} stages · ${processCount} processes · ${draft.materials.length} materials`

    if (!draft.id) {
      let next = db
      let seq: number
      ;[next, seq] = nextSeq(next, 'product')
      const product: Product = {
        id: ctx.newId('PRD'),
        code: draft.code.trim() || docCode('PRD', seq),
        ...normaliseProduct(draft),
        active: true,
        version: 1,
        ...stampNew(ctx),
      }
      next = audit({ ...next, products: [...next.products, product] }, ctx, {
        action: 'Product created',
        entity: 'Product',
        entityId: product.id,
        entityLabel: `${product.code} — ${product.name}`,
        newValue: summary,
      })
      return ok(next, product)
    }

    const current = db.products.find((p) => p.id === draft.id)
    if (!current) return fail('Product not found.')
    const stale = staleRecord(current.name, current, draft.expectedUpdatedAt)
    if (stale) return stale
    const updated: Product = stampUpdate(
      { ...current, code: draft.code.trim() || current.code, ...normaliseProduct(draft), version: current.version + 1 },
      ctx,
    )
    const before = `${current.stages.length} stages · ${current.stages.reduce((s, st) => s + st.processes.length, 0)} processes · ${current.materials.length} materials`
    const next = audit({ ...db, products: db.products.map((p) => (p.id === current.id ? updated : p)) }, ctx, {
      action: 'Product updated',
      entity: 'Product',
      entityId: current.id,
      entityLabel: `${updated.code} — ${updated.name}`,
      field: 'Definition',
      oldValue: before,
      newValue: `${summary} (v${updated.version})`,
    })
    return ok(next, updated)
  },
)

export const setProductActive = command(
  'setProductActive',
  (id: string, active: boolean): Op<Product> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'master')
    if (denied) return denied
    const p = db.products.find((x) => x.id === id)
    if (!p) return fail('Product not found.')
    const updated = stampUpdate({ ...p, active }, ctx)
    return ok(
      audit({ ...db, products: db.products.map((x) => (x.id === id ? updated : x)) }, ctx, {
        action: active ? 'Product reactivated' : 'Product deactivated',
        entity: 'Product',
        entityId: id,
        entityLabel: `${p.code} — ${p.name}`,
      }),
      updated,
    )
  },
)

export const deleteProduct = command(
  'deleteProduct',
  (id: string): Op<null> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'master')
    if (denied) return denied
    const p = db.products.find((x) => x.id === id)
    if (!p) return fail('Product not found.')
    if (db.plans.some((pl) => pl.productId === id))
      return fail(`${p.name} is referenced by plans or orders. Deactivate it instead so history stays intact.`)
    return ok(
      audit({ ...db, products: db.products.filter((x) => x.id !== id) }, ctx, {
        action: 'Product deleted',
        entity: 'Product',
        entityId: id,
        entityLabel: `${p.code} — ${p.name}`,
      }),
      null,
    )
  },
)

/* ================================ Customers ================================ */

export interface CustomerDraft {
  id?: string
  code: string
  company: string
  contactPerson: string
  phone: string
  email: string
  billingAddress: string
  deliveryAddress: string
  gstin: string
  placeOfSupply: string
  paymentTerms: string
  notes: string
  expectedUpdatedAt?: string
}

export function blankCustomerDraft(): CustomerDraft {
  return {
    code: '',
    company: '',
    contactPerson: '',
    phone: '',
    email: '',
    billingAddress: '',
    deliveryAddress: '',
    gstin: '',
    placeOfSupply: '',
    paymentTerms: '',
    notes: '',
  }
}

export function validateCustomerDraft(customers: Customer[], d: CustomerDraft): Record<string, string> {
  const e: Record<string, string> = {}
  if (!d.company.trim()) e.company = 'Enter the company name.'
  else if (customers.some((c) => c.id !== d.id && sameText(c.company, d.company)))
    e.company = 'A customer with this company name already exists.'
  if (d.code.trim() && customers.some((c) => c.id !== d.id && sameText(c.code, d.code))) e.code = 'This code is already used.'
  if (d.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) e.email = 'Enter a valid email address, e.g. accounts@example.com.'
  if (d.phone.trim() && !/^[+0-9 ()-]{6,20}$/.test(d.phone.trim())) e.phone = 'Use digits, spaces, +, - or brackets only.'
  if (!d.billingAddress.trim()) e.billingAddress = 'The billing address is required for invoices.'
  if (d.gstin.trim() && !isValidGstin(d.gstin)) e.gstin = 'A GSTIN has 15 characters and starts with the 2-digit state code.'
  return e
}

export const saveCustomer = command(
  'saveCustomer',
  (draft: CustomerDraft): Op<Customer> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'master')
    if (denied) return denied
    const errors = validateCustomerDraft(db.customers, draft)
    if (hasFieldErrors(errors)) return validationFailure(errors)
    const fields = {
      company: draft.company.trim(),
      contactPerson: draft.contactPerson.trim(),
      phone: draft.phone.trim(),
      email: draft.email.trim(),
      billingAddress: draft.billingAddress.trim(),
      deliveryAddress: draft.deliveryAddress.trim(),
      gstin: draft.gstin.trim().toUpperCase(),
      placeOfSupply: draft.placeOfSupply.trim(),
      paymentTerms: draft.paymentTerms.trim(),
      notes: draft.notes.trim(),
    }
    if (!draft.id) {
      let next = db
      let seq: number
      ;[next, seq] = nextSeq(next, 'customer')
      const customer: Customer = {
        id: ctx.newId('CUS'),
        code: draft.code.trim() || docCode('CUS', seq),
        ...fields,
        active: true,
        ...stampNew(ctx),
      }
      next = audit({ ...next, customers: [...next.customers, customer] }, ctx, {
        action: 'Customer created',
        entity: 'Customer',
        entityId: customer.id,
        entityLabel: `${customer.code} — ${customer.company}`,
      })
      return ok(next, customer)
    }
    const current = db.customers.find((c) => c.id === draft.id)
    if (!current) return fail('Customer not found.')
    const stale = staleRecord(current.company, current, draft.expectedUpdatedAt)
    if (stale) return stale
    const updated = stampUpdate({ ...current, code: draft.code.trim() || current.code, ...fields }, ctx)
    const changed = (Object.keys(fields) as Array<keyof typeof fields>).filter((k) => current[k] !== updated[k])
    const next = audit({ ...db, customers: db.customers.map((c) => (c.id === current.id ? updated : c)) }, ctx, {
      action: 'Customer updated',
      entity: 'Customer',
      entityId: current.id,
      entityLabel: `${updated.code} — ${updated.company}`,
      field: changed.length ? changed.join(', ') : undefined,
    })
    return ok(next, updated)
  },
)

export const setCustomerActive = command(
  'setCustomerActive',
  (id: string, active: boolean): Op<Customer> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'master')
    if (denied) return denied
    const c = db.customers.find((x) => x.id === id)
    if (!c) return fail('Customer not found.')
    const updated = stampUpdate({ ...c, active }, ctx)
    return ok(
      audit({ ...db, customers: db.customers.map((x) => (x.id === id ? updated : x)) }, ctx, {
        action: active ? 'Customer reactivated' : 'Customer deactivated',
        entity: 'Customer',
        entityId: id,
        entityLabel: `${c.code} — ${c.company}`,
      }),
      updated,
    )
  },
)

export const deleteCustomer = command(
  'deleteCustomer',
  (id: string): Op<null> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'master')
    if (denied) return denied
    const c = db.customers.find((x) => x.id === id)
    if (!c) return fail('Customer not found.')
    if (db.plans.some((p) => p.customerId === id))
      return fail(`${c.company} is referenced by plans or orders. Deactivate the customer instead.`)
    return ok(
      audit({ ...db, customers: db.customers.filter((x) => x.id !== id) }, ctx, {
        action: 'Customer deleted',
        entity: 'Customer',
        entityId: id,
        entityLabel: `${c.code} — ${c.company}`,
      }),
      null,
    )
  },
)

/* ========================== Costing configuration ========================== */

export interface ProcessChargeDraft {
  id?: string
  name: string
  basis: CostBasis
  rate: number | null
  setupCharge: number | null
  expectedUpdatedAt?: string
}

export const saveProcessCharge = command(
  'saveProcessCharge',
  (d: ProcessChargeDraft): Op<ProcessCharge> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'master')
    if (denied) return denied
    const e: Record<string, string> = {}
    if (!d.name.trim()) e.name = 'Enter the charge name.'
    else if (db.settings.processCharges.some((c) => c.id !== d.id && sameText(c.name, d.name))) e.name = 'A process charge with this name exists.'
    if (!nonNeg(d.rate)) e.rate = 'Rate must be zero or more.'
    if (!nonNeg(d.setupCharge)) e.setupCharge = 'Setup charge must be zero or more.'
    if (hasFieldErrors(e)) return validationFailure(e)
    const current = d.id ? db.settings.processCharges.find((c) => c.id === d.id) : undefined
    if (d.id && !current) return fail('Process charge not found.')
    const stale = current ? staleRecord(current.name, current, d.expectedUpdatedAt) : null
    if (stale) return stale
    const charge: ProcessCharge = current
      ? stampUpdate({ ...current, name: d.name.trim(), basis: d.basis, rate: d.rate, setupCharge: d.setupCharge }, ctx)
      : { id: ctx.newId('PCH'), name: d.name.trim(), basis: d.basis, rate: d.rate, setupCharge: d.setupCharge, active: true, ...stampNew(ctx) }
    const processCharges = current
      ? db.settings.processCharges.map((c) => (c.id === charge.id ? charge : c))
      : [...db.settings.processCharges, charge]
    const next = audit({ ...db, settings: { ...db.settings, processCharges } }, ctx, {
      action: current ? 'Process charge updated' : 'Process charge created',
      entity: 'Costing Config',
      entityId: charge.id,
      entityLabel: charge.name,
      field: 'Rate / setup',
      oldValue: current ? `${current.rate ?? 'Not set'} / ${current.setupCharge ?? 'Not set'}` : undefined,
      newValue: `${charge.rate ?? 'Not set'} / ${charge.setupCharge ?? 'Not set'}`,
    })
    return ok(next, charge)
  },
)

export function productsUsingCharge(products: Product[], chargeId: string): Product[] {
  return products.filter((p) => p.stages.some((s) => s.processes.some((pr) => pr.chargeId === chargeId)))
}

export const setProcessChargeActive = command(
  'setProcessChargeActive',
  (id: string, active: boolean): Op<null> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'master')
    if (denied) return denied
    const c = db.settings.processCharges.find((x) => x.id === id)
    if (!c) return fail('Process charge not found.')
    return ok(
      audit(
        { ...db, settings: { ...db.settings, processCharges: db.settings.processCharges.map((x) => (x.id === id ? stampUpdate({ ...x, active }, ctx) : x)) } },
        ctx,
        { action: active ? 'Process charge reactivated' : 'Process charge deactivated', entity: 'Costing Config', entityId: id, entityLabel: c.name },
      ),
      null,
    )
  },
)

export const deleteProcessCharge = command(
  'deleteProcessCharge',
  (id: string): Op<null> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'master')
    if (denied) return denied
    const c = db.settings.processCharges.find((x) => x.id === id)
    if (!c) return fail('Process charge not found.')
    const users = productsUsingCharge(db.products, id)
    if (users.length) return fail(`“${c.name}” is used by ${users.map((p) => p.name).join(', ')}. Deactivate it instead.`)
    return ok(
      audit({ ...db, settings: { ...db.settings, processCharges: db.settings.processCharges.filter((x) => x.id !== id) } }, ctx, {
        action: 'Process charge deleted',
        entity: 'Costing Config',
        entityId: id,
        entityLabel: c.name,
      }),
      null,
    )
  },
)

export interface OrderChargeDraft {
  id?: string
  name: string
  basis: ChargeBasis
  amount: number | null
  applyByDefault: boolean
  active: boolean
}

export const saveOrderChargeTemplate = command(
  'saveOrderChargeTemplate',
  (d: OrderChargeDraft): Op<OrderChargeTemplate> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'master')
    if (denied) return denied
    const e: Record<string, string> = {}
    if (!d.name.trim()) e.name = 'Enter the charge name.'
    else if (db.settings.orderCharges.some((c) => c.id !== d.id && sameText(c.name, d.name))) e.name = 'An order charge with this name exists.'
    if (!nonNeg(d.amount)) e.amount = 'Amount must be zero or more.'
    if (d.basis === 'percent' && d.amount !== null && d.amount > 100) e.amount = 'A percentage charge cannot exceed 100%.'
    if (hasFieldErrors(e)) return validationFailure(e)
    const template: OrderChargeTemplate = {
      id: d.id ?? ctx.newId('OCH'),
      name: d.name.trim(),
      basis: d.basis,
      amount: d.amount,
      applyByDefault: d.applyByDefault,
      active: d.active,
    }
    const exists = db.settings.orderCharges.some((c) => c.id === template.id)
    const orderCharges = exists
      ? db.settings.orderCharges.map((c) => (c.id === template.id ? template : c))
      : [...db.settings.orderCharges, template]
    return ok(
      audit({ ...db, settings: { ...db.settings, orderCharges } }, ctx, {
        action: exists ? 'Order charge updated' : 'Order charge created',
        entity: 'Costing Config',
        entityId: template.id,
        entityLabel: template.name,
        newValue: `${template.amount ?? 'Not set'} (${template.basis})`,
      }),
      template,
    )
  },
)

export const deleteOrderChargeTemplate = command(
  'deleteOrderChargeTemplate',
  (id: string): Op<null> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'master')
    if (denied) return denied
    const c = db.settings.orderCharges.find((x) => x.id === id)
    if (!c) return fail('Order charge not found.')
    return ok(
      audit({ ...db, settings: { ...db.settings, orderCharges: db.settings.orderCharges.filter((x) => x.id !== id) } }, ctx, {
        action: 'Order charge deleted',
        entity: 'Costing Config',
        entityId: id,
        entityLabel: c.name,
      }),
      null,
    )
  },
)

export interface CostingDefaultsDraft {
  taxLabel: string
  taxPct: number
  profitMethod: ProfitMethod
  profitPct: number
  bufferHours: number
  expectedUpdatedAt?: string | null
}

export const saveCostingDefaults = command(
  'saveCostingDefaults',
  (d: CostingDefaultsDraft): Op<CostingSettings> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'master')
    if (denied) return denied
    const stale = staleRecord('Costing defaults', db.settings, d.expectedUpdatedAt)
    if (stale) return stale
    const e: Record<string, string> = {}
    if (!d.taxLabel.trim()) e.taxLabel = 'Enter the tax label shown on invoices, e.g. GST.'
    if (!(isFiniteNumber(d.taxPct) && d.taxPct >= 0 && d.taxPct <= 100)) e.taxPct = 'Tax must be between 0 and 100%.'
    if (!(isFiniteNumber(d.profitPct) && d.profitPct >= 0)) e.profitPct = 'Profit must be zero or more.'
    else if (d.profitMethod === 'margin' && d.profitPct >= 100) e.profitPct = 'Margin on selling price must be below 100%.'
    if (!(isFiniteNumber(d.bufferHours) && d.bufferHours >= 0 && d.bufferHours <= 200)) e.bufferHours = 'Buffer must be between 0 and 200 working hours.'
    if (hasFieldErrors(e)) return validationFailure(e)
    const prev = db.settings
    const settings: CostingSettings = {
      ...prev,
      taxLabel: d.taxLabel.trim(),
      taxPct: d.taxPct,
      profitMethod: d.profitMethod,
      profitPct: d.profitPct,
      bufferHours: d.bufferHours,
      updatedAt: ctx.now.toISOString(),
      updatedBy: ctx.actor.name,
    }
    return ok(
      audit({ ...db, settings }, ctx, {
        action: 'Costing defaults updated',
        entity: 'Costing Config',
        entityId: 'defaults',
        entityLabel: 'Costing defaults',
        oldValue: `${prev.taxLabel} ${prev.taxPct}% · ${prev.profitMethod} ${prev.profitPct}% · buffer ${prev.bufferHours} h`,
        newValue: `${settings.taxLabel} ${settings.taxPct}% · ${settings.profitMethod} ${settings.profitPct}% · buffer ${settings.bufferHours} h`,
      }),
      settings,
    )
  },
)
