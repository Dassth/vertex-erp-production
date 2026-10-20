import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, Eye, FileBarChart, FileSpreadsheet, Pencil, ReceiptText, Settings, ShoppingCart } from 'lucide-react'
import { useStore } from '../../store/store'
import type { Invoice, PurchaseBill } from '../../lib/types'
import { fmtDate, moneyPaise } from '../../lib/format'
import { defaultReportMonth, gstReportTable, monthlyGstReport } from '../../lib/gstReport'
import type { GstRegister, ReportKind } from '../../lib/gstReport'
import { invoiceRegister, invoiceRegisterTable } from '../../lib/invoiceRegister'
import type { InvoiceRegister } from '../../lib/invoiceRegister'
import { tableFile } from '../../lib/reportTable'
import type { ExportFormat } from '../../lib/reportTable'
import { fromPaise, toPaise } from '../../lib/costing'
import { Button, Card, CardHead, EmptyState, Field, IconButton, Input, Modal, Segmented } from '../../components/ui'
import { PageHeader, StatStrip, StatTile, openRow, useDocumentTitle } from '../../components/page'
import { DocumentPreview, DownloadButton, gstReportDoc, invoiceRegisterDoc, useLatestDb } from '../../components/DocumentPreview'
import type { PreviewDoc } from '../../components/DocumentPreview'
import { HsnDatalist, PurchaseEditor } from '../billing/PurchaseBills'
import { InvoiceEditDialog } from '../billing/InvoiceEditDialog'
import { FORMAT_LABEL, useExportFormat } from '../../components/exportFormat'

/** invoice = each invoice or bill with its items; gst = Annexure-I grouped by GST rate. */
type ReportType = 'invoice' | 'gst'

const TYPE_LABEL: Record<ReportType, string> = { invoice: 'Invoice report', gst: 'Billing report (GST)' }
const KIND_LABEL: Record<ReportKind, string> = { sales: 'Sales', purchases: 'Purchase' }

/**
 * Monthly reports. Nothing is stored here: every row is read from the saved
 * sales invoices and purchase bills, and "Edit" opens that very invoice or bill
 * — so an edit here, in Billing or anywhere else is the same edit.
 */
