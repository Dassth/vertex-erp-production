import { useCallback, useEffect, useRef, useState } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import { Download, Eye, FileSpreadsheet, FileText } from 'lucide-react'
import type { Invoice, PurchaseBill, VertexDB } from '../lib/types'
import { DELIVERY_PENDING_BILLING_MESSAGE, consolidatedStatement, invoiceDownloadBlock, receivedInvoices } from '../lib/billing'
import { invoiceFileName } from '../lib/format'
import { useStore } from '../store/store'
import { Button, Modal, Skeleton } from './ui'
import { FORMAT_LABEL, useExportFormat } from './exportFormat'
import { watermarkOn } from '../lib/brand'
import type { ReportTable } from '../lib/reportTable'

/* pdfmake and the embedded fonts are large, so document code loads only when a
   document is previewed or downloaded. */
const loadPdf = () => Promise.all([import('../lib/pdfDocs'), import('../lib/pdfRender')])

export interface PreviewDoc {
  title: string
  fileName: string
  build: () => Promise<Blob>
}

/** Raised when a document is not available yet; its message is shown to the user as-is. */
export class DocumentBlockedError extends Error {}

/**
 * An issued invoice. `read` supplies the latest saved state when the PDF is
 * built: the invoice is only produced once its shipment is confirmed received.
 */
export const invoiceDoc = (inv: Invoice, read: () => VertexDB): PreviewDoc => ({
  title: `Invoice ${inv.number}`,
  fileName: invoiceFileName(inv.number),
  build: async () => {
    const db = read()
    const blocked = invoiceDownloadBlock(inv, db.dispatches)
    if (blocked) throw new DocumentBlockedError(blocked)
    const [{ invoiceDefinition }, { renderPdf }] = await loadPdf()
    // A GST correction saved after this button rendered must still be printed.
    return renderPdf(invoiceDefinition(db.invoices.find((i) => i.id === inv.id) ?? inv))
  },
})

/**
 * A purchase bill, always available. `read` supplies the latest saved version,
 * so a download right after an edit prints the edited bill.
 */
export const purchaseDoc = (bill: PurchaseBill, read: () => VertexDB): PreviewDoc => ({
  title: `Purchase bill ${bill.code}`,
  fileName: `${bill.code}${bill.supplierInvoiceNo ? `-${bill.supplierInvoiceNo.replace(/[^A-Za-z0-9-]/g, '-')}` : ''}.pdf`,
  build: async () => {
    const db = read()
    const latest = (db.purchases ?? []).find((p) => p.id === bill.id)
    if (!latest) throw new DocumentBlockedError('This purchase bill was deleted.')
    const { updatedAt: _u, updatedBy: _b, ...company } = db.company
    void _u
    void _b
    const [{ purchaseBillDefinition }, { renderPdf }] = await loadPdf()
    return renderPdf(purchaseBillDefinition(latest, company, watermarkOn(db.company)))
  },
})

/** The monthly GST report (Annexure-I), built from the latest saved records. */
export const gstReportDoc = (read: () => VertexDB, month: string, kind: 'purchases' | 'sales'): PreviewDoc => ({
  title: `${kind === 'purchases' ? 'Purchase' : 'Sales'} report ${month}`,
  fileName: `${kind === 'purchases' ? 'purchase' : 'sales'}-report-${month}.pdf`,
  build: async () => {
    const db = read()
    const [{ gstReportDefinition }, { renderPdf }, { monthlyGstReport }] = await Promise.all([import('../lib/pdfDocs'), import('../lib/pdfRender'), import('../lib/gstReport')])
    const { updatedAt: _u, updatedBy: _b, ...company } = db.company
    void _u
    void _b
    return renderPdf(gstReportDefinition(monthlyGstReport(db, month), company, kind))
  },
})

