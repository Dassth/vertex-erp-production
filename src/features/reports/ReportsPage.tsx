import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, Eye, FileBarChart, FileSpreadsheet, Pencil, ReceiptText, ShoppingCart } from 'lucide-react'
import { useStore } from '../../store/store'
import type { Invoice, PurchaseBill } from '../../lib/types'
import { fmtDate, moneyPaise } from '../../lib/format'
import { defaultReportMonth, gstReportCsv, monthlyGstReport } from '../../lib/gstReport'
import type { GstRegister, ReportKind } from '../../lib/gstReport'
import { fromPaise, toPaise } from '../../lib/costing'
import { Button, Card, CardHead, EmptyState, Field, Input, Segmented } from '../../components/ui'
import { PageHeader, StatStrip, StatTile, useDocumentTitle } from '../../components/page'
import { DocumentPreview, DownloadButton, gstReportDoc, useLatestDb } from '../../components/DocumentPreview'
import type { PreviewDoc } from '../../components/DocumentPreview'
import { HsnDatalist, PurchaseEditor } from '../billing/PurchaseBills'
import { InvoiceEditDialog } from '../billing/InvoiceEditDialog'

const KIND_LABEL: Record<ReportKind, string> = { sales: 'Invoice report', purchases: 'Bill report' }

/**
 * Monthly GST reports (Annexure-I). Nothing is stored here: every row is read
 * from the saved sales invoices and purchase bills, and "Edit" opens that very
 * invoice or bill — so an edit here, in Billing or anywhere else is the same edit.
 */
