import { describe, expect, it } from 'vitest'
import AdmZip from 'adm-zip'
import { writeFileSync } from 'node:fs'
import { tableCsv, tableXlsx } from './reportTable'
import { invoiceRegister, invoiceRegisterTable } from './invoiceRegister'
import { gstReportTable, monthlyGstReport } from './gstReport'
import { sampleDb } from '../test/gstFixtures'

describe('invoice report', () => {
  it('lists each bill with its items and closes it with a total row', () => {
    const r = invoiceRegister(sampleDb(), '2026-08', 'purchases')
    expect(r.docs.map((d) => d.number)).toEqual(['1679', '77', '140'])
    const t = invoiceRegisterTable(r, 'Vertex Print Pack')
    expect(t.rows.filter((x) => x.kind === 'row')).toHaveLength(3)
    const grand = t.rows[t.rows.length - 1].cells
    expect(grand.slice(11)).toEqual([105018, 4220.62, 4220.62, 3312, r.total])
  })
})

describe('xlsx export', () => {
  it('writes a valid workbook with the same rows as the CSV', () => {
    const db = sampleDb()
    const table = gstReportTable(monthlyGstReport(db, '2026-08'), 'Vertex Print Pack', 'purchases')
    const bytes = tableXlsx(table)
    const zip = new AdmZip(Buffer.from(bytes))
    const names = zip.getEntries().map((e) => e.entryName)
    expect(names).toEqual(expect.arrayContaining(['[Content_Types].xml', 'xl/workbook.xml', 'xl/styles.xml', 'xl/worksheets/sheet1.xml']))
    const sheet = zip.readAsText('xl/worksheets/sheet1.xml')
    expect(sheet).toContain('Arunachalam Trading')
    expect(sheet).toContain('<v>55000</v>')
    expect(tableCsv(table)).toContain('Arunachalam Trading')
    if (process.env.XLSX_OUT) writeFileSync(process.env.XLSX_OUT, bytes)
  })
})
