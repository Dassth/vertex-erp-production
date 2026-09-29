// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { parseDelimited, readFileTable } from './fileTable'
import { buildXlsx } from './xlsx'
import { TEMPLATE_EXAMPLE, TEMPLATE_HEADERS } from './productSheet'
import { readProductSheet, size, templateCsv } from './productSheet'
import { importProductsFromFile } from '../domain/imports'
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
    const again = importProductsFromFile(r.products, 'list.csv')(done.db, ctxFor(ADMIN[0]))
    expect(again.ok).toBe(false)
  })
})
