/* ---------------------------------------------------------------------------
 * Customer documents and shop-floor sheets as pdfmake document definitions.
 *
 * These builders are pure data — no PDF library is imported here — so they are
 * shared by the browser renderer (pdfRender.ts) and the Node tests.
 *
 * TEXT & SCRIPTS: every run of text uses Noto Sans Tamil, which also covers
 * Latin, digits, ₹ and typographic punctuation. pdfmake renders through pdfkit,
 * whose fontkit engine applies OpenType shaping (GSUB/GPOS), so Tamil conjuncts
 * and vowel signs are shaped correctly; see shaping.test.ts, which checks the
 * glyph output against HarfBuzz. Nothing is replaced or stripped.
 *
 * CONTENT RULES: customer documents are rendered only from stored invoice
 * snapshots and contain selling prices — never internal cost or profit.
 * A fixed creation date (the invoice's own timestamp) makes the output
 * byte-for-byte reproducible, so a preview and a download are the same file.
 * ------------------------------------------------------------------------- */

import type { Content, ContentTable, CustomTableLayout, TDocumentDefinitions, TableCell } from 'pdfmake/interfaces'
import { format } from 'date-fns'
import type { CompanySnapshot, Dispatch, Invoice, ProductionOrder, PurchaseBill } from './types'
import type { ConsolidatedStatement } from './billing'
import { rupeesInWords } from './billing'
import { purchaseTotals } from './gst'
import type { GstRegister, MonthlyGstReport, ReportKind } from './gstReport'
import { ITEMS_HEAD, PARTY_HEAD, REPORT_TITLE } from './gstReport'
import type { CellValue, ReportTable } from './reportTable'
import type { ProcessWorkRow } from './selectors'

export const FONT_FAMILY = 'NotoSansTamil'
export const FONT_FILES = {
  normal: 'NotoSansTamil-Regular.ttf',
  bold: 'NotoSansTamil-Bold.ttf',
  italics: 'NotoSansTamil-Regular.ttf',
  bolditalics: 'NotoSansTamil-Bold.ttf',
}

const INK = '#16181d'
const MUTED = '#5a616d'
const ACCENT = '#4d57b8'
const RULE = '#d2d6e0'
const WASH = '#f1f2f6'
const WARN_WASH = '#fdf3e0'
const WARN = '#8a5a00'
const A4_WIDTH = 515 // 595pt page − 40pt margins each side

