/* ---------------------------------------------------------------------------
 * Products from a file: rows of cells (see fileTable) → products with their
 * stages, processes and materials. Columns are recognised by their heading in
 * any order ("Product", "Item name", "Process", "Operation", "Board",
 * "Rate", …). Whatever a file does not give stays empty — the product is still
 * added, and the missing details are listed so they can be filled later.
 *
 * The Vertex product sheet (downloadable from Master) uses the headings in
 * TEMPLATE_HEADERS: one row per process or material, the product name on
 * each row (or only on its first row).
 * ------------------------------------------------------------------------- */

import type { CostBasis, MaterialKind } from './types'

export interface SheetProcess {
  stage: string
  name: string
  setupHours: number | null
  runHoursPer1000: number | null
  costBasis: CostBasis
  rate: number | null
  setupCharge: number | null
}

export interface SheetMaterial {
  name: string
  kind: MaterialKind
  uom: string
  price: number | null
  gsm: number | null
  sheetLengthMm: number | null
  sheetWidthMm: number | null
  cutLengthMm: number | null
  cutWidthMm: number | null
  piecesPerProduct: number | null
  qtyPerPiece: number | null
  wastagePct: number | null
  /** The process the material is used in (by name), if the file says. */
  process: string
}

export interface SheetProduct {
  name: string
  code: string
  category: string
  hsn: string
  uom: string
  taxPct: number | null
  description: string
  processes: SheetProcess[]
  materials: SheetMaterial[]
  /** Plain-language notes on what the file did not give. */
  missing: string[]
}

export interface SheetReading {
  products: SheetProduct[]
  /** Column headings that were understood → what they were read as. */
  understood: Array<{ heading: string; as: string }>
  /** Headings that were not used. */
  ignored: string[]
  /** Rows after the heading row that gave nothing usable. */
  skippedRows: number
}

type Field =
  | 'product' | 'code' | 'category' | 'hsn' | 'uom' | 'tax' | 'description'
  | 'stage' | 'process' | 'setupHours' | 'runHours' | 'basis' | 'rate' | 'setupCharge'
  | 'material' | 'materialType' | 'materialUom' | 'price' | 'gsm' | 'sheetLength' | 'sheetWidth' | 'sheetSize'
  | 'cutLength' | 'cutWidth' | 'cutSize' | 'pieces' | 'qtyPerPiece' | 'wastage'

const FIELD_LABEL: Record<Field, string> = {
  product: 'Product name', code: 'Product code', category: 'Category', hsn: 'HSN', uom: 'Unit', tax: 'Tax %', description: 'Description',
  stage: 'Stage', process: 'Process', setupHours: 'Setup hours', runHours: 'Run hours per 1000', basis: 'Rate basis', rate: 'Process rate', setupCharge: 'Setup charge',
  material: 'Material', materialType: 'Material type', materialUom: 'Material unit', price: 'Material price', gsm: 'GSM',
  sheetLength: 'Sheet length (mm)', sheetWidth: 'Sheet width (mm)', sheetSize: 'Sheet size',
  cutLength: 'Cut length (mm)', cutWidth: 'Cut width (mm)', cutSize: 'Cut size', pieces: 'Pieces per product', qtyPerPiece: 'Quantity per piece', wastage: 'Wastage %',
}