export function ReportsPage() {
  useDocumentTitle('Reports')
  const { db, pushToast } = useStore()
  const read = useLatestDb()
  const [params, setParams] = useSearchParams()
  const type: ReportType = params.get('report') === 'gst' ? 'gst' : 'invoice'
  const kind: ReportKind = params.get('type') === 'purchases' ? 'purchases' : 'sales'
  const month = /^\d{4}-\d{2}$/.test(params.get('month') ?? '') ? params.get('month')! : defaultReportMonth()
  const [format, setFormat] = useExportFormat()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [preview, setPreview] = useState<PreviewDoc | null>(null)
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null)
  const [editBill, setEditBill] = useState<PurchaseBill | null>(null)

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) next.set(k, v)
    setParams(next, { replace: true })
  }

  const gst = useMemo(() => monthlyGstReport(db, month), [db, month])
  const register = useMemo(() => invoiceRegister(db, month, kind), [db, month, kind])
  const reg = gst[kind]
  const gstTax = (r: GstRegister) => fromPaise(toPaise(r.cgst) + toPaise(r.sgst) + toPaise(r.igst) + toPaise(r.gst))
  const count = register.docs.length

  const openSource = (sourceId: string) => {
    if (kind === 'sales') {
      const inv = db.invoices.find((i) => i.id === sourceId)
      if (inv) setEditInvoice(inv)
    } else {
      const bill = (db.purchases ?? []).find((b) => b.id === sourceId)
      if (bill) setEditBill(bill)
    }
  }

  const pdfDoc = () => (type === 'gst' ? gstReportDoc(read, month, kind) : invoiceRegisterDoc(read, month, kind))

  const downloadSheet = async () => {
    try {
      const latest = read()
      const table = type === 'gst' ? gstReportTable(monthlyGstReport(latest, month), latest.company.name, kind) : invoiceRegisterTable(invoiceRegister(latest, month, kind), latest.company.name)
      const stem = `${kind === 'purchases' ? 'purchase' : 'sales'}-${type === 'gst' ? 'gst' : 'invoice'}-report-${month}`
      const { blob, fileName } = tableFile(table, format, stem)
      const { saveBlob } = await import('../../lib/pdfRender')
      saveBlob(blob, fileName)
    } catch (error) {
      console.error(error)
      pushToast({ title: `${FORMAT_LABEL[format]} file not downloaded`, message: 'The report could not be prepared. Try again.', level: 'danger' })
    }
  }

  const title = `${KIND_LABEL[kind]} ${TYPE_LABEL[type].toLowerCase()} — ${gst.label}`

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reports"
        title="Monthly reports"
        subtitle="Built live from every saved invoice and bill. Edit a row here or in Billing and both change together."
        icon={<FileBarChart className="h-4 w-4" />}
        actions={
          <Button variant="secondary" icon={<Settings className="h-4 w-4" />} onClick={() => setSettingsOpen(true)}>
            Settings
          </Button>
        }
      />

      <Card className="vx-anim-up p-4">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div>
            <span className="vx-label">Report</span>
            <Segmented<ReportType>
              options={[
                { value: 'invoice', label: TYPE_LABEL.invoice },
                { value: 'gst', label: TYPE_LABEL.gst },
              ]}
              value={type}
              onChange={(v) => set({ report: v })}
            />
          </div>
          <div>
            <span className="vx-label">Sales or purchase</span>
            <Segmented<ReportKind>
              options={[
                { value: 'sales', label: KIND_LABEL.sales, count: invoiceRegister(db, month, 'sales').docs.length },
                { value: 'purchases', label: KIND_LABEL.purchases, count: invoiceRegister(db, month, 'purchases').docs.length },
              ]}
              value={kind}
              onChange={(v) => set({ type: v })}
            />
          </div>
          <Field label="Month" className="w-48">
            <Input type="month" value={month} onChange={(e) => e.target.value && set({ month: e.target.value })} />
          </Field>
        </div>
      </Card>

      <StatStrip className="grid-cols-2 lg:grid-cols-4">
        <StatTile label={kind === 'sales' ? 'Invoices' : 'Bills'} value={String(count)} icon={kind === 'sales' ? <ReceiptText className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />} tone="indigo" hint={gst.label} />
        <StatTile label="Goods amount" value={moneyPaise(reg.taxable)} icon={<FileBarChart className="h-4 w-4" />} tone="slate" hint="Before GST" />
        <StatTile label="GST" value={moneyPaise(gstTax(reg))} icon={<FileBarChart className="h-4 w-4" />} tone="amber" hint={`CGST ${moneyPaise(reg.cgst)} · SGST ${moneyPaise(reg.sgst)} · IGST ${moneyPaise(reg.igst)}${reg.gst ? ` · ${moneyPaise(reg.gst)} state missing` : ''}`} />
        <StatTile label="Total" value={moneyPaise(register.total)} icon={<FileBarChart className="h-4 w-4" />} tone="green" hint={kind === 'purchases' ? 'Net of round off' : 'Goods + GST'} />
      </StatStrip>

      <Card className="vx-anim-up overflow-hidden">
        <CardHead
          title={title}
          subtitle={
            type === 'gst'
              ? `Annexure-I · ${kind === 'sales' ? 'Details of Sales/Payments' : 'Details of Purchase/Receipts'}, grouped by GST rate`
              : `Each ${kind === 'sales' ? 'invoice' : 'bill'} with its items, quantity, rate and GST`
          }
          actions={
            <div className="flex flex-wrap gap-2">
              <DownloadButton icon={<Download className="h-4 w-4" />} doc={pdfDoc}>
                Download PDF
              </DownloadButton>
              <Button variant="secondary" icon={<FileSpreadsheet className="h-4 w-4" />} onClick={downloadSheet}>
                Download {FORMAT_LABEL[format]}
              </Button>
              <Button variant="ghost" icon={<Eye className="h-4 w-4" />} onClick={() => setPreview(pdfDoc())}>
                Preview
              </Button>
            </div>
          }
        />
        {count === 0 ? (
          <EmptyState
            icon={<FileBarChart className="h-6 w-6" />}
            title={`No ${kind === 'sales' ? 'sales invoices' : 'purchase bills'} in ${gst.label}`}
            message={kind === 'sales' ? 'Sales invoices appear here as soon as a dispatch is confirmed.' : 'Purchase bills appear here as soon as they are saved in Billing → Purchase.'}
          />
        ) : type === 'gst' ? (
          <GstTable reg={reg} kind={kind} onEdit={openSource} />
        ) : (
          <InvoiceTable register={register} onEdit={openSource} />
        )}
      </Card>

      <ExportSettings open={settingsOpen} format={format} onChange={setFormat} onClose={() => setSettingsOpen(false)} />
      <DocumentPreview doc={preview} onClose={() => setPreview(null)} />
      <InvoiceEditDialog invoice={editInvoice} onClose={() => setEditInvoice(null)} />
      {editBill ? <PurchaseEditor bill={editBill} onClose={() => setEditBill(null)} onPreview={setPreview} /> : null}
      <HsnDatalist />
    </div>
  )
}

