/* ---------------------------------------------------------------------------
 * One tabular shape for every downloadable report, so the Excel file, the CSV
 * file and the PDF of a report always contain exactly the same rows.
 * ------------------------------------------------------------------------- */

import { buildXlsx } from './xlsx'
import { POWERED_BY } from './brand'

export type CellValue = string | number | null

export interface ReportColumn {
  label: string
  /** Width in characters (Excel) — the PDF scales these proportionally. */
  width: number
  numeric?: boolean
  /** Long text (names, items) — takes the spare width in the PDF and wraps. Other columns fit their content. */
  wrap?: boolean
}

export interface ReportRow {
  /** section = group heading, total = subtotal line, grand = final total. */
  kind: 'section' | 'row' | 'total' | 'grand'
  cells: CellValue[]
}

export interface ReportTable {
  /** Sheet name and file-name stem. */
  name: string
  /** An in-house document: it may carry the maker's mark if the company wants it. */
  internal?: boolean
  /** Set when the file should actually close with the mark. */
  watermark?: boolean
  /** Title lines printed above the table. */
  heading: string[]
  columns: ReportColumn[]
  rows: ReportRow[]
}

export type ExportFormat = 'xlsx' | 'csv'

const csvCell = (v: CellValue) => {
  const s = v === null ? '' : typeof v === 'number' ? v.toFixed(2) : v
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function tableCsv(t: ReportTable): string {
  const lines = [
    ...t.heading.map((h) => csvCell(h)),
    t.columns.map((c) => csvCell(c.label)).join(','),
    ...t.rows.map((r) => r.cells.map(csvCell).join(',')),
    ...(t.watermark ? ['', csvCell(POWERED_BY)] : []),
  ]
  return lines.join('\r\n')
}

export function tableXlsx(t: ReportTable): Uint8Array {
  return buildXlsx([
    {
      name: t.name,
      widths: t.columns.map((c) => c.width),
      rows: [
        ...t.heading.map((h, i) => ({ cells: [h], bold: i === 0 })),
        { cells: [] },
        { cells: t.columns.map((c) => c.label), bold: true },
        ...t.rows.map((r) => ({ cells: r.cells, bold: r.kind !== 'row' })),
        ...(t.watermark ? [{ cells: [] }, { cells: [POWERED_BY] }] : []),
      ],
    },
  ])
}

/** The report as a downloadable file in the chosen format. */
export function tableFile(t: ReportTable, format: ExportFormat, stem: string): { blob: Blob; fileName: string } {
  if (format === 'csv')
    // BOM so Excel reads ₹ and Tamil names correctly.
    return { blob: new Blob(['﻿', tableCsv(t)], { type: 'text/csv;charset=utf-8' }), fileName: `${stem}.csv` }
  const bytes = tableXlsx(t)
  return {
    blob: new Blob([bytes.buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    fileName: `${stem}.xlsx`,
  }
}