/** Heading words → field. Checked in order; the first match wins. */
const PATTERNS: Array<[RegExp, Field]> = [
  [/^(product|item)\s*(code|no|number|id)$|^(code|sku|part\s*no)$/, 'code'],
  [/hsn|sac/, 'hsn'],
  [/^(tax|gst|igst)\b|tax\s*%|gst\s*%/, 'tax'],
  [/categor|^type of product|product type/, 'category'],
  [/descr|remark|spec/, 'description'],
  [/setup\s*(hour|hrs|time)|make\s*ready/, 'setupHours'],
  [/run\s*(hour|hrs|time)|hours?\s*(per|\/)\s*1000|time\s*per\s*1000/, 'runHours'],
  [/setup\s*(charge|cost|amount)/, 'setupCharge'],
  [/(process|operation|job)\s*(rate|charge|cost)/, 'rate'],
  [/basis|rate\s*(type|per|unit)|charge\s*type/, 'basis'],
  [/^stage|stage\s*name/, 'stage'],
  [/process|operation|^work$|job\s*step/, 'process'],
  [/material\s*(type|kind)/, 'materialType'],
  [/material\s*(unit|uom)|^uom\s*\(material\)/, 'materialUom'],
  [/(material|paper|board)\s*(price|rate|cost)|price|cost\s*per|^amount$/, 'price'],
  [/gsm|grammage/, 'gsm'],
  [/sheet\s*(length|l\b)|sheet\s*height/, 'sheetLength'],
  [/sheet\s*(width|w\b)/, 'sheetWidth'],
  [/sheet\s*size|board\s*size|paper\s*size/, 'sheetSize'],
  [/cut\s*(length|l\b)|piece\s*length|blank\s*length/, 'cutLength'],
  [/cut\s*(width|w\b)|piece\s*width|blank\s*width/, 'cutWidth'],
  [/cut\s*size|blank\s*size|piece\s*size|die\s*size|open\s*size/, 'cutSize'],
  [/pieces?\s*per|ups\s*per\s*product|pcs\s*per\s*product|parts?\s*per/, 'pieces'],
  [/qty\s*per|quantity\s*per|consumption|usage/, 'qtyPerPiece'],
  [/wastage|waste/, 'wastage'],
  [/material|raw|paper|board|substrate/, 'material'],
  [/rate|charge/, 'rate'],
  [/^(unit|uom|units)$|unit of measure/, 'uom'],
  [/product|item|name|particular/, 'product'],
]

const clean = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()
const heading = (s: string) => clean(s).toLowerCase().replace(/[()[\]:*.]/g, ' ').replace(/\s+/g, ' ').trim()

/** Whether a cell reads like a column heading of a product table. */
export const isProductHeading = (h: string) => fieldOf(h) !== null

function fieldOf(h: string): Field | null {
  const t = heading(h)
  if (!t || t.length > 40) return null
  for (const [re, f] of PATTERNS) if (re.test(t)) return f
  return null
}