export const rs = (n: number) => `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const qty = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 3 })
const day = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : format(d, 'dd MMM yyyy')
}
const present = <T,>(c: T | null | undefined | false): c is T => !!c

const rules: CustomTableLayout = {
  hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length ? 0.8 : 0.4),
  vLineWidth: () => 0,
  hLineColor: () => RULE,
  paddingLeft: () => 4,
  paddingRight: () => 4,
  paddingTop: () => 4,
  paddingBottom: () => 4,
}

const boxed: CustomTableLayout = {
  hLineWidth: () => 0.6,
  vLineWidth: () => 0.6,
  hLineColor: () => RULE,
  vLineColor: () => RULE,
  paddingLeft: () => 8,
  paddingRight: () => 8,
  paddingTop: () => 6,
  paddingBottom: () => 7,
}

function base(title: string, subject: string, createdAt: string, landscape = false): Omit<TDocumentDefinitions, 'content'> {
  const created = new Date(createdAt)
  return {
    pageSize: 'A4',
    pageOrientation: landscape ? 'landscape' : 'portrait',
    pageMargins: [40, 40, 40, 56],
    info: {
      title,
      subject,
      author: 'Vertex ERP',
      creator: 'Vertex ERP',
      producer: 'Vertex ERP',
      creationDate: Number.isNaN(created.getTime()) ? new Date(0) : created,
    },
    defaultStyle: { font: FONT_FAMILY, fontSize: 9, color: INK, lineHeight: 1.15 },
    styles: {
      label: { fontSize: 7, bold: true, color: MUTED, characterSpacing: 0.3 },
      h1: { fontSize: 15, bold: true },
      docTitle: { fontSize: 13, bold: true, color: ACCENT },
      muted: { fontSize: 8.5, color: MUTED },
      th: { fontSize: 8, bold: true, color: MUTED, fillColor: WASH },
    },
  }
}

function footer(note: string, width = A4_WIDTH) {
  return (currentPage: number, pageCount: number): Content => ({
    margin: [40, 18, 40, 0],
    columns: [
      { text: note, style: 'muted', width: width - 90 },
      { text: `Page ${currentPage} of ${pageCount}`, style: 'muted', alignment: 'right', width: 90 },
    ],
  })
}

function companyHeader(company: CompanySnapshot, title: string, meta: Array<[string, string]>): Content[] {
  const contact = [company.phone && `Phone ${company.phone}`, company.email].filter(Boolean).join('   ')
  return [
    {
      columnGap: 16,
      columns: [
        {
          width: '*',
          stack: (
            [
              { text: company.name || 'Company name not set', style: 'h1' },
              company.address ? { text: company.address, style: 'muted', margin: [0, 3, 0, 0] } : null,
              contact ? { text: contact, style: 'muted' } : null,
              company.gstin ? { text: `GSTIN ${company.gstin}`, style: 'muted' } : null,
            ] as Array<Content | null>
          ).filter(present),
        },
        {
          width: 215,
          stack: [
            { text: title, style: 'docTitle', alignment: 'right' },
            {
              margin: [0, 4, 0, 0],
              layout: 'noBorders',
              table: {
                widths: ['*', 'auto'],
                body: meta
                  .filter(([, v]) => v)
                  .map(([label, value]): TableCell[] => [
                    { text: label, style: 'muted', alignment: 'right' },
                    { text: value, bold: true, alignment: 'right' },
                  ]),
              },
            },
          ],
        },
      ],
    },
    { canvas: [{ type: 'line', x1: 0, y1: 4, x2: A4_WIDTH, y2: 4, lineWidth: 1.2, lineColor: ACCENT }], margin: [0, 4, 0, 10] },
  ]
}

function partyBoxes(left: { title: string; lines: string[] }, right: { title: string; lines: string[] }): ContentTable {
  const cell = (b: { title: string; lines: string[] }): TableCell => ({
    stack: [{ text: b.title.toUpperCase(), style: 'label', margin: [0, 0, 0, 3] }, ...b.lines.filter(Boolean).map((l) => ({ text: l }))],
  })
  return { layout: boxed, table: { widths: ['*', '*'], body: [[cell(left), cell(right)]] }, margin: [0, 0, 0, 10] }
}

function note(text: string, tone: 'plain' | 'warn' = 'plain'): ContentTable {
  return {
    margin: [0, 0, 0, 10],
    layout: 'noBorders',
    table: {
      widths: ['*'],
      body: [[{ text, fillColor: tone === 'warn' ? WARN_WASH : WASH, color: tone === 'warn' ? WARN : INK, margin: [6, 5, 6, 5] }]],
    },
  }
}

function totals(rows: Array<[string, string, boolean?]>, left: Content): Content {
  return {
    unbreakable: true,
    margin: [0, 10, 0, 0],
    columnGap: 16,
    columns: [
      { width: '*', stack: [left] },
      {
        width: 235,
        layout: 'noBorders',
        table: {
          widths: ['*', 'auto'],
          body: rows.map(([label, value, strong]): TableCell[] =>
            strong
              ? [
                  { text: label, bold: true, color: '#ffffff', fillColor: ACCENT, fontSize: 10, margin: [6, 4, 0, 4] },
                  { text: value, bold: true, color: '#ffffff', fillColor: ACCENT, fontSize: 10, alignment: 'right', margin: [0, 4, 6, 4] },
                ]
              : [
                  { text: label, margin: [6, 1.5, 0, 1.5] },
                  { text: value, alignment: 'right', margin: [0, 1.5, 6, 1.5] },
                ],
          ),
        },
      },
    ],
  }
}

function labelled(label: string, text: string | undefined | null): Content | null {
  if (!text || !text.trim()) return null
  return { unbreakable: true, margin: [0, 8, 0, 0], stack: [{ text: label.toUpperCase(), style: 'label' }, { text }] }
}

/* ---------------------------------- Invoice ------------------------------- */

export function invoiceDefinition(inv: Invoice): TDocumentDefinitions {
  const uom = inv.lines[0]?.uom ?? ''
  const partialText = inv.partial.isSingleFull
    ? `Full order quantity of ${qty(inv.partial.orderedQty)} ${uom} dispatched and billed in this single invoice.`
    : `Dispatch ${inv.partial.seq} against order ${inv.refs.orderCode}: ordered ${qty(inv.partial.orderedQty)}, previously dispatched ${qty(inv.partial.previouslyDispatched)}, this invoice ${qty(inv.partial.thisQty)}, balance ${qty(inv.partial.remainingAfter)}${inv.partial.isFinal ? ' — final dispatch, order fully billed.' : '.'}`

  const taxRows: Array<[string, string]> =
    inv.cgst !== null && inv.sgst !== null
      ? [
          [`CGST @ ${inv.cgstPct ?? inv.taxPct / 2}%`, rs(inv.cgst)],
          [`SGST @ ${inv.sgstPct ?? inv.taxPct / 2}%`, rs(inv.sgst)],
        ]
      : inv.igst !== null
        ? [[`IGST @ ${inv.taxPct}%`, rs(inv.igst)]]
        : [[`${inv.taxLabel} @ ${inv.taxPct}%`, rs(inv.taxAmount)]]

  const header: TableCell[] = ['#', 'Description', 'HSN', 'Qty', 'Unit', 'Rate', 'Amount'].map((h, i) => ({
    text: h,
    style: 'th',
    alignment: i >= 3 && i !== 4 ? 'right' : 'left',
  }))

  return {
    ...base(`Invoice ${inv.number}`, `${inv.customer.company} — ${inv.refs.orderCode}`, inv.createdAt),
    footer: footer(`${inv.number} · ${inv.refs.orderCode} · Computer-generated invoice`),
    content: (
      [
      ...companyHeader(inv.company, inv.taxPct > 0 ? 'TAX INVOICE' : 'INVOICE', [
        ['Invoice No.', inv.number],
        ['Invoice date', day(inv.issueDate)],
        ['Order', inv.refs.orderCode],
        ['Dispatch', `${inv.refs.dispatchCode} (#${inv.partial.seq})`],
        ['Customer ref.', inv.refs.customerRef],
      ]),
      partyBoxes(
        {
          title: 'Bill to',
          lines: [
            inv.customer.company,
            inv.customer.contactPerson ? `Attn: ${inv.customer.contactPerson}` : '',
            inv.customer.billingAddress,
            inv.customer.gstin ? `GSTIN ${inv.customer.gstin}` : '',
            inv.customer.placeOfSupply ? `Place of supply ${inv.customer.placeOfSupply}` : '',
            [inv.customer.phone, inv.customer.email].filter(Boolean).join('   '),
          ],
        },
        { title: 'Ship to', lines: [inv.customer.company, inv.deliveryAddress] },
      ),
      note(partialText),
      {
        layout: rules,
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: [14, '*', 40, 46, 30, 58, 70],
          body: [
            header,
            ...inv.lines.map((l, i): TableCell[] => [
              String(i + 1),
              { text: l.description },
              l.hsn,
              { text: qty(l.quantity), alignment: 'right' },
              l.uom,
              { text: rs(l.rate), alignment: 'right' },
              { text: rs(l.amount), alignment: 'right' },
            ]),
          ],
        },
      },
      totals(
        [
          ['Subtotal', rs(inv.subtotal)],
          ...(inv.discount > 0 ? ([['Less: discount', `− ${rs(inv.discount)}`]] as Array<[string, string]>) : []),
          ['Taxable value', rs(inv.taxableValue)],
          ...taxRows,
          ['Invoice total', rs(inv.total), true],
        ],
        { stack: [{ text: 'AMOUNT IN WORDS', style: 'label' }, { text: rupeesInWords(inv.total) }] },
      ),
      labelled('Transport', [inv.transporter && `Transporter: ${inv.transporter}`, inv.vehicleNo && `Vehicle: ${inv.vehicleNo}`].filter(Boolean).join('    ')),
      labelled('Dispatch notes', inv.notes),
      labelled('Payment terms', inv.paymentTerms),
      labelled('Bank details', inv.company.bankDetails),
      labelled('Terms', inv.company.invoiceTerms),
      {
        unbreakable: true,
        margin: [0, 22, 0, 0],
        stack: [
          { text: `For ${inv.company.name}`, bold: true, alignment: 'right' },
          { canvas: [{ type: 'line', x1: A4_WIDTH - 170, y1: 36, x2: A4_WIDTH, y2: 36, lineWidth: 0.6, lineColor: RULE }] },
          { text: 'Authorised signatory', style: 'muted', alignment: 'right', margin: [0, 3, 0, 0] },
        ],
      },
      ] as Array<Content | null>
    ).filter(present),
  }
}

