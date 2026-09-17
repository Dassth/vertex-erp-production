import { useCallback, useEffect, useRef, useState } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import { Download, Eye, FileText } from 'lucide-react'
import type { Invoice, VertexDB } from '../lib/types'
import { DELIVERY_PENDING_BILLING_MESSAGE, consolidatedStatement, invoiceDownloadBlock, receivedInvoices } from '../lib/billing'
import { invoiceFileName } from '../lib/format'
import { useStore } from '../store/store'
import { Button, Modal, Skeleton } from './ui'

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
    const blocked = invoiceDownloadBlock(inv, read().dispatches)
    if (blocked) throw new DocumentBlockedError(blocked)
    const [{ invoiceDefinition }, { renderPdf }] = await loadPdf()
    return renderPdf(invoiceDefinition(inv))
  },
})

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
        <Button size={size} variant="secondary" icon={<Eye className="h-3.5 w-3.5" />} disabled={!!blocked} onClick={() => onPreview(invoiceDoc(invoice, read))} aria-label={`Preview invoice ${invoice.number}`}>
          Preview
        </Button>
        <DownloadButton size={size} icon={<Download className="h-3.5 w-3.5" />} disabled={!!blocked} doc={() => invoiceDoc(invoice, read)} aria-label={`${downloadLabel} — invoice ${invoice.number}`}>
          {downloadLabel}
        </DownloadButton>
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
        <iframe title={doc.title} src={file.url} className="h-[72vh] w-full rounded-md border border-rule bg-surface-2" />
      ) : failed ? (
        <p role="alert" className="rounded-md bg-risk-wash px-4 py-6 text-center text-base text-risk ring-1 ring-inset ring-risk-edge">
          {failed}
        </p>
      ) : (
        <div role="status" aria-busy="true">
          <span className="sr-only">Preparing PDF…</span>
          <Skeleton className="h-[72vh] w-full" />
        </div>
      )}
    </Modal>
  )
}
