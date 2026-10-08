// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { parseDelimited, readFileTable } from './fileTable'
import { buildXlsx } from './xlsx'
import { TEMPLATE_EXAMPLE, TEMPLATE_HEADERS } from './productSheet'
import { productSheetRows, readProductSheet, size, templateCsv } from './productSheet'
import { fillProductFromFile, importProductsFromFile } from '../domain/imports'
import { buildEmptyDB } from './defaults'
import { computeOrderCosting } from './costing'
import { defaultCostingInputs } from '../domain/orderCosting'
import { ADMIN, NOW, ctxFor, must } from '../test/fixtures'

describe('products from a file', () => {
  it('reads the Vertex product sheet completely', () => {
    const r = readProductSheet(parseDelimited(templateCsv()), 'sheet.csv')
    expect(r.products).toHaveLength(1)
    const p = r.products[0]
    expect(p).toMatchObject({ name: 'Sweet box 1 kg', category: 'Carton', hsn: '4819', uom: 'pcs', taxPct: 12 })
    expect(p.processes.map((x) => `${x.stage} › ${x.name}`)).toEqual(['Printing › Plate making', 'Printing › Offset print', 'Die cutting › Die cut', 'Pasting & packing › Pasting'])
    expect(p.processes[2]).toMatchObject({ costBasis: 'per_hour', rate: 320, setupHours: 0.5 })
    expect(p.materials[0]).toMatchObject({ name: 'Duplex board 350 GSM', kind: 'sheet', price: 11.5, sheetLengthMm: 1020, sheetWidthMm: 720, cutLengthMm: 420, cutWidthMm: 300, process: 'Offset print' })
    expect(p.materials[1]).toMatchObject({ name: 'PVA adhesive', kind: 'quantity', uom: 'kg', qtyPerPiece: 0.003 })
    expect(p.missing).toEqual([])
  })

  it('reads the downloadable Excel sheet back exactly', async () => {
    const bytes = buildXlsx([{ name: 'Products', widths: [], rows: [{ cells: TEMPLATE_HEADERS }, ...TEMPLATE_EXAMPLE.map((r) => ({ cells: r.map((c) => (c !== '' && /^-?\d+(\.\d+)?$/.test(c) ? Number(c) : c)) }))] }])
    const table = await readFileTable(new File([bytes as BlobPart], 'Vertex-product-sheet.xlsx'))
    expect(table.kind).toBe('excel')
    const r = readProductSheet(table.rows, 'Vertex-product-sheet.xlsx')
    expect(r.products[0].processes).toHaveLength(4)
    expect(r.products[0].materials.map((m) => m.price)).toEqual([11.5, 210])
    expect(r.products[0].missing).toEqual([])
  })

  it('reads a customer’s own layout, keeps what is there and lists what is missing', () => {
    const csv = [
      'Vertex Print Pack — price list',
      'S.No,Item Name,Operation,Board,Board Size,Rate (Rs),Remarks',
      '1,Medicine carton,Printing,Art board 300 GSM,"40 x 28 in",,urgent',
      '2,Medicine carton,Die cutting,,,1.2,',
      '3,Gift box,,,,,',
    ].join('\n')
    const r = readProductSheet(parseDelimited(csv), 'list.csv')
    expect(r.products.map((p) => p.name)).toEqual(['Medicine carton', 'Gift box'])
    const carton = r.products[0]
    expect(carton.processes.map((x) => x.name)).toEqual(['Printing', 'Die cutting'])
    expect(carton.materials[0]).toMatchObject({ name: 'Art board 300 GSM', kind: 'sheet', gsm: 300, price: null })
    expect(carton.missing.join(' ')).toMatch(/without a price/)
    expect(r.products[1].missing.join(' ')).toMatch(/No processes/)
    expect(size('40 x 28 in')).toEqual([1016, 711.2])
  })

  it('adds every product it can, with missing details left empty — costing then lists them, never refuses', () => {
    const r = readProductSheet(parseDelimited('Item Name,Operation,Board\nMedicine carton,Printing,Art board 300 GSM\nGift box,,\n'), 'list.csv')
    const done = must(importProductsFromFile(r.products, 'list.csv')(buildEmptyDB(NOW), ctxFor(ADMIN[0])))
    expect(done.value.created.map((c) => c.name)).toEqual(['Medicine carton', 'Gift box'])
    expect(done.value.materialsCreated).toEqual(['Art board 300 GSM'])
    const gift = done.db.products.find((p) => p.name === 'Gift box')!
    expect(gift.stages[0].processes[0].name).toBe('Production')

    const carton = done.db.products.find((p) => p.name === 'Medicine carton')!
    const costing = computeOrderCosting({
      quantity: 1000,
      product: { productId: carton.id, stages: carton.stages, materials: carton.materials },
      materials: done.db.materials,
      settings: done.db.settings,
      inputs: defaultCostingInputs(done.db, carton, () => 'x'),
    })
    const errors = costing.issues.filter((i) => i.level === 'error')
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.every((i) => i.gap)).toBe(true)

    // Adding the same file again changes nothing that exists.
    const again = must(importProductsFromFile(r.products, 'list.csv')(done.db, ctxFor(ADMIN[0])))
    expect(again.value).toMatchObject({ created: [], updated: [] })
    expect(again.db).toBe(done.db)
  })

  it('fills only the empty details of products already in Master — export, fill in Excel, add again', () => {
    // 1. Two products come in with gaps.
    const first = readProductSheet(
      parseDelimited(['Item Name,Operation,Rate,Board,Price', 'Medicine carton,Printing,450,Art board 300 GSM,', 'Medicine carton,Die cutting,,,', 'Gift box,,,,'].join('\n')),
      'list.csv',
    )
    const added = must(importProductsFromFile(first.products, 'list.csv')(buildEmptyDB(NOW), ctxFor(ADMIN[0])))
    const before = added.db.products.find((p) => p.name === 'Medicine carton')!

    // 2. Exported as the Vertex sheet: what is saved, blanks where missing.
    const rows = productSheetRows(added.db.products, added.db.materials).map((r) => r.map((c) => (c === null ? '' : String(c))))
    const printing = rows.find((r) => r[0] === 'Medicine carton' && r[7] === 'Printing')!
    expect(printing[11]).toBe('450')
    expect(printing[16]).toBe('')

    // 3. Blanks filled in Excel — and one saved value typed differently, which must NOT replace it.
    const COL = Object.fromEntries(TEMPLATE_HEADERS.map((h, i) => [h, i]))
    for (const r of rows) {
      if (r[0] === 'Medicine carton' && r[7] === 'Printing') Object.assign(r, { [COL['Process rate']]: '999', [COL['Material price']]: '14', [COL['Setup hours']]: '1', [COL['Run hours per 1000']]: '2', [COL['Setup charge']]: '0', [COL['Cut size (mm)']]: '180 x 120' })
      if (r[0] === 'Medicine carton' && r[7] === 'Die cutting') Object.assign(r, { [COL['Process rate']]: '320' })
      if (r[0] === 'Gift box') Object.assign(r, { [COL['HSN']]: '4819', [COL.Stage]: 'Printing', [COL.Process]: 'Offset print', [COL['Process rate']]: '500' })
    }
    const back = readProductSheet([TEMPLATE_HEADERS, ...rows], 'filled.xlsx')
    const done = must(importProductsFromFile(back.products, 'filled.xlsx')(added.db, ctxFor(ADMIN[0])))
    expect(done.value.created).toEqual([])
    expect(done.value.updated.map((u) => u.name).sort()).toEqual(['Gift box', 'Medicine carton'])
    expect(done.db.products).toHaveLength(2)

    const carton = done.db.products.find((p) => p.id === before.id)!
    expect(carton.name).toBe('Medicine carton')
    const [print, die] = carton.stages.flatMap((st) => st.processes)
    expect(print).toMatchObject({ rate: 450, setupHours: 1, runHoursPer1000: 2, setupCharge: 0 })
    expect(die.rate).toBe(320)
    expect(done.value.updated.find((u) => u.name === 'Medicine carton')!.kept).toBeGreaterThanOrEqual(1)
    expect(done.db.materials.find((m) => m.name === 'Art board 300 GSM')!.price).toBe(14)
    expect(carton.materials[0]).toMatchObject({ cutLengthMm: 180, cutWidthMm: 120 })

    // The stand-in "Production" step of the gift box gives way to the real process.
    const gift = done.db.products.find((p) => p.name === 'Gift box')!
    expect(gift.hsn).toBe('4819')
    expect(gift.stages.flatMap((st) => st.processes).map((x) => `${x.name} ${x.rate}`)).toEqual(['Offset print 500'])

    // Adding the same file again finds nothing left to fill.
    const again = must(importProductsFromFile(back.products, 'filled.xlsx')(done.db, ctxFor(ADMIN[0])))
    expect(again.value.updated).toEqual([])
    expect(again.value.unchanged.sort()).toEqual(['Gift box', 'Medicine carton'])
  })

  it('fills one product from a file without touching what it already has', () => {
    const r = readProductSheet(parseDelimited('Item Name,Operation\nTray,Printing\n'), 'a.csv')
    const added = must(importProductsFromFile(r.products, 'a.csv')(buildEmptyDB(NOW), ctxFor(ADMIN[0])))
    const tray = added.db.products[0]
    const sheet = readProductSheet(parseDelimited('Product,Process,Process rate,Setup hours\nSomething else,Printing,120,0.5\n'), 'b.csv').products[0]
    const filled = must(fillProductFromFile(tray.id, sheet, 'b.csv')(added.db, ctxFor(ADMIN[0])))
    expect(filled.value).toMatchObject({ filled: 2, added: 0 })
    const after = filled.db.products[0]
    expect(after.name).toBe('Tray')
    expect(after.stages[0].processes[0]).toMatchObject({ rate: 120, setupHours: 0.5 })
  })
})