/* ------------------------------- Purchase bill ---------------------------- */

/**
 * A supplier's bill as recorded here. Tax is worked out per line at that line's
 * GST rate and split CGST + SGST (same state) or IGST (other state).
 */
export function purchaseBillDefinition(bill: PurchaseBill, company: CompanySnapshot): TDocumentDefinitions {
  const t = purchaseTotals(bill, company.gstin)
  const header: TableCell[] = ['#', 'Description', 'HSN/SAC', 'Qty', 'Unit', 'Rate', 'GST %', 'Amount'].map((h, i) => ({
    text: h,
    style: 'th',
    alignment: i >= 3 && i !== 4 ? 'right' : 'left',
  }))
  const intra = t.supply === 'intra'
  const inter = t.supply === 'inter'
  const summaryHead = ['HSN/SAC', 'Taxable value', ...(intra ? ['CGST', 'SGST'] : inter ? ['IGST'] : ['GST']), 'Total tax'].map(
    (h, i): TableCell => ({ text: h, style: 'th', alignment: i === 0 ? 'left' : 'right' }),
  )
  const taxRows: Array<[string, string]> = intra
    ? [
        ['CGST', rs(t.cgst)],
        ['SGST', rs(t.sgst)],
      ]
    : inter
      ? [['IGST', rs(t.igst)]]
      : [['GST', rs(t.tax)]]

  return {
    ...base(`Purchase bill ${bill.code}`, bill.supplierName, bill.updatedAt),
    footer: footer(`${bill.code} · Purchase record${bill.supplierInvoiceNo ? ` of supplier invoice ${bill.supplierInvoiceNo}` : ''}`),
    content: (
      [
        ...companyHeader(company, 'PURCHASE BILL', [
          ['Entry No.', bill.code],
          ['Supplier invoice', bill.supplierInvoiceNo],
          ['Bill date', day(bill.date)],
        ]),
        partyBoxes(
          {
            title: 'Supplier',
            lines: [bill.supplierName, bill.supplierAddress, bill.supplierGstin ? `GSTIN ${bill.supplierGstin}` : ''],
          },
          { title: 'Buyer', lines: [company.name, company.address, company.gstin ? `GSTIN ${company.gstin}` : ''] },
        ),
        {
          layout: rules,
          table: {
            headerRows: 1,
            dontBreakRows: true,
            widths: [14, '*', 50, 44, 30, 54, 34, 66],
            body: [
              header,
              ...bill.lines.map((l, i): TableCell[] => [
                String(i + 1),
                { text: l.description },
                l.hsn,
                { text: qty(l.quantity), alignment: 'right' },
                l.uom,
                { text: rs(l.rate), alignment: 'right' },
                { text: `${l.gstPct}%`, alignment: 'right' },
                { text: rs(t.lines[i]?.amount ?? 0), alignment: 'right' },
              ]),
            ],
          },
        },
        {
          margin: [0, 10, 0, 0],
          layout: rules,
          table: {
            headerRows: 1,
            widths: ['*', 80, ...(intra ? [70, 70] : [80]), 80],
            body: [
              summaryHead,
              ...t.summary.map((g): TableCell[] => [
                `${g.hsn || '—'} @ ${g.gstPct}%`,
                { text: rs(g.taxable), alignment: 'right' },
                ...(intra
                  ? [
                      { text: rs(g.cgst), alignment: 'right' } as TableCell,
                      { text: rs(g.sgst), alignment: 'right' } as TableCell,
                    ]
                  : [{ text: rs(inter ? g.igst : g.tax), alignment: 'right' } as TableCell]),
                { text: rs(g.tax), alignment: 'right' },
              ]),
            ],
          },
        },
        totals(
          [
            ['Taxable value', rs(t.taxable)],
            ...taxRows,
            ...(bill.roundOff && t.roundOff !== 0 ? ([['Round off', `${t.roundOff > 0 ? '+' : '−'} ${rs(Math.abs(t.roundOff))}`]] as Array<[string, string]>) : []),
            ['Net amount', rs(t.net), true],
          ],
          { stack: [{ text: 'AMOUNT IN WORDS', style: 'label' }, { text: rupeesInWords(t.net) }] },
        ),
        t.supply === null ? note('GST split not decided: add both GSTINs, or choose "Within state" or "Other state" on the bill.', 'warn') : null,
        labelled('Notes', bill.notes),
      ] as Array<Content | null>
    ).filter(present),
  }
}

