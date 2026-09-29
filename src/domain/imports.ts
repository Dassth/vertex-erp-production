/* ---------------------------------------------------------------------------
 * Product template import.
 *
 * Run explicitly by Administrator 1 — never on start-up. Every template row
 * carries a stable import key, so a repeated import creates nothing new and
 * never overwrites a product that was edited after the first import. Existing
 * records that already represent a row (same name, same source name and size,
 * or a declared alias) are left untouched and reported instead of duplicated.
 * ------------------------------------------------------------------------- */

import type { Material, Product, ProductMaterial, ProductStage, VertexDB } from '../lib/types'
import {
  DEFAULT_COST_BASIS,
  JEWELLERY_BATCH_ID,
  JEWELLERY_MATERIALS,
  JEWELLERY_PRODUCTS,
  jewelleryRoute,
  templateProductName,
  templateSpec,
} from '../lib/templates/jewelleryBoxes'
import type { MaterialTemplate, ProductTemplate } from '../lib/templates/jewelleryBoxes'
import type { SheetProduct } from '../lib/productSheet'
import { blankMaterialDraft, saveMaterial, saveProduct } from './master'
import { audit, docCode, fail, nextSeq, ok, requireCapability, sameText, stampNew, command } from './common'
import type { Op } from './common'

export interface TemplateBatch {
  id: string
  title: string
  materials: MaterialTemplate[]
  products: ProductTemplate[]
}

export const TEMPLATE_BATCHES: Record<string, TemplateBatch> = {
  [JEWELLERY_BATCH_ID]: {
    id: JEWELLERY_BATCH_ID,
    title: 'Jewellery boxes — ten proposed magnetic rigid-box products',
    materials: JEWELLERY_MATERIALS,
    products: JEWELLERY_PRODUCTS,
  },
}

export type ImportRowOutcome =
  | { kind: 'create'; name: string; key: string }
  | { kind: 'already-imported'; name: string; key: string; productId: string; code: string }
  | { kind: 'matches-existing'; name: string; key: string; productId: string; code: string; reason: string }

export interface ImportPlan {
  batchId: string
  rows: ImportRowOutcome[]
  materialsToCreate: string[]
  materialsReused: Array<{ name: string; code: string }>
}

const materialImportKey = (batchId: string, key: string) => `${batchId}:material:${key}`
const normal = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').replace(/[–—]/g, '-').trim()

function findMaterial(db: VertexDB, batchId: string, t: MaterialTemplate): Material | undefined {
  return db.materials.find((m) => m.importKey === materialImportKey(batchId, t.key)) ?? db.materials.find((m) => sameText(m.name, t.name))
}

function matchProduct(db: VertexDB, batchId: string, t: ProductTemplate): ImportRowOutcome {
  const name = templateProductName(t)
  const importKey = `${batchId}:${t.key}`
  const imported = db.products.find((p) => p.spec?.importKey === importKey)
  if (imported) return { kind: 'already-imported', name, key: t.key, productId: imported.id, code: imported.code }
  const sameName = db.products.find((p) => normal(p.name) === normal(name))
  if (sameName) return { kind: 'matches-existing', name, key: t.key, productId: sameName.id, code: sameName.code, reason: 'A product with this name and size already exists.' }
  const sameSpec = db.products.find((p) => p.spec && sameText(p.spec.sourceName, t.sourceName) && p.spec.rawSize.replace(/\s/g, '') === t.rawSize)
  if (sameSpec) return { kind: 'matches-existing', name, key: t.key, productId: sameSpec.id, code: sameSpec.code, reason: `Its specification already records "${t.sourceName}" size ${t.rawSize}.` }
  // Alias match (e.g. an existing "Jimikki box"): review it rather than create a second record.
  const alias = db.products.find((p) => [t.sourceName, ...t.aliases].some((a) => normal(p.name) === normal(a) || normal(p.name).startsWith(`${normal(a)} `)))
  if (alias)
    return {
      kind: 'matches-existing',
      name,
      key: t.key,
      productId: alias.id,
      code: alias.code,
      reason: `"${alias.name}" looks like the same product (name or alias match) but its size is not recorded. It was not changed — review it before importing this row separately.`,
    }
  return { kind: 'create', name, key: t.key }
}

