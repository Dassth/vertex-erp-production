import { describe, expect, it } from 'vitest'
import { POWERED_BY } from './brand'
import { gstReportTable, monthlyGstReport } from './gstReport'
import { tableCsv, tableXlsx } from './reportTable'
import { sampleDb } from '../test/gstFixtures'
import AdmZip from 'adm-zip'

describe('maker’s mark', () => {
  const table = gstReportTable(monthlyGstReport(sampleDb(), '2026-08'), 'Vertex Print Pack', 'purchases')

  it('closes every CSV', () => {
    expect(tableCsv(table).trimEnd().endsWith(POWERED_BY)).toBe(true)
  })

  it('closes every spreadsheet', () => {
    const sheet = new AdmZip(Buffer.from(tableXlsx(table))).readAsText('xl/worksheets/sheet1.xml')
    expect(sheet).toContain(POWERED_BY)
  })
})