/** The invoice report (each invoice or bill with its items), built from the latest saved records. */
export const invoiceRegisterDoc = (read: () => VertexDB, month: string, kind: 'purchases' | 'sales'): PreviewDoc => ({
  title: `${kind === 'purchases' ? 'Purchase' : 'Sales'} invoice report ${month}`,
  fileName: `${kind === 'purchases' ? 'purchase' : 'sales'}-invoice-report-${month}.pdf`,
  build: async () => {
    const db = read()
    const [{ reportTableDefinition }, { renderPdf }, { invoiceRegister, invoiceRegisterTable }] = await Promise.all([import('../lib/pdfDocs'), import('../lib/pdfRender'), import('../lib/invoiceRegister')])
    const { updatedAt: _u, updatedBy: _b, ...company } = db.company
    void _u
    void _b
    return renderPdf(reportTableDefinition(invoiceRegisterTable(invoiceRegister(db, month, kind), company.name), company))
  },
})

/** The job card of one plan — everything from customer to dispatch — built from the latest saved state. */
export const jobCardDoc = (read: () => VertexDB, planId: string, mode: 'plan' | 'live' = 'live'): PreviewDoc => {
  const now = read()
  const plan = now.plans.find((p) => p.id === planId)
  const order = now.orders.find((o) => o.id === plan?.orderId)
  const name = order?.code ?? plan?.code ?? planId
  return {
    title: `${mode === 'live' ? 'Live job card' : 'Job card (plan)'} ${name}`,
    fileName: `${mode === 'live' ? 'live-job-card' : 'job-card-plan'}-${name.replace(/[^A-Za-z0-9-]/g, '-')}.pdf`,
    build: async () => {
      const db = read()
      const [{ jobCardDefinition }, { renderPdf }, { jobCard }] = await Promise.all([import('../lib/pdfDocs'), import('../lib/pdfRender'), import('../lib/jobCard')])
      const card = jobCard(db, planId, mode)
      if (!card) throw new DocumentBlockedError('This plan no longer exists.')
      const { updatedAt: _u, updatedBy: _b, ...company } = db.company
      void _u
      void _b
      return renderPdf(jobCardDefinition(card, company, new Date(), watermarkOn(db.company)))
    },
  }
}

/**
 * One unit's job sheet for one production order — printed, or sent to the
 * unit's in-charge. Built from the latest saved state, so allocations made a
 * moment ago are on the sheet.
 */
export const unitJobSheetDoc = (read: () => VertexDB, orderId: string, unitId: string): PreviewDoc => {
  const now = read()
  const order = now.orders.find((o) => o.id === orderId)
  const unit = now.units.find((u) => u.id === unitId)
  const code = order?.code ?? orderId
  const unitLabel = unit?.shortName || unit?.name || unitId
  return {
    title: `Job sheet ${code} — ${unitLabel}`,
    fileName: `job-sheet-${code}-${unitLabel}.pdf`.replace(/[^A-Za-z0-9.-]+/g, '-'),
    build: async () => {
      const db = read()
      const latest = db.orders.find((o) => o.id === orderId)
      const u = db.units.find((x) => x.id === unitId)
      if (!latest || !u) throw new DocumentBlockedError('This job or unit no longer exists.')
      const [{ unitJobSheetDefinition }, { renderPdf }, { jobCard, unitJobSheet }] = await Promise.all([import('../lib/pdfDocs'), import('../lib/pdfRender'), import('../lib/jobCard')])
      const card = jobCard(db, latest.planId, 'live')
      if (!card) throw new DocumentBlockedError('The plan behind this job no longer exists.')
      const { updatedAt: _u, updatedBy: _b, ...company } = db.company
      void _u
      void _b
      return renderPdf(unitJobSheetDefinition(unitJobSheet(card, unitId), { name: u.name, speciality: u.speciality }, company, new Date(), watermarkOn(db.company)))
    },
  }
}

