import { describe, expect, it } from 'vitest'
import { ADMIN, NOW, ctxFor, must, seedMaster, BILLING_ONLY } from '../test/fixtures'
import type { Product, ProductMaterial, VertexDB } from '../lib/types'
import { saveProduct } from './master'
import type { ProductDraft } from './master'
import { importProductTemplates, planTemplateImport } from './imports'
import { JEWELLERY_BATCH_ID } from '../lib/templates/jewelleryBoxes'
import { computeOrderCosting } from '../lib/costing'
import { NO_PRICING_INPUTS } from '../features/master/masterSelectors'
import { draftKey, readDraft, removeDraft, writeDraft } from '../lib/drafts'
import type { StorageLike } from '../lib/db'
import { normalizeDB } from '../lib/db'

const admin = (n = 0) => ctxFor(ADMIN[n])

const toDraft = (p: Product): ProductDraft => ({
  id: p.id,
  code: p.code,
  name: p.name,
  category: p.category,
  description: p.description,
  hsn: p.hsn,
  uom: p.uom,
  taxPct: p.taxPct,
  stages: structuredClone(p.stages),
  materials: structuredClone(p.materials),
  spec: p.spec ?? null,
  expectedUpdatedAt: p.updatedAt,
})

const issuesFor = (db: VertexDB, p: Product) =>
  computeOrderCosting({ quantity: 1000, product: { productId: p.id, stages: p.stages, materials: p.materials, spec: p.spec }, materials: db.materials, settings: db.settings, inputs: NO_PRICING_INPUTS }).issues.filter(
    (i) => i.level === 'error',
  )

describe('incomplete product drafts can be saved', () => {
  const sheetLine = (p: Product) => p.materials.find((l) => l.id === 'bom-sheet')!

  function saveWithSheet(patch: Partial<ProductMaterial>) {
    const seeded = seedMaster()
    const product = seeded.db.products[0]
    const draft = toDraft(product)
    draft.materials = draft.materials.map((l) => (l.id === 'bom-sheet' ? { ...l, ...patch } : l))
    return { seeded, r: saveProduct(draft)(seeded.db, admin()) }
  }

  it('keeps an ups override of 22 with a blank reason, unchanged, and reports it for costing', () => {
    const { r } = saveWithSheet({ upsOverride: 22, upsOverrideReason: '' })
    const saved = must(r)
    expect(sheetLine(saved.value)).toMatchObject({ upsOverride: 22, upsOverrideReason: '' })
    expect(issuesFor(saved.db, saved.value).map((i) => i.message).join(' ')).toMatch(/Record why/)
  })

  it('keeps a cut piece that does not fit the sheet, and missing cut dimensions, exactly as entered', () => {
    const tooBig = must(saveWithSheet({ cutLengthMm: 5000, cutWidthMm: 150 }).r)
    expect(sheetLine(tooBig.value)).toMatchObject({ cutLengthMm: 5000, cutWidthMm: 150 })
    expect(issuesFor(tooBig.db, tooBig.value).length).toBeGreaterThan(0)

    const missing = must(saveWithSheet({ cutLengthMm: null, cutWidthMm: null, piecesPerProduct: null }).r)
    expect(sheetLine(missing.value)).toMatchObject({ cutLengthMm: null, cutWidthMm: null, piecesPerProduct: null })
    expect(issuesFor(missing.db, missing.value).map((i) => i.message).join(' ')).toMatch(/Cut-piece size missing/)
  })

  it('keeps missing prices, rates, setup charges and times as blanks — never zero', () => {
    const seeded = seedMaster(undefined, { sheetPrice: null })
    const draft = toDraft(seeded.db.products[0])
    draft.stages[0].processes[1] = { ...draft.stages[0].processes[1], rate: null, setupCharge: null, setupHours: null, runHoursPer1000: null }
    const saved = must(saveProduct(draft)(seeded.db, admin()))
    expect(saved.value.stages[0].processes[1]).toMatchObject({ rate: null, setupCharge: null, setupHours: null, runHoursPer1000: null })
    const messages = issuesFor(saved.db, saved.value).map((i) => i.message).join(' ')
    expect(messages).toMatch(/Price missing/)
    expect(messages).toMatch(/process rate missing/)
    expect(messages).toMatch(/setup time not entered/)
  })

  it('still refuses values the product cannot hold, and correcting them restores normal costing', () => {
    const bad = saveWithSheet({ piecesPerProduct: 1.5, cutLengthMm: -3 }).r
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(Object.keys(bad.fieldErrors ?? {})).toEqual(expect.arrayContaining(['material.bom-sheet.piecesPerProduct', 'material.bom-sheet.cutLengthMm']))

    // A draft with an unexplained override, then the reason is supplied: costing becomes ready.
    const draftSaved = must(saveWithSheet({ upsOverride: 22, upsOverrideReason: '' }).r)
    const fixed = toDraft(draftSaved.value)
    fixed.materials = fixed.materials.map((l) => (l.id === 'bom-sheet' ? { ...l, upsOverride: null } : l))
    const ready = must(saveProduct(fixed)(draftSaved.db, admin()))
    expect(issuesFor(ready.db, ready.value)).toEqual([])
  })

  it('saving the same draft twice updates one product instead of creating two', () => {
    const seeded = seedMaster()
    const draft: ProductDraft = { ...toDraft(seeded.db.products[0]), id: undefined, code: '', name: 'Second box', expectedUpdatedAt: undefined }
    const first = must(saveProduct(draft)(seeded.db, admin()))
    const again = saveProduct(draft)(first.db, admin())
    // A second "create" is refused by the unique name rule…
    expect(again.ok).toBe(false)
    // …and the editor saves as an update once the record exists.
    const update = must(saveProduct(toDraft(first.value))(first.db, admin()))
    expect(update.db.products.filter((p) => p.name === 'Second box')).toHaveLength(1)
  })
})

