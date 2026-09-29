/* ---------------------------------------------------------------------------
 * Read a file the customer already has into rows of cells, on this computer
 * (no internet): CSV / TSV / text, Excel (.xlsx) and PDF with text (a PDF
 * saved from Excel, Word or Tally). A scanned or photographed PDF has no text
 * to read; that is reported, never guessed.
 * ------------------------------------------------------------------------- */

export interface FileTable {
  /** Every row of every sheet / page, top to bottom; cells trimmed. */
  rows: string[][]
  kind: 'csv' | 'excel' | 'pdf'
}

const ext = (name: string) => name.toLowerCase().split('.').pop() ?? ''

export async function readFileTable(file: File, isHeading: (text: string) => boolean = () => false): Promise<FileTable> {
  const e = ext(file.name)
  if (e === 'xlsx' || e === 'xlsm') return { rows: await readXlsx(new Uint8Array(await file.arrayBuffer())), kind: 'excel' }
  if (e === 'xls') throw new Error('This is an old Excel file (.xls). In Excel choose File → Save As → Excel Workbook (.xlsx), then add that file.')
  if (e === 'pdf') return { rows: await readPdf(new Uint8Array(await file.arrayBuffer()), isHeading), kind: 'pdf' }
  return { rows: parseDelimited(await file.text()), kind: 'csv' }
}

/* ---------------------------------- CSV ---------------------------------- */

export function parseDelimited(text: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const firstLine = src.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = [',', '\t', ';', '|'].map((d) => [d, firstLine.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0]
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"' && cell === '') quoted = true
    else if (c === delimiter) {
      row.push(cell.trim())
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cell.trim())
      rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  if (cell || row.length) {
    row.push(cell.trim())
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c))
}

/* --------------------------------- Excel --------------------------------- */

/** The files of a zip archive (stored or deflated), by name. */
async function unzip(data: Uint8Array): Promise<Map<string, Uint8Array>> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  let eocd = -1
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('This Excel file could not be opened (it is not a valid .xlsx file).')
  const count = view.getUint16(eocd + 10, true)
  let p = view.getUint32(eocd + 16, true)
  const out = new Map<string, Uint8Array>()
  const decoder = new TextDecoder()
  for (let n = 0; n < count; n++) {
    const method = view.getUint16(p + 10, true)
    const size = view.getUint32(p + 20, true)
    const nameLen = view.getUint16(p + 28, true)
    const extraLen = view.getUint16(p + 30, true)
    const commentLen = view.getUint16(p + 32, true)
    const local = view.getUint32(p + 42, true)
    const name = decoder.decode(data.subarray(p + 46, p + 46 + nameLen))
    p += 46 + nameLen + extraLen + commentLen
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true)
    const raw = data.subarray(start, start + size)
    if (method === 0) out.set(name, raw)
    else if (method === 8) out.set(name, new Uint8Array(await new Response(new Blob([raw as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()))
  }
  return out
}

const colIndex = (ref: string) => {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? 'A'
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

async function readXlsx(data: Uint8Array): Promise<string[][]> {
  const files = await unzip(data)
  const text = (name: string) => {
    const f = files.get(name)
    return f ? new TextDecoder().decode(f) : ''
  }
  const parser = new DOMParser()
  const shared = [...parser.parseFromString(text('xl/sharedStrings.xml') || '<sst/>', 'application/xml').getElementsByTagName('si')].map((si) =>
    [...si.getElementsByTagName('t')].map((t) => t.textContent ?? '').join(''),
  )
  const sheets = [...files.keys()].filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => Number(/\d+/.exec(a.slice(14))?.[0]) - Number(/\d+/.exec(b.slice(14))?.[0]))
  const rows: string[][] = []
  for (const sheet of sheets) {
    const doc = parser.parseFromString(text(sheet), 'application/xml')
    for (const r of doc.getElementsByTagName('row')) {
      const row: string[] = []
      for (const c of r.getElementsByTagName('c')) {
        const type = c.getAttribute('t')
        const v = c.getElementsByTagName('v')[0]?.textContent ?? ''
        const value = type === 's' ? (shared[Number(v)] ?? '') : type === 'inlineStr' ? [...c.getElementsByTagName('t')].map((t) => t.textContent ?? '').join('') : v
        row[colIndex(c.getAttribute('r') ?? '')] = value.trim()
      }
      const filled = Array.from(row, (x) => x ?? '')
      if (filled.some((x) => x)) rows.push(filled)
    }
  }
  return rows
}

/* ---------------------------------- PDF ---------------------------------- */

async function readPdf(data: Uint8Array, isHeading: (text: string) => boolean): Promise<string[][]> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
  const doc = await pdfjs.getDocument({ data }).promise
  const rows: string[][] = []
  let anchors: number[] | null = null
  for (let page = 1; page <= doc.numPages; page++) {
    const content = await (await doc.getPage(page)).getTextContent()
    const items = content.items
      .filter((i): i is typeof i & { str: string; transform: number[]; width: number } => 'str' in i && !!(i as { str: string }).str.trim())
      .map((i) => ({ text: i.str.trim(), x: i.transform[4], y: i.transform[5], w: i.width, h: Math.abs(i.transform[3]) || 10 }))
    // Words on one line share (almost) the same height on the page.
    items.sort((a, b) => b.y - a.y || a.x - b.x)
    const lines: (typeof items)[] = []
    for (const it of items) {
      const line = lines[lines.length - 1]
      if (line && Math.abs(line[0].y - it.y) <= it.h * 0.5) line.push(it)
      else lines.push([it])
    }
    // Words of one cell sit almost touching; anything further apart is another cell.
    const cellLines = lines.map((line) => {
      line.sort((a, b) => a.x - b.x)
      const cells: Array<{ text: string; x: number; end: number }> = []
      for (const it of line) {
        const last = cells[cells.length - 1]
        if (last && it.x - last.end < it.h * 0.35) {
          last.text += (it.x - last.end > it.h * 0.1 ? ' ' : '') + it.text
          last.end = it.x + it.w
        } else cells.push({ text: it.text, x: it.x, end: it.x + it.w })
      }
      return cells
    })
    // Columns come from the table's heading row, so an empty cell keeps the others in place.
    const headingScore = (cells: Array<{ text: string }>) => cells.filter((c) => isHeading(c.text)).length
    for (const cells of cellLines) {
      if (cells.length >= 3 && headingScore(cells) >= 2 && headingScore(cells) >= cells.length / 2) anchors = cells.map((c) => c.x)
      if (!anchors) {
        rows.push(cells.map((c) => c.text))
        continue
      }
      const cols = anchors
      const row: string[] = Array.from(cols, () => '')
      for (const c of cells) {
        let i = 0
        while (i + 1 < cols.length && c.x >= cols[i + 1] - 2) i++
        row[i] = row[i] ? `${row[i]} ${c.text}` : c.text
      }
      rows.push(row)
    }
  }
  if (!rows.length) throw new Error('No text was found in this PDF — it is probably a scanned image. Add an Excel or CSV file instead, or enter the product by hand.')
  return rows
}
