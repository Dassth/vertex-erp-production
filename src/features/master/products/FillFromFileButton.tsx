import { useRef, useState } from 'react'
import { FileUp } from 'lucide-react'
import { useStore } from '../../../store/store'
import type { Product } from '../../../lib/types'
import { fillProductFromFile } from '../../../domain/imports'
import { readFileTable } from '../../../lib/fileTable'
import { isProductHeading, readProductSheet } from '../../../lib/productSheet'
import type { SheetProduct } from '../../../lib/productSheet'
import { Button, Modal } from '../../../components/ui'

/* ---------------------------------------------------------------------------
 * A saved product → "Fill missing from file…": the file's rows for this
 * product fill only what is still empty here (times, rates, prices, sizes,
 * missing processes and materials). Nothing already entered is changed.
 * ------------------------------------------------------------------------- */

export function FillFromFileButton({ product, dirty }: { product: Product; dirty: boolean }) {
  const { run, pushToast } = useStore()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [choices, setChoices] = useState<{ fileName: string; products: SheetProduct[] } | null>(null)

  const fill = async (sheet: SheetProduct, fileName: string) => {
    setChoices(null)
    setBusy(true)
    try {
      const r = await run(fillProductFromFile(product.id, sheet, fileName))
      if (!r.ok) return pushToast({ title: 'Nothing filled', message: r.error, level: 'danger' })
      const { filled, added, kept } = r.value
      pushToast(
        filled || added
          ? {
              title: `${filled} detail(s) filled${added ? `, ${added} added` : ''}`,
              message: `From ${fileName}.${kept ? ` ${kept} value(s) in the file differ from what is saved here — the saved ones were kept.` : ''}`,
              level: 'success',
            }
          : { title: 'Nothing to fill', message: `${product.name} already has every detail ${fileName} gives.`, level: 'info' },
      )
    } finally {
      setBusy(false)
    }
  }

  const read = async (file: File) => {
    setBusy(true)
    try {
      const table = await readFileTable(file, isProductHeading)
      const sheet = readProductSheet(table.rows, file.name)
      const same = sheet.products.find((p) => p.name.trim().toLowerCase() === product.name.trim().toLowerCase())
      if (same) return void (await fill(same, file.name))
      if (sheet.products.length === 1) return void (await fill(sheet.products[0], file.name))
      // Several products and none with this name: let the person pick the right one.
      setChoices({ fileName: file.name, products: sheet.products })
    } catch (e) {
      pushToast({ title: 'File not read', message: e instanceof Error ? e.message : 'This file could not be read.', level: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-label="File with this product's details"
        accept=".xlsx,.xlsm,.xls,.csv,.tsv,.txt,.pdf"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void read(f)
          e.target.value = ''
        }}
      />
      <Button
        variant="secondary"
        icon={<FileUp className="h-4 w-4" />}
        loading={busy}
        onClick={() =>
          dirty
            ? pushToast({ title: 'Save first', message: 'Save draft (or discard) the changes on this screen, then fill from the file.', level: 'warn' })
            : input.current?.click()
        }
      >
        Fill missing from file…
      </Button>
      <Modal
        open={!!choices}
        onClose={() => setChoices(null)}
        size="sm"
        title="Which product in the file?"
        subtitle={`${choices?.fileName ?? ''} has no product named “${product.name}”. Choose the one to take the missing details from.`}
        icon={<FileUp className="h-5 w-5" />}
        footer={
          <Button variant="secondary" onClick={() => setChoices(null)}>
            Cancel
          </Button>
        }
      >
        <div className="grid max-h-80 gap-2 overflow-y-auto overscroll-contain">
          {choices?.products.map((p, i) => (
            <Button key={i} variant="secondary" onClick={() => void fill(p, choices.fileName)}>
              {p.name || '(no name)'} · {p.processes.length} process(es), {p.materials.length} material(s)
            </Button>
          ))}
        </div>
      </Modal>
    </>
  )
}