/** Everything planned for one unit today — the list sent to the unit's in-charge each morning. */
export const unitTodayDoc = (read: () => VertexDB, unitId: string): PreviewDoc => {
  const unit = read().units.find((u) => u.id === unitId)
  const label = unit?.shortName || unit?.name || unitId
  const today = new Date()
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return {
    title: `${label} — today’s work`,
    fileName: `${label}-work-${iso}.pdf`.replace(/[^A-Za-z0-9.-]+/g, '-'),
    build: async () => {
      const db = read()
      const [{ workListDefinition }, { renderPdf }, { unitWork }, { onDay }] = await Promise.all([import('../lib/pdfDocs'), import('../lib/pdfRender'), import('../lib/selectors'), import('../lib/unitDay')])
      const now = new Date()
      const work = unitWork(db.orders, unitId, now)
      const rows = [...work.ready, ...work.waiting]
        .filter((r) => onDay(r.process.plannedStart, r.process.plannedEnd, now))
        .sort((a, b) => a.process.plannedStart.localeCompare(b.process.plannedStart))
      if (!rows.length) throw new DocumentBlockedError('Nothing is planned for this unit today.')
      const name = (id: string) => db.units.find((u) => u.id === id)?.shortName ?? id
      const scope = now.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })
      return renderPdf(workListDefinition(rows, { title: `${db.company.name} — ${unit?.name ?? label}: today’s work`, scope, unitName: name }, now, watermarkOn(db.company)))
    },
  }
}

/** The costing sheet as a PDF. Internal figures — it is never sent to a customer. */
export const costingDoc = (read: () => VertexDB, costingId: string): PreviewDoc => {
  const code = read().costings.find((c) => c.id === costingId)?.code ?? costingId
  return {
    title: `Order costing ${code}`,
    fileName: `costing-${code.replace(/[^A-Za-z0-9-]/g, '-')}.pdf`,
    build: async () => {
      const db = read()
      const costing = db.costings.find((c) => c.id === costingId)
      if (!costing?.snapshot) throw new DocumentBlockedError('This costing has no saved snapshot yet.')
      const [{ reportTableDefinition }, { renderPdf }, { costingTable }] = await Promise.all([import('../lib/pdfDocs'), import('../lib/pdfRender'), import('../lib/docTables')])
      const { updatedAt: _u, updatedBy: _b, ...company } = db.company
      void _u
      void _b
      return renderPdf(reportTableDefinition(costingTable(costing, company.name), company, new Date(), watermarkOn(db.company)))
    },
  }
}

/** Everything the cumulative summary needs, taken from saved records only. */
function cumulativeSummaryData(db: VertexDB, orderId: string) {
  const order = db.orders.find((o) => o.id === orderId)
  const costing = order ? db.costings.find((c) => c.id === order.costingId) : undefined
  if (!order || !costing?.snapshot) return null
  const st = consolidatedStatement(order, receivedInvoices(orderId, db.dispatches, db.invoices), costing.snapshot.result)
  const covered = new Set(st.invoices.map((i) => i.dispatchId))
  if (!st.invoices.length) return null
  return { order, st, company: st.invoices[st.invoices.length - 1].company, dispatches: db.dispatches.filter((d) => covered.has(d.id)) }
}

/**
 * Cumulative invoice summary for one order. `read` is called when the PDF is
 * built, so a preview or download always reflects the latest saved dispatches.
 */
export function summaryDoc(read: () => VertexDB, orderId: string): PreviewDoc | null {
  const initial = cumulativeSummaryData(read(), orderId)
  if (!initial) return null
  return {
    title: `Cumulative invoice summary ${initial.order.code}`,
    fileName: `${initial.order.code}-cumulative-invoice-summary.pdf`,
    build: async () => {
      const data = cumulativeSummaryData(read(), orderId)
      if (!data) throw new DocumentBlockedError(`No shipment of ${initial.order.code} is confirmed received yet.`)
      const [{ statementDefinition }, { renderPdf }] = await loadPdf()
      return renderPdf(statementDefinition(data.order, data.st, data.company, new Date(), data.dispatches))
    },
  }
}

/** Consolidated order statement, built only from issued invoice snapshots. */
export function statementDoc(db: VertexDB, orderId: string): PreviewDoc | null {
  return summaryDoc(() => db, orderId)
}

async function save(blob: Blob, fileName: string) {
  const { saveBlob } = await import('../lib/pdfRender')
  saveBlob(blob, fileName)
}

export async function downloadDoc(doc: PreviewDoc) {
  await save(await doc.build(), doc.fileName)
}

/* ------------------------------- Spreadsheets ------------------------------ */