/* ------------------------ Cumulative invoice summary ---------------------- */

/**
 * Summary of the invoices already issued for one order, one row per confirmed
 * dispatch. Every figure is summed from the saved invoice snapshots, so historical
 * rates, rounding and fixed-charge allocation are kept exactly as issued.
 */
export function statementDefinition(
  order: ProductionOrder,
  st: ConsolidatedStatement,
  company: CompanySnapshot,
  generatedAt = new Date(),
  dispatches: Dispatch[] = [],
): TDocumentDefinitions {
  const header: TableCell[] = ['Invoice No.', 'Invoice date', 'Dispatch', 'Received on', 'Qty', 'Charges', 'Tax', 'Total'].map((h, i) => ({
    text: h,
    style: 'th',
    alignment: i >= 4 ? 'right' : 'left',
  }))
  const dispatchOf = (i: (typeof st.invoices)[number]) => dispatches.find((d) => d.id === i.dispatchId)
  const generated = format(generatedAt, 'dd MMM yyyy, hh:mm a')
  return {
    ...base(`Cumulative invoice summary ${order.code}`, order.customer.company, generatedAt.toISOString()),
    footer: footer(`${order.code} · Cumulative invoice summary · Not a tax invoice`),
    content: [
      ...companyHeader(company, 'CUMULATIVE INVOICE SUMMARY', [
        ['Order', order.code],
        ['Generated', generated],
        ['Customer ref.', order.customerRef],
      ]),
      note(
        `Summary of the ${st.invoices.length} invoice(s) listed below, issued against this order for shipments confirmed received. This is NOT a tax invoice and no additional amount is payable against this document — the total is the sum of the listed invoices.`,
        'warn',
      ),
      partyBoxes(
        { title: 'Customer', lines: [order.customer.company, order.customer.billingAddress, order.customer.gstin ? `GSTIN ${order.customer.gstin}` : ''] },
        {
          title: 'Order',
          lines: [
            `${order.productName}${order.dimensions ? ` — ${order.dimensions}` : ''}`,
            `Ordered ${qty(st.orderedQty)} ${order.uom}`,
            `Received and invoiced ${qty(st.invoicedQty)} ${order.uom} in ${st.invoices.length} shipment(s)`,
            `Not yet covered ${qty(st.remainingQty)} ${order.uom}`,
          ],
        },
      ),
      {
        layout: rules,
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: ['*', 56, 52, 58, 44, 62, 56, 64],
          body: [
            header,
            ...st.invoices.map((i): TableCell[] => [
              i.number,
              day(i.issueDate),
              i.refs.dispatchCode || `#${i.partial.seq}`,
              dispatchOf(i)?.receivedAt ? day(dispatchOf(i)!.receivedAt!.slice(0, 10)) : day(dispatchOf(i)?.date ?? i.issueDate),
              { text: qty(i.partial.thisQty), alignment: 'right' },
              { text: rs(i.taxableValue), alignment: 'right' },
              { text: rs(i.taxAmount), alignment: 'right' },
              { text: rs(i.total), alignment: 'right' },
            ]),
          ],
        },
      },
      totals(
        [
          ['Cumulative quantity', `${qty(st.invoicedQty)} ${order.uom}`],
          ['Charges before discount', rs(st.subtotal)],
          ...(st.discount ? ([['Discount', `− ${rs(st.discount)}`]] as Array<[string, string]>) : []),
          ['Taxable value', rs(st.taxableValue)],
          ['Tax', rs(st.taxAmount)],
          ['Total of listed invoices', rs(st.total), true],
          ['Order quantity not yet covered', `${qty(st.remainingQty)} ${order.uom}`],
        ],
        {
          stack: [
            { text: 'RECONCILIATION', style: 'label' },
            {
              text: st.fullyInvoiced
                ? st.reconciles
                  ? `The order is fully invoiced. Issued invoices total exactly the finalized order value of ${rs(st.orderGrandTotal)}.`
                  : `The order is fully invoiced but the invoices do not match the finalized order value of ${rs(st.orderGrandTotal)}. Please review.`
                : `${qty(st.remainingQty)} ${order.uom} remain to be dispatched and invoiced.`,
            },
            { text: `Generated ${generated} from the saved invoice records.`, style: 'muted', margin: [0, 6, 0, 0] },
          ],
        },
      ),
    ],
  }
}