describe('recoverable form drafts', () => {
  const memory = (): StorageLike & { map: Map<string, string> } => {
    const map = new Map<string, string>()
    return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) }
  }

  it('keeps raw values, including half-typed numbers, and is scoped per user and draft', () => {
    const s = memory()
    const a = draftKey('USR-ADM1', 'product', 'new:one')
    const b = draftKey('USR-ADM1', 'product', 'new:two')
    expect(a).not.toBe(b)
    expect(draftKey('USR-ADM2', 'product', 'new:one')).not.toBe(a)
    const data = { name: 'Box', upsOverride: 22, upsOverrideReason: '', cut: NaN, blank: null }
    expect(writeDraft(s, a, data, { userId: 'USR-ADM1', tabId: 't1', knownRev: 0, baseUpdatedAt: null }).ok).toBe(true)
    const back = readDraft<typeof data>(s, a)!
    expect(back.data.name).toBe('Box')
    expect(back.data.upsOverride).toBe(22)
    expect(Number.isNaN(back.data.cut)).toBe(true)
    expect(back.data.blank).toBeNull()
    expect(readDraft(s, b)).toBeNull()
  })

  it('does not let an older tab overwrite a newer draft from another tab', () => {
    const s = memory()
    const k = draftKey('USR-ADM1', 'product', 'PRD-1')
    const t1 = writeDraft(s, k, { v: 1 }, { userId: 'USR-ADM1', tabId: 'tab-1', knownRev: 0, baseUpdatedAt: null })
    expect(t1.ok && t1.rev).toBe(1)
    const t2 = writeDraft(s, k, { v: 2 }, { userId: 'USR-ADM1', tabId: 'tab-2', knownRev: 1, baseUpdatedAt: null })
    expect(t2.ok && t2.rev).toBe(2)
    // Tab 1 has only seen revision 1.
    const stale = writeDraft(s, k, { v: 'old' }, { userId: 'USR-ADM1', tabId: 'tab-1', knownRev: 1, baseUpdatedAt: null })
    expect(stale.ok).toBe(false)
    if (!stale.ok) expect(stale.reason).toBe('newer')
    expect(readDraft<{ v: number }>(s, k)!.data.v).toBe(2)
  })

  it('reports a storage failure instead of pretending the draft was kept', () => {
    const failing: StorageLike = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError') }, removeItem: () => {} }
    const r = writeDraft(failing, 'k', { v: 1 }, { userId: 'u', tabId: 't', knownRev: 0, baseUpdatedAt: null })
    expect(r.ok).toBe(false)
    if (!r.ok && r.reason === 'storage') expect(r.error).toMatch(/Quota/)
  })

  it('is removed only when asked', () => {
    const s = memory()
    const k = draftKey('u', 'product', 'x')
    writeDraft(s, k, { v: 1 }, { userId: 'u', tabId: 't', knownRev: 0, baseUpdatedAt: null })
    expect(readDraft(s, k)).not.toBeNull()
    removeDraft(s, k)
    expect(readDraft(s, k)).toBeNull()
  })
})