/** What an import would do, without changing anything. */
export function planTemplateImport(db: VertexDB, batchId: string): ImportPlan | null {
  const batch = TEMPLATE_BATCHES[batchId]
  if (!batch) return null
  const rows = batch.products.map((t) => matchProduct(db, batchId, t))
  const needed = new Set(rows.filter((r) => r.kind === 'create').flatMap((r) => batch.products.find((t) => t.key === r.key)!.usage.map((u) => u.material)))
  // Candidate materials are created once for the batch, even if no product row needs them yet.
  const materialsToCreate: string[] = []
  const materialsReused: ImportPlan['materialsReused'] = []
  for (const m of batch.materials) {
    const existing = findMaterial(db, batchId, m)
    if (existing) materialsReused.push({ name: existing.name, code: existing.code })
    else if (needed.has(m.key) || rows.some((r) => r.kind === 'create')) materialsToCreate.push(m.name)
  }
  return { batchId, rows, materialsToCreate, materialsReused }
}

export interface ImportResult {
  created: Array<{ id: string; code: string; name: string }>
  skipped: Array<{ name: string; reason: string }>
  materialsCreated: number
}

export const importProductTemplates = command(
  'importProductTemplates',
  (batchId: string): Op<ImportResult> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'master')
    if (denied) return denied
    const batch = TEMPLATE_BATCHES[batchId]
    if (!batch) return fail('Unknown template batch.')
    const plan = planTemplateImport(db, batchId)!
    const result: ImportResult = { created: [], skipped: [], materialsCreated: 0 }
    for (const r of plan.rows)
      if (r.kind !== 'create')
        result.skipped.push({ name: r.name, reason: r.kind === 'already-imported' ? `Already imported as ${r.code} — left unchanged.` : `${r.reason} (${r.code})` })
    const toCreate = plan.rows.filter((r) => r.kind === 'create')
    if (!toCreate.length) return ok(db, result)

    let next = db
    const materialIds = new Map<string, string>()
    for (const t of batch.materials) {
      const existing = findMaterial(next, batchId, t)
      if (existing) {
        materialIds.set(t.key, existing.id)
        continue
      }
      let seq: number
      ;[next, seq] = nextSeq(next, 'material')
      const material: Material = {
        id: ctx.newId('MAT'),
        code: docCode('MAT', seq),
        name: t.name,
        kind: t.kind,
        uom: t.kind === 'sheet' ? 'sheet' : t.uom,
        price: null,
        pricingBasis: 'per_unit',
        packSize: null,
        gsm: null,
        sizeUnit: 'mm',
        sheetLengthMm: null,
        sheetWidthMm: null,
        edgeMarginMm: 0,
        cutGapMm: 0,
        wastagePct: 0,
        purchaseMultiple: 1,
        supplier: t.supplier,
        notes: `${t.notes}\nWastage, edge margin and cutting gap are 0 until a documented basis is entered.`,
        active: true,
        priceUpdatedAt: null,
        priceUpdatedBy: null,
        approval: 'candidate',
        thicknessMm: null,
        importKey: materialImportKey(batchId, t.key),
        ...stampNew(ctx),
      }
      next = { ...next, materials: [...next.materials, material] }
      materialIds.set(t.key, material.id)
      result.materialsCreated++
    }

    for (const row of toCreate) {
      const t = batch.products.find((p) => p.key === row.key)!
      const idBase = `${batchId}:${t.key}`
      const route = jewelleryRoute(t.insertApproach, t.fitNote)
      const stages: ProductStage[] = route.map((s) => ({
        id: `stg:${idBase}:${s.key}`,
        name: s.name,
        description: s.description,
        processes: s.processes.map((p) => ({
          id: `prc:${idBase}:${s.key}:${p.key}`,
          name: p.name,
          description: p.description,
          setupHours: null,
          runHoursPer1000: null,
          chargeId: null,
          costBasis: DEFAULT_COST_BASIS,
          rate: null,
          setupCharge: null,
          requiresMachine: false,
          method: '',
        })),
      }))
      const materials: ProductMaterial[] = t.usage.map((u) => ({
        id: `bom:${idBase}:${u.key}`,
        materialId: materialIds.get(u.material)!,
        stageId: `stg:${idBase}:${u.stage}`,
        processId: u.process ? `prc:${idBase}:${u.stage}:${u.process}` : null,
        qtyPerPiece: null,
        piecesPerProduct: null,
        cutLengthMm: null,
        cutWidthMm: null,
        rotationAllowed: false,
        upsOverride: null,
        upsOverrideReason: '',
        note: `${u.note} Rotation off until grain direction is confirmed. Proposed usage — awaiting confirmation.`,
      }))
      let seq: number
      ;[next, seq] = nextSeq(next, 'product')
      const product: Product = {
        id: ctx.newId('PRD'),
        code: docCode('PRD', seq),
        name: row.name,
        category: 'Jewellery box',
        description: `Proposed magnetic rigid box for ${t.sourceName} (customer size "${t.rawSize}", unit unknown). Insert: ${t.insertApproach}.`,
        hsn: '',
        uom: 'pcs',
        taxPct: null,
        stages,
        materials,
        active: true,
        version: 1,
        spec: templateSpec(t, batchId),
        ...stampNew(ctx),
      }
      next = audit({ ...next, products: [...next.products, product] }, ctx, {
        action: 'Product created (template import)',
        entity: 'Product',
        entityId: product.id,
        entityLabel: `${product.code} — ${product.name}`,
        newValue: `Proposed specification · ${stages.length} stages · ${stages.reduce((n, s) => n + s.processes.length, 0)} processes · ${materials.length} material usages`,
      })
      result.created.push({ id: product.id, code: product.code, name: product.name })
    }

    next = audit(next, ctx, {
      action: 'Product templates imported',
      entity: 'System',
      entityId: batchId,
      entityLabel: batch.title,
      newValue: `${result.created.length} created, ${result.skipped.length} skipped, ${result.materialsCreated} candidate materials added`,
    })
    return ok(next, result)
  },
)