/* ----------------------------- Monthly GST report -------------------------- */

const num = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pctText = (n: number | null) => (n === null ? '' : `${n}`)

/**
 * One Annexure-I register (purchases or sales) for a month, in the auditor's
 * layout with an added column naming the materials bought / products sold.
 */
export function gstReportDefinition(report: MonthlyGstReport, company: CompanySnapshot, kind: ReportKind, generatedAt = new Date()): TDocumentDefinitions {
  const reg: GstRegister = report[kind]
  const generated = format(generatedAt, 'dd MMM yyyy, hh:mm a')
  const r = (text: string, extra: Record<string, unknown> = {}): TableCell => ({ text, alignment: 'right', ...extra })
  const head: TableCell[] = ['Sl.', PARTY_HEAD[kind], ITEMS_HEAD[kind], 'Bill no / Date', 'GST TIN No', 'HSN/SAC', 'Goods amount', 'CGST %', 'CGST', 'SGST %', 'SGST', 'IGST', 'Total'].map((h, i) => ({
    text: h,
    style: 'th',
    alignment: i >= 6 ? 'right' : 'left',
  }))
  const totalRow = (label: string, x: { taxable: number; cgst: number; sgst: number; igst: number; gst: number; total: number }, fill?: string): TableCell[] => [
    { text: label, bold: true, colSpan: 6, alignment: 'right', fillColor: fill },
    '',
    '',
    '',
    '',
    '',
    r(num(x.taxable), { bold: true, fillColor: fill }),
    { text: '', fillColor: fill },
    r(num(x.cgst), { bold: true, fillColor: fill }),
    { text: '', fillColor: fill },
    r(num(x.sgst), { bold: true, fillColor: fill }),
    r(num(x.igst + x.gst), { bold: true, fillColor: fill }),
    r(num(x.total), { bold: true, fillColor: fill }),
  ]
  const body: TableCell[][] = [head]
  for (const s of reg.sections) {
    body.push([{ text: s.title, bold: true, colSpan: 13, margin: [0, 4, 0, 0] }, ...Array(12).fill('')])
    s.rows.forEach((x, i) =>
      body.push([
        String(i + 1),
        x.party,
        { text: x.items, fontSize: 7 },
        `${x.billNo}\n${day(x.date)}`,
        x.gstin,
        x.hsn,
        r(num(x.taxable)),
        r(pctText(x.cgstPct)),
        r(num(x.cgst)),
        r(pctText(x.sgstPct)),
        r(num(x.sgst)),
        r(x.igstPct !== null ? `${num(x.igst)}\n@ ${x.igstPct}%` : num(x.igst + x.gst)),
        r(num(x.total)),
      ]),
    )
    body.push(totalRow(`Total for ${s.title}`, s))
  }
  body.push(totalRow('Grand Total', reg, WASH))

  return {
    ...base(`${REPORT_TITLE[kind]} ${report.label}`, company.name, generatedAt.toISOString(), true),
    pageMargins: [30, 30, 30, 44],
    footer: footer(`Annexure-I · ${REPORT_TITLE[kind]} · ${report.label}`, 782),
    content: [
      { text: 'ANNEXURE-I', style: 'h1' },
      { text: company.name, bold: true },
      { text: `${REPORT_TITLE[kind]} during the month ${report.label}`, style: 'muted' },
      { text: `Generated ${generated}${company.gstin ? `  ·  GSTIN ${company.gstin}` : ''}`, style: 'muted', margin: [0, 0, 0, 8] },
      reg.sections.length
        ? { layout: rules, fontSize: 7.5, table: { headerRows: 1, dontBreakRows: true, widths: [16, 92, '*', 72, 72, 48, 56, 26, 48, 26, 48, 52, 58], body } }
        : note(`No ${kind === 'purchases' ? 'purchase bills' : 'sales invoices'} in ${report.label}.`),
    ],
  }
}

