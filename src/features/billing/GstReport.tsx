import { useMemo } from 'react'
import { Download, Eye, FileSpreadsheet, ReceiptText, ShoppingCart } from 'lucide-react'
import type { ReactNode } from 'react'
import { useStore } from '../../store/store'
import { moneyPaise } from '../../lib/format'
import { gstReportCsv, monthlyGstReport } from '../../lib/gstReport'
import type { GstRegister, MonthlyGstReport, ReportKind } from '../../lib/gstReport'
import { fromPaise, toPaise } from '../../lib/costing'
import { Button, Card, Field, Input } from '../../components/ui'
import { DownloadButton, gstReportDoc, useLatestDb } from '../../components/DocumentPreview'
import type { PreviewDoc } from '../../components/DocumentPreview'

/**
 * Monthly government reports, ready to download. Nothing is stored: every
 * download is built from the saved sales invoices and purchase bills at that
 * moment, so new bills and edits are always included.
 */
export function GstReport({ month, onMonth, onPreview }: { month: string; onMonth: (m: string) => void; onPreview: (d: PreviewDoc) => void }) {
  const { db } = useStore()
  const report = useMemo(() => monthlyGstReport(db, month), [db, month])

  return (
    <>
      <Card className="vx-anim-up p-4">
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Month" className="w-48">
            <Input type="month" value={month} onChange={(e) => e.target.value && onMonth(e.target.value)} />
          </Field>
          <p className="mb-5 min-w-64 flex-1 text-sm text-muted">
            Reports update automatically. Every sales invoice issued on dispatch and every purchase bill you save — including later edits — is included the moment it is saved.
          </p>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportCard
          kind="purchases"
          title="Purchase report"
          icon={<ShoppingCart className="h-5 w-5" />}
          empty="No purchase bills this month."
          report={report}
          month={month}
          onPreview={onPreview}
        />
        <ReportCard kind="sales" title="Sales report" icon={<ReceiptText className="h-5 w-5" />} empty="No sales invoices this month." report={report} month={month} onPreview={onPreview} />
      </div>
    </>
  )
}

const tax = (r: GstRegister) => fromPaise(toPaise(r.cgst) + toPaise(r.sgst) + toPaise(r.igst) + toPaise(r.gst))
const rowCount = (r: GstRegister) => r.sections.reduce((s, x) => s + x.rows.length, 0)

function ReportCard({
  kind,
  title,
  icon,
  empty,
  report,
  month,
  onPreview,
}: {
  kind: ReportKind
  title: string
  icon: ReactNode
  empty: string
  report: MonthlyGstReport
  month: string
  onPreview: (d: PreviewDoc) => void
}) {
  const { db, pushToast } = useStore()
  const read = useLatestDb()
  const reg = report[kind]
  const n = rowCount(reg)

  const downloadCsv = async () => {
    try {
      const csv = gstReportCsv(monthlyGstReport(read(), month), db.company.name, kind)
      const { saveBlob } = await import('../../lib/pdfRender')
      // BOM so Excel reads ₹ and Tamil names correctly.
      saveBlob(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }), `${kind === 'purchases' ? 'purchase' : 'sales'}-report-${month}.csv`)
    } catch (error) {
      console.error(error)
      pushToast({ title: `${title} not downloaded`, message: 'The report could not be prepared. Try again.', level: 'danger' })
    }
  }

  return (
    <Card className="vx-anim-up flex flex-col p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-faint" aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-ink">
            {title} — {report.label}
          </h2>
          <p className="text-sm text-muted">Annexure-I · {kind === 'purchases' ? 'materials bought, supplier, HSN and GST' : 'products sold, buyer, HSN and GST'}</p>
        </div>
      </div>

      {n ? (
        <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-muted">{kind === 'purchases' ? 'Bills' : 'Invoices'}</dt>
            <dd className="vx-code text-base font-semibold text-ink">{n}</dd>
          </div>
          <div>
            <dt className="text-muted">Goods amount</dt>
            <dd className="vx-code text-base font-semibold text-ink">{moneyPaise(reg.taxable)}</dd>
          </div>
          <div>
            <dt className="text-muted">GST</dt>
            <dd className="vx-code text-base font-semibold text-ink">{moneyPaise(tax(reg))}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-4 text-sm text-muted">{empty} You can still download an empty report.</p>
      )}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-rule pt-4">
        <DownloadButton icon={<Download className="h-4 w-4" />} doc={() => gstReportDoc(read, month, kind)} aria-label={`Download ${title} PDF for ${report.label}`}>
          Download PDF
        </DownloadButton>
        <Button variant="secondary" icon={<FileSpreadsheet className="h-4 w-4" />} onClick={downloadCsv} aria-label={`Download ${title} Excel for ${report.label}`}>
          Download Excel
        </Button>
        <Button variant="ghost" icon={<Eye className="h-4 w-4" />} onClick={() => onPreview(gstReportDoc(read, month, kind))}>
          Preview
        </Button>
      </div>
    </Card>
  )
}