function ExportSettings({ open, format, onChange, onClose }: { open: boolean; format: ExportFormat; onChange: (f: ExportFormat) => void; onClose: () => void }) {
  const choices: Array<{ value: ExportFormat; title: string; detail: string }> = [
    { value: 'xlsx', title: 'Excel (.xlsx)', detail: 'Opens in Excel with columns, bold totals and number formatting. Recommended.' },
    { value: 'csv', title: 'CSV (.csv)', detail: 'Plain comma-separated text, for other accounting software.' },
  ]
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      icon={<Settings className="h-5 w-5" />}
      title="Report settings"
      subtitle="Saved on this computer"
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <fieldset>
        <legend className="vx-label mb-2">Spreadsheet download format</legend>
        <div className="space-y-2">
          {choices.map((c) => (
            <label
              key={c.value}
              className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${format === c.value ? 'border-accent bg-accent-wash' : 'border-rule hover:bg-surface-2'}`}
            >
              <input type="radio" name="export-format" className="mt-1" checked={format === c.value} onChange={() => onChange(c.value)} />
              <span>
                <span className="block text-sm font-semibold text-ink">{c.title}</span>
                <span className="block text-xs text-muted">{c.detail}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </Modal>
  )
}

/** Dense report rows: an icon with its full name (the whole row also opens the document). */
function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <IconButton label={`Edit ${label}`} onClick={onClick}>
      <Pencil className="h-3.5 w-3.5" />
    </IconButton>
  )
}

function InvoiceTable({ register, onEdit }: { register: InvoiceRegister; onEdit: (id: string) => void }) {
  return (
    <div className="overflow-x-auto">
      {/* Fits a laptop screen: GST % sits under the rate and the GST under the total; nothing is left out. */}
      <table className="w-full min-w-[760px] [&_.vx-td]:px-2 [&_.vx-th]:px-2">
        <thead>
          <tr>
            <th className="vx-th left-0 z-20">Date / No.</th>
            <th className="vx-th">{register.kind === 'sales' ? 'Buyer' : 'Seller'}</th>
            <th className="vx-th">Item</th>
            <th className="vx-th">HSN</th>
            <th className="vx-th whitespace-nowrap text-right">Qty</th>
            <th className="vx-th whitespace-nowrap text-right">Rate · GST %</th>
            <th className="vx-th whitespace-nowrap text-right">Amount</th>
            <th className="vx-th whitespace-nowrap text-right">Total · GST</th>
            <th className="vx-th w-8">
              <span className="sr-only">Edit</span>
            </th>
          </tr>
        </thead>
        {register.docs.map((d) => (
          <tbody key={d.sourceId} {...openRow(() => onEdit(d.sourceId))} className="cursor-pointer border-t border-rule hover:bg-surface-2">
            {d.lines.map((l, i) => (
              <tr key={i} className={i ? '' : 'border-t border-rule'}>
                <td className="vx-td sticky left-0 z-[1] whitespace-nowrap bg-surface align-top">
                  {i === 0 ? (
                    <>
                      <span className="vx-code text-xs">{d.number}</span>
                      <span className="block text-2xs text-faint">{fmtDate(d.date)}</span>
                    </>
                  ) : null}
                </td>
                <td className="vx-td vx-td-wrap min-w-[7.5rem] align-top text-sm">
                  {i === 0 ? (
                    <>
                      {d.party}
                      {d.gstin ? <span className="vx-code block text-2xs text-faint">{d.gstin}</span> : null}
                    </>
                  ) : null}
                </td>
                <td className="vx-td vx-td-wrap min-w-[8rem] text-sm">{l.description}</td>
                <td className="vx-td vx-code text-xs">{l.hsn || <span className="text-warn">missing</span>}</td>
                <td className="vx-td vx-code whitespace-nowrap text-right text-sm">
                  {l.quantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })} {l.uom}
                </td>
                <td className="vx-td vx-code whitespace-nowrap text-right text-sm">
                  {moneyPaise(l.rate)}
                  <span className="block text-2xs text-faint">GST {l.gstPct}%</span>
                </td>
                <td className="vx-td vx-code whitespace-nowrap text-right text-sm">{moneyPaise(l.amount)}</td>
                <td className="vx-td vx-code whitespace-nowrap text-right text-sm font-semibold">
                  {i === d.lines.length - 1 ? (
                    <>
                      {moneyPaise(d.total)}
                      <span className="block text-2xs font-normal text-faint">GST {moneyPaise(d.cgst + d.sgst + d.igst + d.gst)}</span>
                    </>
                  ) : (
                    ''
                  )}
                </td>
                <td className="vx-td text-right align-top">{i === 0 ? <EditButton label={d.number} onClick={() => onEdit(d.sourceId)} /> : null}</td>
              </tr>
            ))}
          </tbody>
        ))}
        <tfoot>
          <tr className="border-t-2 border-rule-2 bg-surface-2 font-semibold text-ink">
            <td colSpan={6} className="vx-td text-right">
              Grand total — {register.docs.length} {register.kind === 'sales' ? 'invoice(s)' : 'bill(s)'}
            </td>
            <td className="vx-td vx-code whitespace-nowrap text-right text-sm">{moneyPaise(register.taxable)}</td>
            <td className="vx-td vx-code whitespace-nowrap text-right text-sm">
              {moneyPaise(register.total)}
              <span className="block text-2xs font-normal text-faint">GST {moneyPaise(register.tax)}</span>
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function GstTable({ reg, kind, onEdit }: { reg: GstRegister; kind: ReportKind; onEdit: (id: string) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[800px] [&_.vx-td]:px-2 [&_.vx-th]:px-2">
        <thead>
          <tr>
            <th className="vx-th left-0 z-20">{kind === 'sales' ? 'Buyer' : 'Seller'}</th>
            <th className="vx-th">{kind === 'sales' ? 'Products sold' : 'Materials purchased'}</th>
            <th className="vx-th">Bill no / date</th>
            <th className="vx-th">HSN</th>
            <th className="vx-th whitespace-nowrap text-right">Taxable</th>
            <th className="vx-th whitespace-nowrap text-right">CGST</th>
            <th className="vx-th whitespace-nowrap text-right">SGST</th>
            <th className="vx-th whitespace-nowrap text-right">IGST</th>
            <th className="vx-th whitespace-nowrap text-right">Total</th>
          </tr>
        </thead>
        {reg.sections.map((s) => (
          <tbody key={s.title}>
            <tr className="border-t border-rule bg-surface-2">
              <td colSpan={9} className="vx-td text-sm font-semibold text-ink">
                {s.title}
              </td>
            </tr>
            {s.rows.map((x, i) => (
              <tr key={`${x.sourceId}-${i}`} {...openRow(() => onEdit(x.sourceId))} className="cursor-pointer border-t border-rule hover:bg-surface-2">
                <td className="vx-td vx-td-wrap sticky left-0 z-[1] min-w-[8rem] bg-surface text-sm">
                  {x.party}
                  {x.gstin ? <span className="vx-code block text-2xs text-faint">{x.gstin}</span> : null}
                </td>
                <td className="vx-td vx-td-wrap min-w-[6.5rem] max-w-64 text-sm text-muted">{x.items}</td>
                <td className="vx-td vx-code text-xs">
                  {/* The keyboard way into the bill; the whole row opens it too. */}
                  <button type="button" onClick={() => onEdit(x.sourceId)} className="vx-focus whitespace-nowrap rounded-xs text-accent-text hover:underline" aria-label={`Edit ${x.billNo}`}>
                    {x.billNo}
                  </button>
                  <span className="block text-2xs text-faint">{fmtDate(x.date)}</span>
                </td>
                <td className="vx-td vx-code text-xs">{x.hsn || <span className="text-warn">missing</span>}</td>
                <td className="vx-td vx-code whitespace-nowrap text-right text-sm">{moneyPaise(x.taxable)}</td>
                <td className="vx-td vx-code whitespace-nowrap text-right text-sm">{x.cgstPct !== null ? (
                    <>
                      {moneyPaise(x.cgst)}
                      <span className="block text-2xs text-faint">{x.cgstPct}%</span>
                    </>
                  ) : (
                    '—'
                  )}</td>
                <td className="vx-td vx-code whitespace-nowrap text-right text-sm">{x.sgstPct !== null ? (
                    <>
                      {moneyPaise(x.sgst)}
                      <span className="block text-2xs text-faint">{x.sgstPct}%</span>
                    </>
                  ) : (
                    '—'
                  )}</td>
                <td className="vx-td vx-code whitespace-nowrap text-right text-sm">{x.igstPct !== null ? (
                    <>
                      {moneyPaise(x.igst)}
                      <span className="block text-2xs text-faint">{x.igstPct}%</span>
                    </>
                  ) : (
                    '—'
                  )}</td>
                <td className="vx-td vx-code whitespace-nowrap text-right text-sm font-semibold">{moneyPaise(x.total)}</td>
              </tr>
            ))}
            <tr className="border-t border-rule font-semibold">
              <td colSpan={4} className="vx-td text-right text-sm">
                Total for {s.title}
              </td>
              <td className="vx-td vx-code whitespace-nowrap text-right text-sm">{moneyPaise(s.taxable)}</td>
              <td className="vx-td vx-code whitespace-nowrap text-right text-sm">{moneyPaise(s.cgst)}</td>
              <td className="vx-td vx-code whitespace-nowrap text-right text-sm">{moneyPaise(s.sgst)}</td>
              <td className="vx-td vx-code whitespace-nowrap text-right text-sm">{moneyPaise(s.igst)}</td>
              <td className="vx-td vx-code whitespace-nowrap text-right text-sm">{moneyPaise(s.total)}</td>
            </tr>
          </tbody>
        ))}
        <tfoot>
          <tr className="border-t-2 border-rule-2 bg-surface-2 font-semibold text-ink">
            <td colSpan={4} className="vx-td text-right">
              Grand total
            </td>
            <td className="vx-td vx-code whitespace-nowrap text-right text-sm">{moneyPaise(reg.taxable)}</td>
            <td className="vx-td vx-code whitespace-nowrap text-right text-sm">{moneyPaise(reg.cgst)}</td>
            <td className="vx-td vx-code whitespace-nowrap text-right text-sm">{moneyPaise(reg.sgst)}</td>
            <td className="vx-td vx-code whitespace-nowrap text-right text-sm">{moneyPaise(reg.igst)}</td>
            <td className="vx-td vx-code whitespace-nowrap text-right text-sm">{moneyPaise(reg.total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