/* ------------------------------ Generic report ---------------------------- */

/** Any report table (e.g. the invoice report) as a landscape PDF with the same rows as its Excel file. */
export function reportTableDefinition(table: ReportTable, company: CompanySnapshot, generatedAt = new Date()): TDocumentDefinitions {
  const generated = format(generatedAt, 'dd MMM yyyy, hh:mm a')
  const full = 782
  // Numbers, dates and codes fit their content; names and items share the rest.
  const widths = table.columns.map((c) => (c.wrap ? '*' : 'auto'))
  const show = (v: CellValue, i: number): string => {
    if (v === null) return ''
    if (typeof v !== 'number') return /^\d{4}-\d{2}-\d{2}$/.test(v) ? day(v) : v
    const label = table.columns[i]?.label ?? ''
    return /qty|%/i.test(label) ? qty(v) : num(v)
  }
  const n = table.columns.length
  const body: TableCell[][] = [
    table.columns.map((c): TableCell => ({ text: c.label, style: 'th', alignment: c.numeric ? 'right' : 'left' })),
    ...table.rows.map((r): TableCell[] => {
      if (r.kind === 'section') return [{ text: String(r.cells[0] ?? ''), bold: true, colSpan: n, margin: [0, 4, 0, 0] }, ...Array(n - 1).fill('')]
      const fill = r.kind === 'grand' ? WASH : undefined
      return table.columns.map((c, i): TableCell => ({
        text: show(r.cells[i] ?? null, i),
        alignment: c.numeric ? 'right' : 'left',
        bold: r.kind !== 'row',
        fillColor: fill,
      }))
    }),
  ]
  return {
    ...base(table.heading[0] ?? table.name, company.name, generatedAt.toISOString(), true),
    pageMargins: [30, 30, 30, 44],
    footer: footer(`${table.heading.slice(0, 1).join('')} · ${table.heading[2] ?? ''}`, full),
    content: [
      { text: table.heading[0] ?? table.name, style: 'h1' },
      ...table.heading.slice(1).map((h, i): Content => (i === 0 ? { text: h, bold: true } : { text: h, style: 'muted' })),
      { text: `Generated ${generated}${company.gstin ? `  ·  GSTIN ${company.gstin}` : ''}`, style: 'muted', margin: [0, 0, 0, 8] },
      table.rows.length > 1
        ? { layout: rules, fontSize: 7, table: { headerRows: 1, dontBreakRows: true, widths, body } }
        : note('Nothing recorded in this month.'),
    ],
  }
}