/** A spreadsheet of the same document, in the format chosen in Reports → Settings. */
export function ExcelButton({ table, stem, children, ...rest }: ButtonLike & { table: () => ReportTable | Promise<ReportTable>; stem: string; children?: ReactNode }) {
  const { db, pushToast } = useStore()
  const mark = watermarkOn(db.company)
  const [format] = useExportFormat()
  const [phase, setPhase] = useState<'idle' | 'busy' | 'error'>('idle')
  const busy = useRef(false)
  return (
    <Button
      {...rest}
      icon={rest.icon ?? <FileSpreadsheet className="h-3.5 w-3.5" />}
      loading={phase === 'busy'}
      state={phase === 'error' ? 'error' : 'idle'}
      onClick={() => {
        if (busy.current) return
        busy.current = true
        setPhase('busy')
        ;(async () => {
          const [{ tableFile }, { saveBlob }] = await Promise.all([import('../lib/reportTable'), import('../lib/pdfRender')])
          const built = await table()
          const { blob, fileName } = tableFile({ ...built, watermark: !!built.internal && mark }, format, stem)
          saveBlob(blob, fileName)
        })().then(
          () => {
            busy.current = false
            setPhase('idle')
          },
          (error: unknown) => {
            console.error(error)
            busy.current = false
            setPhase('error')
            pushToast({
              title: `${FORMAT_LABEL[format]} file could not be prepared`,
              message: error instanceof DocumentBlockedError ? error.message : 'Try the download again.',
              level: 'danger',
            })
          },
        )
      }}
    >
      {children ?? FORMAT_LABEL[format]}
    </Button>
  )
}

/* ------------------------------ Download action --------------------------- */

/**
 * Building a PDF is asynchronous and can fail (chunk fetch, font fetch, quota).
 * This keeps one download in flight per button, reports failures where the user
 * is looking, and leaves the button ready for another attempt.
 */
