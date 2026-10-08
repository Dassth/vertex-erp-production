import { buildXlsx } from './xlsx'
import type { XlsxCell } from './xlsx'
import { TEMPLATE_HEADERS } from './productSheet'

/** Save rows of the Vertex product sheet as an Excel file (headings first). */
export function downloadProductSheet(fileName: string, rows: XlsxCell[][]) {
  const bytes = buildXlsx([
    {
      name: 'Products',
      widths: TEMPLATE_HEADERS.map((h, i) => (i === 0 || i === 13 ? 28 : Math.max(12, h.length + 2))),
      rows: [{ cells: TEMPLATE_HEADERS, bold: true }, ...rows.map((cells) => ({ cells }))],
    },
  ])
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 5000)
}
