import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Download, FileUp, FolderOpen, TriangleAlert } from 'lucide-react'
import { useStore } from '../../../store/store'
import { importProductsFromFile } from '../../../domain/imports'
import type { FileImportResult } from '../../../domain/imports'
import { readFileTable } from '../../../lib/fileTable'
import { isProductHeading, readProductSheet, TEMPLATE_EXAMPLE } from '../../../lib/productSheet'
import type { SheetReading } from '../../../lib/productSheet'
import { downloadProductSheet } from '../../../lib/productSheetFile'
import { Button, Modal } from '../../../components/ui'

/* ---------------------------------------------------------------------------
 * Master → Products → Add from file. Excel, CSV or PDF: what the file gives
 * is shown first (found / missing per product), then added. Missing details
 * never stop anything — costing lists them later with a link to fill them.
 * ------------------------------------------------------------------------- */

function downloadTemplate() {
  downloadProductSheet('Vertex-product-sheet.xlsx', TEMPLATE_EXAMPLE.map((r) => r.map((c) => (c !== '' && /^-?\d+(\.\d+)?$/.test(c) ? Number(c) : c))))
}

export function AddFromFileDialog({ onClose }: { onClose: () => void }) {
  const { db, run, pushToast } = useStore()
  const input = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [reading, setReading] = useState(false)
  const [error, setError] = useState('')
  const [sheet, setSheet] = useState<SheetReading | null>(null)
  const [names, setNames] = useState<string[]>([])
  const [include, setInclude] = useState<boolean[]>([])
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<FileImportResult | null>(null)

  const read = async (file: File) => {
    setReading(true)
    setError('')
    setSheet(null)
    setResult(null)
    setFileName(file.name)
    try {
      const table = await readFileTable(file, isProductHeading)
      const r = readProductSheet(table.rows, file.name)
      if (!r.products.length) throw new Error('No products were found in this file.')
      setSheet(r)
      setNames(r.products.map((p) => p.name))
      setInclude(r.products.map(() => true))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This file could not be read.')
    } finally {
      setReading(false)
    }
  }

  const chosen = sheet ? sheet.products.map((p, i) => ({ ...p, name: names[i].trim() })).filter((_, i) => include[i]) : []
  // Products already in Master are not added again: only their empty details are filled.
  const existingOf = (name: string) => db.products.find((x) => x.name.trim().toLowerCase() === name.trim().toLowerCase())
  const toFill = chosen.filter((p) => existingOf(p.name)).length
  const toAdd = chosen.length - toFill
  const actionLabel = [toAdd ? `Add ${toAdd} new` : '', toFill ? `Fill ${toFill} existing` : ''].filter(Boolean).join(' · ')

  const add = async () => {
    if (busy || !chosen.length) return
    setBusy(true)
    try {
      const r = await run(importProductsFromFile(chosen, fileName))
      if (!r.ok) {
        setError(r.error)
        pushToast({ title: 'Products not added', message: r.error, level: 'danger' })
        return
      }
      setResult(r.value)
      pushToast({
        title: [r.value.created.length ? `${r.value.created.length} added` : '', r.value.updated.length ? `${r.value.updated.length} filled in` : ''].filter(Boolean).join(', ') || 'Nothing to fill',
        message: r.value.created.length || r.value.updated.length ? 'Anything still missing shows in costing with a link to fill it.' : 'Every product in the file already has these details.',
        level: r.value.created.length || r.value.updated.length ? 'success' : 'info',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      pinnedFooter
      size="lg"
      title="Add or fill products from a file"
      subtitle="Excel, CSV or PDF. New products are added; for products already in Master only the empty details are filled — nothing entered is changed."
      icon={<FileUp className="h-5 w-5" />}
      footer={
        result ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button icon={<CheckCircle2 className="h-4 w-4" />} loading={busy} onClick={() => (chosen.length ? void add() : input.current?.click())}>
              {chosen.length ? actionLabel : 'Choose a file…'}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4 text-sm">
        <input
          ref={input}
          type="file"
          className="sr-only"
          tabIndex={-1}
          aria-label="Product file"
          accept=".xlsx,.xlsm,.xls,.csv,.tsv,.txt,.pdf"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void read(f)
            e.target.value = ''
          }}
        />

        {!result ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant={sheet ? 'secondary' : 'primary'} icon={<FolderOpen className="h-4 w-4" />} loading={reading} onClick={() => input.current?.click()}>
              {sheet ? 'Choose another file…' : 'Choose file…'}
            </Button>
            <span className="min-w-0 truncate text-ink-2">{fileName || 'Excel (.xlsx), CSV or PDF'}</span>
            <button type="button" onClick={downloadTemplate} className="vx-focus ml-auto inline-flex items-center gap-1.5 rounded-xs font-medium text-accent-text hover:underline">
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Download the Vertex product sheet
            </button>
          </div>
        ) : null}

        {!sheet && !result && !error ? (
          <p className="rounded-md bg-surface-2 px-3 py-2.5 text-ink-2">
            Best result: fill the <strong>Vertex product sheet</strong> in Excel (one row per process or material) and add it here. Any other Excel, CSV or PDF with a table also works — columns such as Product, Process, Material, Rate or Size are recognised by their headings. A scanned PDF (a photo) cannot be read.
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-md bg-risk-wash px-3 py-2 text-risk ring-1 ring-inset ring-risk-edge">
            {error}
          </p>
        ) : null}

        {sheet && !result ? (
          <>
            <div className="rounded-md bg-surface-2 px-3 py-2.5 text-xs text-ink-2">
              {sheet.understood.length ? (
                <p>
                  <span className="font-medium text-ink">Columns read:</span> {sheet.understood.map((u) => (u.heading === u.as ? u.as : `${u.heading} → ${u.as}`)).join(' · ')}
                </p>
              ) : (
                <p>No column headings were recognised: the file is added as one product named after the file, with its text in the description.</p>
              )}
              {sheet.ignored.length ? <p className="mt-1">Not used: {sheet.ignored.join(' · ')}</p> : null}
            </div>
            <ul className="space-y-3">
              {sheet.products.map((p, i) => (
                <li key={i} className="rounded-md border border-rule-2 p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 py-1">
                      <input type="checkbox" className="h-4 w-4" checked={include[i]} onChange={(e) => setInclude((xs) => xs.map((x, j) => (j === i ? e.target.checked : x)))} />
                      <span className="sr-only">Add this product</span>
                    </label>
                    <input
                      className="vx-input min-w-0 flex-1 text-base font-medium sm:text-sm"
                      aria-label="Product name"
                      value={names[i]}
                      onChange={(e) => setNames((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))}
                    />
                    <span className="text-xs text-muted tabular-nums">
                      {p.processes.length} process{p.processes.length === 1 ? '' : 'es'} · {p.materials.length} material{p.materials.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  {existingOf(names[i]) ? (
                    <p className="mt-2 rounded-xs bg-accent-wash px-2 py-1 text-xs text-accent-text">
                      Already in Master ({existingOf(names[i])!.code}) — only its empty details are filled from this file. Its name and everything already entered stay as they are.
                    </p>
                  ) : null}
                  {p.processes.length || p.materials.length ? (
                    <p className="mt-2 flex gap-1.5 text-xs text-ok">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 break-words">
                        {[...p.processes.map((x) => x.name), ...p.materials.map((m) => m.name)].slice(0, 8).join(' · ')}
                        {p.processes.length + p.materials.length > 8 ? ' · …' : ''}
                      </span>
                    </p>
                  ) : null}
                  {existingOf(names[i]) ? null : p.missing.length ? (
                    <ul className="mt-2 space-y-0.5 text-xs text-warn" aria-label="Not in the file">
                      {p.missing.map((m) => (
                        <li key={m} className="flex gap-1.5">
                          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>{m}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-ok">Complete — nothing missing.</p>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted">Missing details do not stop anything: you can plan and cost straight away. Costing shows each missing detail with a link to where it is filled in.</p>
          </>
        ) : null}

        {result ? (
          <div className="space-y-3">
            <p className="rounded-md bg-ok-wash px-3 py-2 text-ok ring-1 ring-inset ring-ok-edge" role="status">
              {result.created.length} product(s) added, {result.updated.length} filled in{result.materialsCreated.length ? `, ${result.materialsCreated.length} new material(s)` : ''}.
              {result.unchanged.length ? ` ${result.unchanged.length} already had everything the file gives.` : ''}
            </p>
            <ul className="space-y-1">
              {result.created.map((c) => (
                <li key={c.id}>
                  <Link className="vx-focus rounded-xs font-medium text-accent-text hover:underline" to={`/master/products/${c.id}`} onClick={onClose}>
                    {c.code} — {c.name}
                  </Link>
                </li>
              ))}
            </ul>
            {result.updated.length ? (
              <ul className="space-y-1">
                {result.updated.map((c) => (
                  <li key={c.id}>
                    <Link className="vx-focus rounded-xs font-medium text-accent-text hover:underline" to={`/master/products/${c.id}`} onClick={onClose}>
                      {c.code} — {c.name}
                    </Link>
                    <span className="text-xs text-muted">
                      {' '}
                      · {c.filled} detail(s) filled{c.added ? `, ${c.added} added` : ''}
                      {c.kept ? ` · ${c.kept} different value(s) in the file ignored — the saved ones were kept` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {result.skipped.length ? (
              <ul className="space-y-1 text-warn">
                {result.skipped.map((s) => (
                  <li key={s.name}>
                    {s.name}: {s.reason}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="text-ink-2">
              Next: <Link className="vx-focus rounded-xs font-medium text-accent-text hover:underline" to="/planning" onClick={onClose}>make a plan</Link> — costing will list anything still missing, with a link to fill it.
            </p>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