describe('jewellery template import', () => {
  const run = (db: VertexDB) => must(importProductTemplates(JEWELLERY_BATCH_ID)(db, admin()))

  it('creates the ten source variants once, with their original sizes, quantity 25 and unknowns left blank', () => {
    const seeded = seedMaster()
    const r = run(seeded.db)
    expect(r.value.created).toHaveLength(10)
    const imported = r.db.products.filter((p) => p.spec?.importKey?.startsWith(JEWELLERY_BATCH_ID))
    expect(imported.map((p) => p.name)).toEqual([
      'Bracelet — 2*8.5',
      'Mini Chain — 3*10',
      'Chain Box — 12*4',
      'Big Chain — 15*4',
      'Necklace Box — 7*6',
      'Necklace Box — 8*7',
      'Haram Box — 13*6',
      'Haram Box — 15*6',
      'Jimmikke Box — 3*4',
      'Bangle Roller — 6*4',
    ])
    for (const p of imported) {
      expect(p.category).toBe('Jewellery box')
      expect(p.spec).toMatchObject({ status: 'proposed', requestedQty: 25, sizeUnit: null, dimensionBasis: null, lengthMm: null, widthMm: null, heightMm: null })
      expect(p.spec!.rawSize).toBe(p.name.split(' — ')[1])
      expect(p.taxPct).toBeNull()
      expect(p.hsn).toBe('')
      expect(p.stages).toHaveLength(7)
      for (const pr of p.stages.flatMap((s) => s.processes)) expect(pr).toMatchObject({ setupHours: null, runHoursPer1000: null, rate: null, setupCharge: null })
      for (const l of p.materials) expect(l).toMatchObject({ qtyPerPiece: null, piecesPerProduct: null, cutLengthMm: null, cutWidthMm: null, upsOverride: null })
      // Every usage points at a stage and process of its own product.
      for (const l of p.materials) {
        const stage = p.stages.find((s) => s.id === l.stageId)
        expect(stage).toBeTruthy()
        if (l.processId) expect(stage!.processes.some((x) => x.id === l.processId)).toBe(true)
      }
    }
    expect(imported.find((p) => p.spec!.sourceName === 'Jimmikke Box')!.spec!.aliases).toContain('Jimikki box')
    // Product-specific insert differences are kept.
    const insert = (name: string) => imported.find((p) => p.name.startsWith(name))!
    expect(insert('Bangle Roller').spec!.insertApproach).toMatch(/roller/i)
    expect(insert('Bangle Roller').materials.some((l) => r.db.materials.find((m) => m.id === l.materialId)!.name.startsWith('Insert support board'))).toBe(false)
    expect(insert('Jimmikke Box').materials.some((l) => r.db.materials.find((m) => m.id === l.materialId)!.name.startsWith('Cushioning'))).toBe(false)
    // Candidate materials: no invented sizes or prices; the optional steel counterpart is not charged.
    const candidates = r.db.materials.filter((m) => m.approval === 'candidate')
    expect(candidates).toHaveLength(13)
    for (const m of candidates) expect(m).toMatchObject({ price: null, sheetLengthMm: null, sheetWidthMm: null, gsm: null, thicknessMm: null })
    const steel = candidates.find((m) => m.name.startsWith('Steel counterpart'))!
    expect(imported.some((p) => p.materials.some((l) => l.materialId === steel.id))).toBe(false)
  })

  it('a proposed specification blocks final costing, with the unresolved items named', () => {
    const r = run(seedMaster().db)
    const p = r.db.products.find((x) => x.name === 'Bracelet — 2*8.5')!
    const messages = issuesFor(r.db, p).map((i) => i.message)
    expect(messages.some((m) => /Specification is a proposal awaiting customer confirmation \(size 2\*8\.5, unit unknown\)/.test(m))).toBe(true)
    expect(messages.some((m) => /process rate missing/.test(m))).toBe(true)
  })

  it('a repeated import creates nothing and never overwrites later edits', () => {
    const first = run(seedMaster().db)
    const bracelet = first.db.products.find((x) => x.name === 'Bracelet — 2*8.5')!
    const edited = must(saveProduct({ ...toDraft(bracelet), description: 'Edited by Admin 1', spec: { ...bracelet.spec!, notes: 'Customer confirmed velvet colour' } })(first.db, admin()))
    const again = run(normalizeDB(JSON.parse(JSON.stringify(edited.db))))
    expect(again.value.created).toHaveLength(0)
    expect(again.value.skipped).toHaveLength(10)
    expect(again.value.materialsCreated).toBe(0)
    const after = again.db.products.find((x) => x.id === bracelet.id)!
    expect(after.description).toBe('Edited by Admin 1')
    expect(after.spec!.notes).toBe('Customer confirmed velvet colour')
    expect(again.db.products).toHaveLength(edited.db.products.length)
    expect(again.db.materials).toHaveLength(edited.db.materials.length)
  })

  it('does not duplicate an existing product that already represents a row', () => {
    const seeded = seedMaster()
    const existing = must(
      saveProduct({ code: '', name: 'Jimikki box', category: 'Jewellery box', description: '', hsn: '', uom: 'pcs', taxPct: null, stages: seeded.db.products[0].stages, materials: [] })(seeded.db, admin()),
    )
    const plan = planTemplateImport(existing.db, JEWELLERY_BATCH_ID)!
    const row = plan.rows.find((x) => x.key === 'row-09')!
    expect(row.kind).toBe('matches-existing')
    const r = run(existing.db)
    expect(r.value.created).toHaveLength(9)
    expect(r.db.products.filter((p) => /jim/i.test(p.name))).toHaveLength(1)
    // The existing record is untouched.
    expect(r.db.products.find((p) => p.id === existing.value.id)).toEqual(existing.value)
  })

  it('only Administrator 1 can import', () => {
    const db = seedMaster().db
    for (const ctx of [admin(1), ctxFor(BILLING_ONLY)]) expect(importProductTemplates(JEWELLERY_BATCH_ID)(db, ctx).ok).toBe(false)
  })

  it('imported products stay editable and every nested reference survives a save and reload', () => {
    const r = run(seedMaster().db)
    const haram = r.db.products.find((x) => x.name === 'Haram Box — 15*6')!
    const saved = must(saveProduct(toDraft(haram))(r.db, admin()))
    const reloaded = normalizeDB(JSON.parse(JSON.stringify(saved.db)))
    const back = reloaded.products.find((x) => x.id === haram.id)!
    expect(back.stages).toEqual(haram.stages)
    expect(back.materials).toEqual(haram.materials)
    expect(back.spec).toEqual(haram.spec)
    expect(back.version).toBe(2)
    void NOW
  })
})