/* -------------------------------- Work list ------------------------------- */

export function workListDefinition(rows: ProcessWorkRow[], meta: { title: string; scope: string; unitName: (id: string) => string }, generatedAt = new Date()): TDocumentDefinitions {
  const widths = [52, 58, '*', '*', '*', 60, 120, 64, 60]
  const header: TableCell[] = ['Unit', 'Job', 'Customer', 'Product', 'Stage', 'Qty', 'Planned window', 'Status', 'Sign'].map((h) => ({ text: h, style: 'th' }))
  return {
    ...base(meta.title, meta.scope, generatedAt.toISOString(), true),
    pageMargins: [30, 34, 30, 48],
    footer: footer('Vertex ERP · Production work list', 782 - 60),
    content: [
      { text: meta.title, style: 'h1' },
      { text: `${meta.scope} · ${rows.length} process(es) · generated ${format(generatedAt, 'dd MMM yyyy, hh:mm a')}`, style: 'muted', margin: [0, 2, 0, 10] },
      {
        layout: rules,
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths,
          body: [
            header,
            ...rows.map((r): TableCell[] => [
              meta.unitName(r.process.unitId),
              r.order.code,
              r.order.customer.company,
              r.order.productName,
              `${r.stage.index + 1}.${r.process.index + 1} ${r.process.name} — ${r.stage.name}${r.ready ? '' : ' (waiting)'}`,
              `${qty(r.order.quantity)} ${r.order.uom}`,
              `${format(new Date(r.process.plannedStart), 'dd MMM hh:mm a')} – ${format(new Date(r.process.plannedEnd), 'dd MMM hh:mm a')}`,
              r.process.status,
              '',
            ]),
          ],
        },
      },
    ],
  }
}