/** "₹ 1,250.50 /kg" → 1250.5; empty or text → null. */
export function num(s: string | undefined): number | null {
  const m = /-?\d[\d,]*(\.\d+)?|-?\.\d+/.exec(clean(s).replace(/(?<=\d),(?=\d{2}\b)/g, ','))
  if (!m) return null
  const n = Number(m[0].replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

/** "1000 x 700", "1000×700 mm", "40 x 28 in" → [length, width] in mm. */
export function size(s: string | undefined): [number, number] | null {
  const t = clean(s).toLowerCase()
  const m = /(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)/.exec(t)
  if (!m) return null
  const f = /\b(in|inch|inches|")\b|"/.test(t) ? 25.4 : /\bcm\b/.test(t) ? 10 : 1
  return [Math.round(Number(m[1]) * f * 10) / 10, Math.round(Number(m[2]) * f * 10) / 10]
}

function basisOf(s: string): CostBasis {
  const t = s.toLowerCase()
  if (/hour|hr/.test(t)) return 'per_hour'
  if (/fixed|lump|job|flat/.test(t)) return 'fixed'
  if (/piece|pc|each|unit/.test(t) && !/1000|thousand/.test(t)) return 'per_piece'
  return 'per_1000'
}

/** The row that names the most known columns is the heading row. */
function findHeader(rows: string[][]): { index: number; fields: Array<Field | null>; score: number } | null {
  let best: { index: number; fields: Array<Field | null>; score: number } | null = null
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const fields = rows[i].map(fieldOf)
    const distinct = new Set(fields.filter(Boolean)).size
    if (distinct >= 2 && (!best || distinct > best.score)) best = { index: i, fields, score: distinct }
  }
  return best
}

export function readProductSheet(rows: string[][], fileName: string): SheetReading {
  const fallbackName = clean(fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '))
  const header = findHeader(rows)
  const understood: SheetReading['understood'] = []
  const ignored: string[] = []

  // No recognisable headings: one product named after the file; each line with text becomes a note.
  if (!header) {
    const text = rows.map((r) => r.filter(Boolean).join(' · ')).filter(Boolean)
    return {
      products: [finish({ ...emptyProduct(fallbackName), description: text.slice(0, 40).join('\n') })],
      understood,
      ignored,
      skippedRows: rows.length,
    }
  }

  // First column for each field wins; later duplicates are ignored.
  const col = new Map<Field, number>()
  header.fields.forEach((f, i) => {
    const h = clean(rows[header.index][i])
    if (f && !col.has(f)) {
      col.set(f, i)
      understood.push({ heading: h, as: FIELD_LABEL[f] })
    } else if (h) ignored.push(h)
  })
  const get = (row: string[], f: Field) => (col.has(f) ? clean(row[col.get(f)!]) : '')

  const products: SheetProduct[] = []
  let current: SheetProduct | null = null
  let lastStage = ''
  let skippedRows = 0

  for (const row of rows.slice(header.index + 1)) {
    if (!row.some((c) => clean(c))) continue
    // A repeated heading row (e.g. on each PDF page) is skipped.
    if (new Set(row.map(fieldOf).filter(Boolean)).size >= Math.max(3, Math.ceil(header.score * 0.6))) {
      skippedRows++
      continue
    }
    const name = get(row, 'product')
    if (name && (!current || name.toLowerCase() !== current.name.toLowerCase())) {
      current = products.find((p) => p.name.toLowerCase() === name.toLowerCase()) ?? null
      if (!current) {
        current = emptyProduct(name)
        products.push(current)
      }
      lastStage = ''
    }
    if (!current) {
      current = emptyProduct(fallbackName)
      products.push(current)
    }
    const p = current
    p.code ||= get(row, 'code')
    p.category ||= get(row, 'category')
    p.hsn ||= get(row, 'hsn')
    p.uom ||= get(row, 'uom')
    p.description ||= get(row, 'description')
    if (p.taxPct === null) p.taxPct = num(get(row, 'tax'))

    let used = false
    const stage = get(row, 'stage') || lastStage
    if (stage) lastStage = stage
    const processName = get(row, 'process')
    if (processName) {
      p.processes.push({
        stage: stage || 'Production',
        name: processName,
        setupHours: num(get(row, 'setupHours')),
        runHoursPer1000: num(get(row, 'runHours')),
        costBasis: basisOf(get(row, 'basis')),
        rate: num(get(row, 'rate')),
        setupCharge: num(get(row, 'setupCharge')),
      })
      used = true
    }
    const materialName = get(row, 'material')
    if (materialName) {
      const sheet = size(get(row, 'sheetSize'))
      const cut = size(get(row, 'cutSize'))
      const sheetLengthMm = num(get(row, 'sheetLength')) ?? sheet?.[0] ?? null
      const sheetWidthMm = num(get(row, 'sheetWidth')) ?? sheet?.[1] ?? null
      const cutLengthMm = num(get(row, 'cutLength')) ?? cut?.[0] ?? null
      const cutWidthMm = num(get(row, 'cutWidth')) ?? cut?.[1] ?? null
      const typed = get(row, 'materialType').toLowerCase()
      const kind: MaterialKind = /sheet|board|paper/.test(typed) || (!typed && (sheetLengthMm !== null || cutLengthMm !== null || /board|paper|gsm|sheet/i.test(materialName))) ? 'sheet' : 'quantity'
      p.materials.push({
        name: materialName,
        kind,
        uom: get(row, 'materialUom') || (kind === 'sheet' ? 'sheet' : 'nos'),
        price: num(get(row, 'price')),
        gsm: num(get(row, 'gsm')) ?? num(/(\d{2,4})\s*gsm/i.exec(materialName)?.[1]),
        sheetLengthMm,
        sheetWidthMm,
        cutLengthMm,
        cutWidthMm,
        piecesPerProduct: num(get(row, 'pieces')),
        qtyPerPiece: num(get(row, 'qtyPerPiece')),
        wastagePct: num(get(row, 'wastage')),
        process: processName,
      })
      used = true
    }
    if (!used && !name) skippedRows++
  }

  return { products: products.map(finish), understood, ignored, skippedRows }
}

function emptyProduct(name: string): SheetProduct {
  return { name, code: '', category: '', hsn: '', uom: '', taxPct: null, description: '', processes: [], materials: [], missing: [] }
}

/** List, in plain words, what is still to be filled in. */
function finish(p: SheetProduct): SheetProduct {
  const missing: string[] = []
  if (!p.uom) missing.push('Unit not given — “pcs” is used.')
  if (!p.processes.length) missing.push('No processes in the file — one “Production” step is added; add the real stages and processes in Master → Products.')
  const noTime = p.processes.filter((x) => x.setupHours === null || x.runHoursPer1000 === null).length
  if (noTime) missing.push(`${noTime} process(es) without setup / run time.`)
  const noRate = p.processes.filter((x) => x.rate === null).length
  if (noRate) missing.push(`${noRate} process(es) without a rate.`)
  if (!p.materials.length) missing.push('No materials in the file — only process costs will be counted.')
  const noPrice = p.materials.filter((m) => m.price === null).length
  if (noPrice) missing.push(`${noPrice} material(s) without a price.`)
  const noCut = p.materials.filter((m) => m.kind === 'sheet' && (m.cutLengthMm === null || m.cutWidthMm === null)).length
  if (noCut) missing.push(`${noCut} board / paper material(s) without a cut size.`)
  const noSheet = p.materials.filter((m) => m.kind === 'sheet' && (m.sheetLengthMm === null || m.sheetWidthMm === null)).length
  if (noSheet) missing.push(`${noSheet} board / paper material(s) without a sheet size.`)
  const noQty = p.materials.filter((m) => m.kind === 'quantity' && m.qtyPerPiece === null).length
  if (noQty) missing.push(`${noQty} material(s) without quantity per piece.`)
  return { ...p, missing }
}

/* ------------------------- the Vertex product sheet ----------------------- */

export const TEMPLATE_HEADERS = [
  'Product', 'Product code', 'Category', 'HSN', 'Unit', 'Tax %',
  'Stage', 'Process', 'Setup hours', 'Run hours per 1000', 'Rate basis', 'Process rate', 'Setup charge',
  'Material', 'Material type', 'Material unit', 'Material price', 'GSM', 'Sheet size (mm)', 'Cut size (mm)', 'Pieces per product', 'Qty per piece', 'Wastage %',
]

export const TEMPLATE_EXAMPLE: string[][] = [
  ['Sweet box 1 kg', '', 'Carton', '4819', 'pcs', '12', 'Printing', 'Plate making', '0', '0', 'fixed', '900', '0', '', '', '', '', '', '', '', '', '', ''],
  ['Sweet box 1 kg', '', '', '', '', '', 'Printing', 'Offset print', '1', '2', 'per 1000', '450', '300', 'Duplex board 350 GSM', 'sheet', 'sheet', '11.50', '350', '1020 x 720', '420 x 300', '1', '', '5'],
  ['Sweet box 1 kg', '', '', '', '', '', 'Die cutting', 'Die cut', '0.5', '2', 'per hour', '320', '0', '', '', '', '', '', '', '', '', '', ''],
  ['Sweet box 1 kg', '', '', '', '', '', 'Pasting & packing', 'Pasting', '1', '2', 'per 1000', '180', '0', 'PVA adhesive', 'quantity', 'kg', '210', '', '', '', '', '0.003', '10'],
]

export function templateCsv(): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  return [TEMPLATE_HEADERS, ...TEMPLATE_EXAMPLE].map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n'
}
