import { useId, useMemo, useRef, useState } from 'react'
import { Boxes, Check, Plus, Search } from 'lucide-react'
import { useStore } from '../../../store/store'
import type { LengthUnit, Material, MaterialKind, ProductMaterial, ProductStage, PricingBasis } from '../../../lib/types'
import type { MaterialDraft } from '../../../domain/master'
import { blankMaterialDraft, saveMaterial } from '../../../domain/master'
import { PRICING_BASIS_LABEL } from '../../../lib/costing'
import { calculateYield, fromMm, toMm } from '../../../lib/yield'
import { cx } from '../../../lib/format'
import { Button, Field, Input, Modal, Select } from '../../../components/ui'
import { NumberInput, focusFirstInvalid } from '../../../components/page'

/* ---------------------------------------------------------------------------
 * Add a material to a product, in one place:
 *   • an EXISTING material (search by typing, or pick from the list): it is
 *     already set up, so only how THIS product uses it is asked — stage /
 *     process, cut size and pieces (sheet) or quantity per piece;
 *   • a NEW material: its one-time setup (price, sheet size, wastage, …) AND
 *     how this product uses it, then it is created and added together.
 * Nothing has to be finished somewhere else afterwards.
 * ------------------------------------------------------------------------- */

export type UsageInput = Pick<ProductMaterial, 'stageId' | 'processId' | 'cutLengthMm' | 'cutWidthMm' | 'piecesPerProduct' | 'qtyPerPiece' | 'rotationAllowed'>

const blankUsage = (): UsageInput => ({ stageId: null, processId: null, cutLengthMm: null, cutWidthMm: null, piecesPerProduct: 1, qtyPerPiece: null, rotationAllowed: true })

/**
 * `mode="product"` (default): pick or create, plus how the product uses it.
 * `mode="registry"` (Master → Materials): create a material on its own — only its setup is asked.
 */