/* ---------------------------------------------------------------------------
 * Products from a file (Master → Products → Add from file). Whatever the file
 * gives is saved; what it does not give stays empty and shows up later as a
 * missing detail in costing — never a reason to refuse the product.
 * ------------------------------------------------------------------------- */

export interface FileImportResult {
  created: Array<{ id: string; code: string; name: string }>
  skipped: Array<{ name: string; reason: string }>
  materialsCreated: string[]
}

const positive = (n: number | null) => (n !== null && Number.isFinite(n) && n > 0 ? n : null)
const zeroOrMore = (n: number | null) => (n !== null && Number.isFinite(n) && n >= 0 ? n : null)

export const importProductsFromFile = command(
  'importProductsFromFile',
  (products: SheetProduct[], fileName: string): Op<FileImportResult> =>
  (db, ctx) => {
    const denied = requireCapability(ctx, 'master')
    if (denied) return denied
    if (!Array.isArray(products) || !products.length) return fail('The file has no products to add.')
    let next = db
    const result: FileImportResult = { created: [], skipped: [], materialsCreated: [] }

    for (const p of products) {
      const name = String(p.name ?? '').trim()
      if (!name) {
        result.skipped.push({ name: '(no name)', reason: 'The product has no name.' })
        continue
      }
      if (next.products.some((x) => sameText(x.name, name))) {
        result.skipped.push({ name, reason: 'A product with this name already exists — it was left as it is.' })
        continue
      }
      let attempt = next
      const newMaterials: string[] = []

      // Stages in file order; processes under them.
      const stages: ProductStage[] = []
      for (const pr of p.processes ?? []) {
        const stageName = String(pr.stage || 'Production').trim()
        let stage = stages.find((s) => sameText(s.name, stageName))
        if (!stage) {
          stage = { id: ctx.newId('STG'), name: stageName, description: '', processes: [] }
          stages.push(stage)
        }
        stage.processes.push({
          id: ctx.newId('PRC'),
          name: String(pr.name || `Process ${stage.processes.length + 1}`).trim(),
          description: '',
          setupHours: zeroOrMore(pr.setupHours),
          runHoursPer1000: zeroOrMore(pr.runHoursPer1000),
          chargeId: null,
          costBasis: pr.costBasis ?? 'per_1000',
          rate: zeroOrMore(pr.rate),
          setupCharge: zeroOrMore(pr.setupCharge),
          requiresMachine: false,
        })
      }
      if (!stages.length)
        stages.push({
          id: ctx.newId('STG'),
          name: 'Production',
          description: 'Added because the file had no processes — replace with the real stages.',
          processes: [{ id: ctx.newId('PRC'), name: 'Production', description: '', setupHours: null, runHoursPer1000: null, chargeId: null, costBasis: 'per_1000', rate: null, setupCharge: null, requiresMachine: false }],
        })

      const lines: ProductMaterial[] = []
      let failed = ''
      for (const m of p.materials ?? []) {
        const mName = String(m.name ?? '').trim()
        if (!mName) continue
        let material = attempt.materials.find((x) => sameText(x.name, mName))
        if (!material) {
          const draft = {
            ...blankMaterialDraft(m.kind === 'sheet' ? 'sheet' : 'quantity'),
            name: mName,
            price: zeroOrMore(m.price),
            gsm: positive(m.gsm),
            sheetLengthMm: m.kind === 'sheet' ? positive(m.sheetLengthMm) : null,
            sheetWidthMm: m.kind === 'sheet' ? positive(m.sheetWidthMm) : null,
            wastagePct: m.wastagePct !== null && m.wastagePct >= 0 && m.wastagePct < 100 ? m.wastagePct : 0,
            notes: `Added from ${fileName}`,
          }
          if (m.uom?.trim() && m.kind !== 'sheet') draft.uom = m.uom.trim()
          const saved = saveMaterial(draft)(attempt, ctx)
          if (!saved.ok) {
            failed = `Material “${mName}”: ${Object.values(saved.fieldErrors ?? {})[0] ?? saved.error}`
            break
          }
          attempt = saved.db
          material = saved.value
          newMaterials.push(mName)
        }
        const allProcesses = stages.flatMap((s) => s.processes.map((pr) => ({ stageId: s.id, pr })))
        const at = m.process ? allProcesses.find((x) => sameText(x.pr.name, m.process)) : undefined
        lines.push({
          id: ctx.newId('BOM'),
          materialId: material.id,
          stageId: at?.stageId ?? null,
          processId: at?.pr.id ?? null,
          qtyPerPiece: material.kind === 'sheet' ? 0 : positive(m.qtyPerPiece),
          piecesPerProduct: material.kind === 'sheet' ? (positive(m.piecesPerProduct) !== null ? Math.max(1, Math.round(m.piecesPerProduct!)) : 1) : 1,
          cutLengthMm: material.kind === 'sheet' ? positive(m.cutLengthMm) : null,
          cutWidthMm: material.kind === 'sheet' ? positive(m.cutWidthMm) : null,
          rotationAllowed: true,
          upsOverride: null,
          upsOverrideReason: '',
          note: '',
        })
      }
      if (failed) {
        result.skipped.push({ name, reason: failed })
        continue
      }

      const tax = p.taxPct !== null && p.taxPct >= 0 && p.taxPct <= 100 ? p.taxPct : null
      const saved = saveProduct({
        code: '',
        name,
        category: String(p.category ?? '').trim(),
        description: [String(p.description ?? '').trim(), `Added from ${fileName}.`].filter(Boolean).join('\n'),
        hsn: String(p.hsn ?? '').trim(),
        uom: String(p.uom ?? '').trim() || 'pcs',
        taxPct: tax,
        stages,
        materials: lines,
      })(attempt, ctx)
      if (!saved.ok) {
        result.skipped.push({ name, reason: Object.values(saved.fieldErrors ?? {})[0] ?? saved.error })
        continue
      }
      next = saved.db
      result.created.push({ id: saved.value.id, code: saved.value.code, name })
      result.materialsCreated.push(...newMaterials)
    }

    if (!result.created.length) return fail(result.skipped.map((s) => `${s.name}: ${s.reason}`).join(' '))
    next = audit(next, ctx, {
      action: 'Products added from file',
      entity: 'Product',
      entityId: result.created.map((c) => c.id).join(','),
      entityLabel: fileName,
      field: 'Products',
      newValue: `${result.created.length} added${result.skipped.length ? `, ${result.skipped.length} skipped` : ''}${result.materialsCreated.length ? `, ${result.materialsCreated.length} new material(s)` : ''}`,
    })
    return ok(next, result)
  },
)