export function ReportsPage() {
  useDocumentTitle('Reports')
  const { db, pushToast } = useStore()
  const read = useLatestDb()
  const [params, setParams] = useSearchParams()
  const kind: ReportKind = params.get('type') === 'purchases' ? 'purchases' : 'sales'
  const month = /^\d{4}-\d{2}$/.test(params.get('month') ?? '') ? params.get('month')! : defaultReportMonth()
  const [preview, setPreview] = useState<PreviewDoc | null>(null)
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null)
  const [editBill, setEditBill] = useState<PurchaseBill | null>(null)

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) next.set(k, v)
    setParams(next, { replace: true })
  }

  const report = useMemo(() => monthlyGstReport(db, month), [db, month])
  const reg = report[kind]
  const rows = reg.sections.reduce((s, x) => s + x.rows.length, 0)
  const tax = (r: GstRegister) => fromPaise(toPaise(r.cgst) + toPaise(r.sgst) + toPaise(r.igst) + toPaise(r.gst))

  const openRow = (sourceId: string) => {
    if (kind === 'sales') {
      const inv = db.invoices.find((i) => i.id === sourceId)
      if (inv) setEditInvoice(inv)
    } else {
      const bill = (db.purchases ?? []).find((b) => b.id === sourceId)
      if (bill) setEditBill(bill)
    }
  }

  const downloadCsv = async () => {
    try {
      const csv = gstReportCsv(monthlyGstReport(read(), month), db.company.name, kind)
      const { saveBlob } = await import('../../lib/pdfRender')
      // BOM so Excel reads ₹ and Tamil names correctly.
      saveBlob(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }), `${kind === 'purchases' ? 'bill' : 'invoice'}-report-${month}.csv`)
    } catch (error) {
      console.error(error)
      pushToast({ title: 'Excel file not downloaded', message: 'The report could not be prepared. Try again.', level: 'danger' })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reports · GST"
        title="Monthly GST reports"
        subtitle="Annexure-I for the auditor. Built live from every saved invoice and bill — edit a row here or in Billing and both change together."
        icon={<FileBarChart className="h-4 w-4" />}
      />

      <div className="flex flex-wrap items-end gap-4">
        <Segmented<ReportKind>
          options={[
            { value: 'sales', label: `${KIND_LABEL.sales} · sales` },
            { value: 'purchases', label: `${KIND_LABEL.purchases} · purchase` },
          ]}
          value={kind}
          onChange={(v) => set({ type: v })}
        />
        <Field label="Month" className="w-48">
          <Input type="month" value={month} onChange={(e) => e.target.value && set({ month: e.target.value })} />
        </Field>
      </div>

      <StatStrip className="grid-cols-2 lg:grid-cols-4">
        <StatTile label={kind === 'sales' ? 'Invoices' : 'Bills'} value={String(rows)} icon={kind === 'sales' ? <ReceiptText className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />} tone="indigo" hint={report.label} />
        <StatTile label="Goods amount" value={moneyPaise(reg.taxable)} icon={<FileBarChart className="h-4 w-4" />} tone="slate" hint="Before GST" />
        <StatTile label="GST" value={moneyPaise(tax(reg))} icon={<FileBarChart className="h-4 w-4" />} tone="amber" hint={`CGST ${moneyPaise(reg.cgst)} · SGST ${moneyPaise(reg.sgst)} · IGST ${moneyPaise(reg.igst + reg.gst)}`} />
        <StatTile label="Total" value={moneyPaise(reg.total)} icon={<FileBarChart className="h-4 w-4" />} tone="green" hint="Goods + GST" />
      </StatStrip>

      <Card className="vx-anim-up overflow-hidden">
        <CardHead
          title={`${KIND_LABEL[kind]} — ${report.label}`}
          subtitle={kind === 'sales' ? 'Details of Sales/Payments · products sold, buyer, HSN and GST' : 'Details of Purchase/Receipts · materials bought, seller, HSN and GST'}
          actions={
            <div className="flex flex-wrap gap-2">
              <DownloadButton icon={<Download className="h-4 w-4" />} doc={() => gstReportDoc(read, month, kind)}>
                Download PDF
              </DownloadButton>
              <Button variant="secondary" icon={<FileSpreadsheet className="h-4 w-4" />} onClick={downloadCsv}>
                Download Excel
              </Button>
              <Button variant="ghost" icon={<Eye className="h-4 w-4" />} onClick={() => setPreview(gstReportDoc(read, month, kind))}>
                Preview
              </Button>
            </div>
          }
        />
        {reg.sections.length === 0 ? (
          <EmptyState
            icon={<FileBarChart className="h-6 w-6" />}
            title={`No ${kind === 'sales' ? 'invoices' : 'bills'} in ${report.label}`}
            message={kind === 'sales' ? 'Invoices appear here as soon as a dispatch is confirmed.' : 'Bills appear here as soon as they are saved in Billing → Purchase.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px]">
              <thead>
                <tr>
                  <th className="vx-th">{kind === 'sales' ? 'Buyer' : 'Seller'}</th>
                  <th className="vx-th">{kind === 'sales' ? 'Products sold' : 'Materials purchased'}</th>
                  <th className="vx-th">Bill no / date</th>
                  <th className="vx-th">GSTIN</th>
                  <th className="vx-th">HSN/SAC</th>
                  <th className="vx-th text-right">Goods amount</th>
                  <th className="vx-th text-right">CGST</th>
                  <th className="vx-th text-right">SGST</th>
                  <th className="vx-th text-right">IGST</th>
                  <th className="vx-th text-right">Total</th>
                  <th className="vx-th" />
                </tr>
              </thead>
              {reg.sections.map((s) => (
                <tbody key={s.title}>
                  <tr className="border-t border-rule bg-surface-2">
                    <td colSpan={11} className="vx-td text-sm font-semibold text-ink">
                      {s.title}
                    </td>
                  </tr>
                  {s.rows.map((x, i) => (
                    <tr key={`${x.sourceId}-${i}`} className="border-t border-rule">
                      <td className="vx-td">{x.party}</td>
                      <td className="vx-td max-w-64 text-sm text-muted">{x.items}</td>
                      <td className="vx-td vx-code text-sm">
                        {x.billNo}
                        <span className="block text-2xs text-faint">{fmtDate(x.date)}</span>
                      </td>
                      <td className="vx-td vx-code text-sm">{x.gstin || '—'}</td>
                      <td className="vx-td vx-code text-sm">{x.hsn || <span className="text-warn">missing</span>}</td>
                      <td className="vx-td vx-code text-right">{moneyPaise(x.taxable)}</td>
                      <td className="vx-td vx-code text-right">{x.cgstPct !== null ? `${x.cgstPct}% · ${moneyPaise(x.cgst)}` : '—'}</td>
                      <td className="vx-td vx-code text-right">{x.sgstPct !== null ? `${x.sgstPct}% · ${moneyPaise(x.sgst)}` : '—'}</td>
                      <td className="vx-td vx-code text-right">{x.igstPct !== null ? `${x.igstPct}% · ${moneyPaise(x.igst)}` : x.gst ? `${moneyPaise(x.gst)} (not split)` : '—'}</td>
                      <td className="vx-td vx-code text-right font-semibold">{moneyPaise(x.total)}</td>
                      <td className="vx-td text-right">
                        <Button size="sm" variant="secondary" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openRow(x.sourceId)} aria-label={`Edit ${x.billNo}`}>
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-rule font-semibold">
                    <td colSpan={5} className="vx-td text-right text-sm">
                      Total for {s.title}
                    </td>
                    <td className="vx-td vx-code text-right">{moneyPaise(s.taxable)}</td>
                    <td className="vx-td vx-code text-right">{moneyPaise(s.cgst)}</td>
                    <td className="vx-td vx-code text-right">{moneyPaise(s.sgst)}</td>
                    <td className="vx-td vx-code text-right">{moneyPaise(s.igst + s.gst)}</td>
                    <td className="vx-td vx-code text-right">{moneyPaise(s.total)}</td>
                    <td />
                  </tr>
                </tbody>
              ))}
              <tfoot>
                <tr className="border-t-2 border-rule-2 bg-surface-2 font-semibold text-ink">
                  <td colSpan={5} className="vx-td text-right">
                    Grand total
                  </td>
                  <td className="vx-td vx-code text-right">{moneyPaise(reg.taxable)}</td>
                  <td className="vx-td vx-code text-right">{moneyPaise(reg.cgst)}</td>
                  <td className="vx-td vx-code text-right">{moneyPaise(reg.sgst)}</td>
                  <td className="vx-td vx-code text-right">{moneyPaise(reg.igst + reg.gst)}</td>
                  <td className="vx-td vx-code text-right">{moneyPaise(reg.total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <DocumentPreview doc={preview} onClose={() => setPreview(null)} />
      <InvoiceEditDialog invoice={editInvoice} onClose={() => setEditInvoice(null)} />
      {editBill ? <PurchaseEditor bill={editBill} onClose={() => setEditBill(null)} onPreview={setPreview} /> : null}
      <HsnDatalist />
    </div>
  )
}