export function AddMaterialDialog({
  open,
  stages = [],
  mode = 'product',
  onClose,
  onAdd,
}: {
  open: boolean
  stages?: ProductStage[]
  mode?: 'product' | 'registry'
  onClose: () => void
  onAdd: (m: Material, usage: UsageInput) => void
}) {
  const registry = mode === 'registry'
  const { db, run, pushToast } = useStore()
  const listId = useId()
  const searchRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [listOpen, setListOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [picked, setPicked] = useState<Material | null>(null)
  const [creating, setCreating] = useState(registry)
  const [mat, setMat] = useState<MaterialDraft>(() => blankMaterialDraft('sheet'))
  const [usage, setUsage] = useState<UsageInput>(blankUsage)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const term = query.trim().toLowerCase()
  const options = useMemo(
    () => db.materials.filter((m) => m.active && (!term || m.name.toLowerCase().includes(term) || m.code.toLowerCase().includes(term))).slice(0, 60),
    [db.materials, term],
  )
  const exact = db.materials.some((m) => m.name.trim().toLowerCase() === term)

  const reset = () => {
    setQuery('')
    setListOpen(false)
    setActive(0)
    setPicked(null)
    setCreating(registry)
    setMat(blankMaterialDraft('sheet'))
    setUsage(blankUsage())
    setErrors({})
  }
  const close = () => {
    reset()
    onClose()
  }
  const choose = (m: Material) => {
    setPicked(m)
    setCreating(false)
    setQuery(m.name)
    setListOpen(false)
  }
  const startNew = () => {
    setPicked(null)
    setCreating(true)
    setListOpen(false)
    setMat({ ...blankMaterialDraft('sheet'), name: query.trim() })
  }

  const kind: MaterialKind | null = picked ? picked.kind : creating ? mat.kind : null
  const unit: LengthUnit = picked ? picked.sizeUnit : mat.sizeUnit
  const sheet = picked ?? (creating ? { sheetLengthMm: mat.sheetLengthMm, sheetWidthMm: mat.sheetWidthMm, edgeMarginMm: mat.edgeMarginMm, cutGapMm: mat.cutGapMm } : null)
  const fit =
    kind === 'sheet' && sheet?.sheetLengthMm && sheet.sheetWidthMm && usage.cutLengthMm && usage.cutWidthMm
      ? calculateYield({
          sheetLengthMm: sheet.sheetLengthMm,
          sheetWidthMm: sheet.sheetWidthMm,
          cutLengthMm: usage.cutLengthMm,
          cutWidthMm: usage.cutWidthMm,
          edgeMarginMm: sheet.edgeMarginMm,
          cutGapMm: sheet.cutGapMm,
          rotationAllowed: usage.rotationAllowed,
        })
      : null

  const finish = async () => {
    if (busy) return
    if (picked) {
      onAdd(picked, usage)
      pushToast({ title: `${picked.name} added`, level: 'success' })
      return close()
    }
    if (!creating) return void searchRef.current?.focus()
    setBusy(true)
    try {
      const r = await run(saveMaterial({ ...mat, name: mat.name.trim() }))
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {})
        focusFirstInvalid()
        return
      }
      onAdd(r.value, usage)
      pushToast({ title: registry ? `${r.value.name} created` : `${r.value.name} created and added`, message: r.value.price === null ? 'Its price can be added later.' : undefined, level: 'success' })
      close()
    } finally {
      setBusy(false)
    }
  }

  const setM = (patch: Partial<MaterialDraft>) => setMat((d) => ({ ...d, ...patch }))
  const setU = (patch: Partial<UsageInput>) => setUsage((u) => ({ ...u, ...patch }))
  const stage = stages.find((s) => s.id === usage.stageId)
  const mm = (v: number | null, u: LengthUnit) => (v === null ? null : Number.isNaN(v) ? NaN : toMm(v, u))

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      pinnedFooter
      title={registry ? 'New material' : 'Add material'}
      subtitle={registry ? 'Set it up once — price, sheet size, wastage. Products can then use it.' : 'Choose an existing material, or create a new one — everything is asked here.'}
      icon={<Boxes className="h-5 w-5" />}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button icon={<Check className="h-4 w-4" />} loading={busy} onClick={() => void finish()}>
            {registry ? 'Create material' : creating ? 'Create & add to product' : 'Add to product'}
          </Button>
        </>
      }
    >
      <div className="space-y-5 text-sm">
        {/* 1. Which material */}
        {registry ? null : creating ? (
          <button
            type="button"
            className="vx-focus rounded-xs text-sm font-medium text-accent-text hover:underline"
            onClick={() => {
              setCreating(false)
              setListOpen(true)
              searchRef.current?.focus()
            }}
          >
            ← Choose an existing material instead
          </button>
        ) : (
        <div className="relative">
          <Field label="Material" required hint="Type to search, or click to see the whole list.">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden="true" />
              <Input
                ref={searchRef}
                role="combobox"
                aria-expanded={listOpen}
                aria-controls={listId}
                aria-autocomplete="list"
                autoComplete="off"
                spellCheck={false}
                className="pl-9"
                value={query}
                placeholder="e.g. Duplex board 350…"
                onFocus={() => setListOpen(true)}
                onClick={() => setListOpen(true)}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setListOpen(true)
                  setActive(0)
                  if (picked) setPicked(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setListOpen(true)
                    setActive((i) => Math.min(i + 1, options.length))
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setActive((i) => Math.max(i - 1, 0))
                  } else if (e.key === 'Enter' && listOpen) {
                    e.preventDefault()
                    if (options[active]) choose(options[active])
                    else startNew()
                  } else if (e.key === 'Escape' && listOpen) {
                    e.stopPropagation()
                    setListOpen(false)
                  }
                }}
              />
            </div>
          </Field>
          {listOpen ? (
            <ul id={listId} role="listbox" className="absolute inset-x-0 top-[4.25rem] z-10 max-h-64 overflow-y-auto overscroll-contain rounded-md border border-rule-2 bg-surface shadow-lg">
              {options.map((m, i) => (
                <li
                  key={m.id}
                  role="option"
                  aria-selected={i === active}
                  className={cx('flex cursor-pointer items-center justify-between gap-3 px-3 py-2', i === active ? 'bg-accent-wash' : 'hover:bg-surface-2')}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    choose(m)
                  }}
                >
                  <span className="min-w-0 truncate text-ink">{m.name}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {m.kind === 'sheet' ? 'sheet' : m.uom} · {m.price === null ? 'no price yet' : `₹${m.price}`}
                  </span>
                </li>
              ))}
              {!exact ? (
                <li
                  role="option"
                  aria-selected={active === options.length}
                  className={cx('flex cursor-pointer items-center gap-2 border-t border-rule px-3 py-2 font-medium text-accent-text', active === options.length ? 'bg-accent-wash' : 'hover:bg-surface-2')}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    startNew()
                  }}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {query.trim() ? `Create new material “${query.trim()}”` : 'Create a new material…'}
                </li>
              ) : null}
              {!options.length && !query.trim() ? <li className="px-3 py-2 text-muted">No materials yet.</li> : null}
            </ul>
          ) : null}
        </div>

        )}

        {!registry && !creating ? (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-dashed border-rule-2 px-3 py-2.5">
            <span className="text-muted">Not in the list?</span>
            <Button size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />} onClick={startNew}>
              Create a new material{query.trim() && !exact && !picked ? ` “${query.trim()}”` : ''}
            </Button>
          </div>
        ) : null}

        {picked ? (
          <p className="rounded-md bg-ok-wash px-3 py-2 text-ok ring-1 ring-inset ring-ok-edge">
            {picked.name} is already set up ({picked.kind === 'sheet' ? `sheet ${picked.sheetLengthMm ?? '?'} × ${picked.sheetWidthMm ?? '?'} mm` : picked.uom}
            {picked.price !== null ? `, ₹${picked.price}` : ', price not set yet'}). Only tell how this product uses it.
          </p>
        ) : null}

        {/* 2. New material: its one-time setup */}
        {creating ? (
          <fieldset className="rounded-md border border-rule-2 p-4">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">New material — set up once</legend>
            <div className="grid gap-x-4 sm:grid-cols-2">
              <Field label="Name" required error={errors.name} className="sm:col-span-2">
                <Input value={mat.name} onChange={(e) => setM({ name: e.target.value })} aria-invalid={!!errors.name || undefined} autoComplete="off" />
              </Field>
              <Field label="Type" as="div" className="sm:col-span-2">
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Material type">
                  {(
                    [
                      ['sheet', 'Sheet (board, paper)', 'Cut into pieces from a sheet'],
                      ['quantity', 'Quantity (glue, film, ribbon…)', 'Used by weight, length or count'],
                    ] as Array<[MaterialKind, string, string]>
                  ).map(([k, label, hint]) => (
                    <label key={k} className={cx('flex flex-1 cursor-pointer items-start gap-2 rounded-md border px-3 py-2.5', mat.kind === k ? 'border-accent bg-accent-wash' : 'border-rule-2 hover:bg-surface-2')}>
                      <input type="radio" name="new-material-kind" className="mt-1 accent-[var(--color-accent)]" checked={mat.kind === k} onChange={() => setMat({ ...blankMaterialDraft(k), name: mat.name, price: mat.price, supplier: mat.supplier })} />
                      <span>
                        <span className="block font-medium text-ink">{label}</span>
                        <span className="block text-xs text-muted">{hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </Field>
              {mat.kind === 'sheet' ? (
                <Field label="Sheet size L × W" as="div" error={errors.sheetLengthMm ?? errors.sheetWidthMm} className="sm:col-span-2">
                  <div className="flex gap-2">
                    <NumberInput aria-label="Sheet length" value={fromMm(mat.sheetLengthMm, mat.sizeUnit)} onChange={(v) => setM({ sheetLengthMm: mm(v, mat.sizeUnit) })} placeholder="Length" />
                    <NumberInput aria-label="Sheet width" value={fromMm(mat.sheetWidthMm, mat.sizeUnit)} onChange={(v) => setM({ sheetWidthMm: mm(v, mat.sizeUnit) })} placeholder="Width" />
                    <Select aria-label="Size unit" value={mat.sizeUnit} onChange={(e) => setM({ sizeUnit: e.target.value as LengthUnit })} className="w-24">
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                      <option value="in">inch</option>
                    </Select>
                  </div>
                </Field>
              ) : (
                <Field label="Unit" required error={errors.uom}>
                  <Input value={mat.uom} onChange={(e) => setM({ uom: e.target.value })} aria-invalid={!!errors.uom || undefined} placeholder="kg, mtr, nos…" />
                </Field>
              )}
              <Field label={`Price ₹ per ${mat.kind === 'sheet' ? 'sheet' : mat.uom || 'unit'}`} error={errors.price} hint="Blank if not known yet.">
                <NumberInput value={mat.price} onChange={(v) => setM({ price: v })} invalid={!!errors.price} />
              </Field>
              {mat.kind === 'sheet' ? (
                <Field label="Pricing basis" error={errors.pricingBasis}>
                  <Select value={mat.pricingBasis} onChange={(e) => setM({ pricingBasis: e.target.value as PricingBasis })}>
                    {(['per_unit', 'per_kg', 'per_pack'] as PricingBasis[]).map((b) => (
                      <option key={b} value={b}>
                        {b === 'per_unit' ? 'Per sheet' : PRICING_BASIS_LABEL[b]}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
              {mat.pricingBasis === 'per_kg' ? (
                <Field label="GSM" error={errors.gsm}>
                  <NumberInput value={mat.gsm} onChange={(v) => setM({ gsm: v })} invalid={!!errors.gsm} />
                </Field>
              ) : null}
              {mat.pricingBasis === 'per_pack' ? (
                <Field label="Sheets in one pack" error={errors.packSize}>
                  <NumberInput value={mat.packSize} onChange={(v) => setM({ packSize: v })} invalid={!!errors.packSize} />
                </Field>
              ) : null}
              <Field label="Wastage %" error={errors.wastagePct}>
                <NumberInput value={mat.wastagePct} onChange={(v) => setM({ wastagePct: v ?? 0 })} invalid={!!errors.wastagePct} />
              </Field>
              <Field label="Buy in multiples of" error={errors.purchaseMultiple} hint={mat.kind === 'sheet' ? 'sheets' : mat.uom || 'units'}>
                <NumberInput value={mat.purchaseMultiple} onChange={(v) => setM({ purchaseMultiple: v ?? 1 })} invalid={!!errors.purchaseMultiple} />
              </Field>
              {mat.kind === 'sheet' ? (
                <>
                  <Field label={`Edge allowance (${mat.sizeUnit})`} error={errors.edgeMarginMm} hint="Kept clear on all 4 edges.">
                    <NumberInput value={fromMm(mat.edgeMarginMm, mat.sizeUnit)} onChange={(v) => setM({ edgeMarginMm: v === null ? 0 : (mm(v, mat.sizeUnit) ?? 0) })} invalid={!!errors.edgeMarginMm} />
                  </Field>
                  <Field label={`Cutting gap (${mat.sizeUnit})`} error={errors.cutGapMm} hint="Between pieces.">
                    <NumberInput value={fromMm(mat.cutGapMm, mat.sizeUnit)} onChange={(v) => setM({ cutGapMm: v === null ? 0 : (mm(v, mat.sizeUnit) ?? 0) })} invalid={!!errors.cutGapMm} />
                  </Field>
                </>
              ) : null}
              <Field label="Supplier" className="sm:col-span-2">
                <Input value={mat.supplier} onChange={(e) => setM({ supplier: e.target.value })} autoComplete="organization" />
              </Field>
            </div>
          </fieldset>
        ) : null}

        {/* 3. How this product uses it */}
        {registry ? null : kind ? (
          <fieldset className="rounded-md border border-rule-2 p-4">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">In this product</legend>
            <div className="grid gap-x-4 sm:grid-cols-2">
              <Field label="Used in stage" hint="Optional">
                <Select value={usage.stageId ?? ''} onChange={(e) => setU({ stageId: e.target.value || null, processId: null })}>
                  <option value="">Whole product</option>
                  {stages.map((s, i) => (
                    <option key={s.id} value={s.id}>
                      {s.name.trim() || `Stage ${i + 1}`}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Process" hint="Optional">
                <Select value={usage.processId ?? ''} onChange={(e) => setU({ processId: e.target.value || null })} disabled={!stage}>
                  <option value="">{stage ? 'Any process of this stage' : 'Choose a stage first'}</option>
                  {stage?.processes.map((p, i) => (
                    <option key={p.id} value={p.id}>
                      {p.name.trim() || `Process ${i + 1}`}
                    </option>
                  ))}
                </Select>
              </Field>
              {kind === 'sheet' ? (
                <>
                  <Field label={`Cut piece size L × W (${unit})`} as="div">
                    <div className="flex gap-2">
                      <NumberInput aria-label="Cut length" value={fromMm(usage.cutLengthMm, unit)} onChange={(v) => setU({ cutLengthMm: mm(v, unit) })} placeholder="Length" />
                      <NumberInput aria-label="Cut width" value={fromMm(usage.cutWidthMm, unit)} onChange={(v) => setU({ cutWidthMm: mm(v, unit) })} placeholder="Width" />
                    </div>
                  </Field>
                  <Field label="Pieces per product" hint="Usually 1.">
                    <NumberInput value={usage.piecesPerProduct} onChange={(v) => setU({ piecesPerProduct: v })} placeholder="1" />
                  </Field>
                  <label className="flex cursor-pointer items-center gap-2 py-1 text-ink-2 sm:col-span-2">
                    <input type="checkbox" className="h-4 w-4 accent-[var(--color-accent)]" checked={usage.rotationAllowed} onChange={(e) => setU({ rotationAllowed: e.target.checked })} />
                    The piece may be turned on the sheet
                  </label>
                  <p className="text-ink-2 sm:col-span-2" aria-live="polite">
                    {fit ? (fit.error ?? `${fit.ups} pieces fit on one sheet · ${fit.yieldPct.toFixed(0)}% of the sheet used`) : 'Enter the sheet size and the cut piece size to see how many fit on one sheet.'}
                  </p>
                </>
              ) : (
                <Field label={`Quantity per piece (${picked?.uom ?? mat.uom ?? 'unit'})`} hint="e.g. 0.003 kg of glue per box.">
                  <NumberInput value={usage.qtyPerPiece} onChange={(v) => setU({ qtyPerPiece: v })} />
                </Field>
              )}
            </div>
          </fieldset>
        ) : (
          <p className="text-muted">Choose a material above, or type a new name and pick “Create new material”.</p>
        )}
      </div>
    </Modal>
  )
}