function useDownloadAction() {
  const { pushToast } = useStore()
  const [phase, setPhase] = useState<'idle' | 'busy' | 'error'>('idle')
  const inFlight = useRef(false)
  const alive = useRef(true)

  useEffect(() => {
    // Set on every mount: StrictMode runs mount → unmount → mount in development.
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const run = useCallback(
    (title: string, work: () => Promise<void>) => {
      if (inFlight.current) return // ignore repeat clicks until this one settles
      inFlight.current = true
      setPhase('busy')
      work().then(
        () => {
          inFlight.current = false
          if (alive.current) setPhase('idle')
        },
        (error: unknown) => {
          console.error(error)
          inFlight.current = false
          if (alive.current) setPhase('error')
          pushToast({
            title: `${title} could not be downloaded`,
            message: error instanceof DocumentBlockedError ? error.message : 'The document could not be prepared. Check your connection and try the download again.',
            level: 'danger',
          })
        },
      )
    },
    [pushToast],
  )

  return { phase, run }
}

type ButtonLike = Omit<ComponentProps<typeof Button>, 'onClick' | 'loading' | 'state' | 'children'>

/** Downloads a document, showing progress in place and surfacing failures. */
export function DownloadButton({ doc, children, ...rest }: ButtonLike & { doc: () => PreviewDoc; children: ReactNode }) {
  const { phase, run } = useDownloadAction()
  return (
    <Button
      {...rest}
      loading={phase === 'busy'}
      state={phase === 'error' ? 'error' : 'idle'}
      onClick={() => {
        const target = doc()
        run(target.title, () => downloadDoc(target))
      }}
    >
      {children}
    </Button>
  )
}

/** Reads the latest committed state at call time (for building documents). */
export function useLatestDb(): () => VertexDB {
  const { db } = useStore()
  const latest = useRef(db)
  useEffect(() => {
    latest.current = db
  }, [db])
  return useCallback(() => latest.current, [])
}

/** The message shown while an invoice waits for delivery confirmation, worded for the viewer. */
export function useDeliveryPendingMessage(): (reason: string) => string {
  const { can } = useStore()
  return (reason) => (can('dispatch') ? reason : DELIVERY_PENDING_BILLING_MESSAGE)
}

/**
 * Preview and "Download PDF" for one issued invoice. Both stay visible; until the
 * shipment is confirmed received they are unavailable and say why.
 */
export function InvoiceDocActions({
  invoice,
  onPreview,
  size = 'sm',
  downloadLabel = 'Download PDF',
  className,
  alwaysAllow,
}: {
  invoice: Invoice
  onPreview: (doc: PreviewDoc) => void
  size?: ComponentProps<typeof Button>['size']
  downloadLabel?: string
  className?: string
  alwaysAllow?: boolean
}) {
  const { db } = useStore()
  const read = useLatestDb()
  const pending = useDeliveryPendingMessage()
  const blocked = alwaysAllow ? null : invoiceDownloadBlock(invoice, db.dispatches)
  return (
    <div className={className ?? 'flex flex-col items-end gap-1'}>
      <div className="flex flex-wrap justify-end gap-1">
        <Button size={size} variant="secondary" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => onPreview(invoiceDoc(invoice, read))} aria-label={`Preview invoice ${invoice.number}`}>
          Preview
        </Button>
        <DownloadButton size={size} icon={<Download className="h-3.5 w-3.5" />} disabled={!!blocked} doc={() => invoiceDoc(invoice, read)} aria-label={`${downloadLabel} — invoice ${invoice.number}`}>
          {downloadLabel}
        </DownloadButton>
        <ExcelButton
          size={size}
          variant="secondary"
          disabled={!!blocked}
          stem={`invoice-${invoice.number.replace(/[\\/]/g, '-')}`}
          aria-label={`Download invoice ${invoice.number} as a spreadsheet`}
          table={async () => {
            const { invoiceTable } = await import('../lib/docTables')
            return invoiceTable(read().invoices.find((i) => i.id === invoice.id) ?? invoice)
          }}
        />
      </div>
      {blocked ? <p className="max-w-64 text-right text-2xs text-warn">{pending(blocked)}</p> : null}
    </div>
  )
}

/* -------------------------------- Preview --------------------------------- */

export function DocumentPreview({ doc, onClose }: { doc: PreviewDoc | null; onClose: () => void }) {
  const [file, setFile] = useState<{ blob: Blob; url: string } | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const { phase, run } = useDownloadAction()

  useEffect(() => {
    if (!doc) return
    let cancelled = false
    let objectUrl: string | null = null
    doc.build().then(
      (blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setFile({ blob, url: objectUrl })
      },
      (error: unknown) => {
        console.error(error)
        if (!cancelled) setFailed(error instanceof DocumentBlockedError ? error.message : 'The PDF could not be prepared. Check your connection and reload the page.')
      },
    )
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setFile(null)
      setFailed(null)
    }
  }, [doc])

  return (
    <Modal
      open={!!doc}
      onClose={onClose}
      title={doc?.title ?? ''}
      subtitle="Preview — download the PDF to send it to the customer"
      icon={<FileText className="h-5 w-5" />}
      size="xl"
      pinnedFooter
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {/* Saves the exact file shown in the preview. */}
          <Button
            icon={<Download className="h-4 w-4" />}
            disabled={!file}
            loading={phase === 'busy'}
            state={phase === 'error' ? 'error' : 'idle'}
            onClick={() => doc && file && run(doc.title, () => save(file.blob, doc.fileName))}
          >
            Download PDF
          </Button>
        </>
      }
    >
      {file && doc ? (
        <iframe title={doc.title} src={file.url} className="block h-[calc(100dvh-15rem)] min-h-[280px] w-full rounded-md border border-rule bg-surface-2 sm:h-[calc(100dvh-17rem)]" />
      ) : failed ? (
        <p role="alert" className="rounded-md bg-risk-wash px-4 py-6 text-center text-base text-risk ring-1 ring-inset ring-risk-edge">
          {failed}
        </p>
      ) : (
        <div role="status" aria-busy="true">
          <span className="sr-only">Preparing PDF…</span>
          <Skeleton className="h-[calc(100dvh-15rem)] min-h-[280px] w-full sm:h-[calc(100dvh-17rem)]" />
        </div>
      )}
    </Modal>
  )
}
