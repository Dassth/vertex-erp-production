import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Info, Save } from 'lucide-react'
import { useStore } from '../../../store/store'
import type { LengthUnit, Material, PricingBasis, Product, ProductMaterial } from '../../../lib/types'
import type { MaterialDraft } from '../../../domain/master'
import { deleteMaterial, materialToDraft, saveMaterial, setMaterialActive } from '../../../domain/master'
import { PRICING_BASIS_LABEL, pricedUnitLabel } from '../../../lib/costing'
import { calculateYield, fromMm, toMm } from '../../../lib/yield'
import { fmtDateTime } from '../../../lib/format'
import { Button, ConfirmDialog, Drawer, Field, Input, Select, Textarea } from '../../../components/ui'
import { ConflictNotice, NumberInput, focusFirstInvalid } from '../../../components/page'
import { processLabel, stageLabel } from '../masterSelectors'

export function MaterialDrawer({ materialId, onClose }: { materialId: string | null; onClose: () => void }) {
  const { db } = useStore()
  const material = db.materials.find((m) => m.id === materialId) ?? null
  const dirty = useRef(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const requestClose = () => (dirty.current ? setConfirmClose(true) : onClose())

  return (
    <>
      <Drawer
        open={!!material}
        onClose={requestClose}
        title={material?.name ?? ''}
        subtitle={material ? `${material.code} · ${material.kind === 'sheet' ? 'Sheet material' : `Quantity material (${material.uom})`}` : ''}
        width="w-full max-w-3xl"
      >
        {material ? (
          <MaterialEditor
            key={material.id}
            material={material}
            onDirty={(d) => (dirty.current = d)}
            onDeleted={() => {
              dirty.current = false
              onClose()
            }}
          />
        ) : null}
      </Drawer>
      <ConfirmDialog
        open={confirmClose}
        tone="danger"
        title="Close without saving?"
        body="Unsaved changes to this material will be lost."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        onCancel={() => setConfirmClose(false)}
        onConfirm={() => {
          setConfirmClose(false)
          dirty.current = false
          onClose()
        }}
      />
    </>
  )
}

function MaterialEditor({ material, onDirty, onDeleted }: { material: Material; onDirty: (d: boolean) => void; onDeleted: () => void }) {
  const { db, run, pushToast } = useStore()
  const [draft, setDraft] = useState<MaterialDraft>(() => materialToDraft(material))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [base, setBase] = useState<MaterialDraft>(() => materialToDraft(material))
  const [conflict, setConflict] = useState('')
  const dirty = JSON.stringify(draft) !== JSON.stringify(base)
  const loadLatest = () => {
    setDraft(materialToDraft(material))
    setBase(materialToDraft(material))
    setErrors({})
    setConflict('')
  }

  // Another tab saved this material: follow along unless there are unsaved edits here.
  useEffect(() => {
    if (dirty || material.updatedAt === base.expectedUpdatedAt) return
    loadLatest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material.updatedAt])
  const u = draft.sizeUnit

  useEffect(() => {
    onDirty(dirty)
  }, [dirty, onDirty])

  const set = (patch: Partial<MaterialDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const mm = (key: 'sheetLengthMm' | 'sheetWidthMm' | 'edgeMarginMm' | 'cutGapMm') => (v: number | null) =>
    set({ [key]: v === null ? (key === 'edgeMarginMm' || key === 'cutGapMm' ? 0 : null) : Number.isNaN(v) ? NaN : toMm(v, u) } as Partial<MaterialDraft>)

  const usages = useMemo(
    () => db.products.flatMap((p) => p.materials.filter((l) => l.materialId === material.id).map((line) => ({ product: p, line }))),
    [db.products, material.id],
  )

  /** Unsaved edits applied, so usage previews reflect what is on screen. */
  const preview: Material = { ...material, ...draft, uom: draft.kind === 'sheet' ? 'sheet' : draft.uom }

  const save = async () => {
    const r = await run(saveMaterial(draft))
    if (!r.ok) {
      if (r.conflict) setConflict(r.error)
      setErrors(r.fieldErrors ?? {})
      focusFirstInvalid()
      return
    }
    setErrors({})
    setDraft(materialToDraft(r.value))
    setBase(materialToDraft(r.value))
    pushToast({
      title: 'Material saved',
      message: material.price !== r.value.price ? 'New price applies to costings not yet finalized. Finalized costings and invoices keep their snapshot.' : undefined,
      level: 'success',
    })
  }

  return (
    <div className="space-y-6">
      {conflict ? <ConflictNotice message={conflict} onReload={loadLatest} /> : null}
      <form
        className="space-y-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <section>
          <h3 className="vx-smallcaps text-ink">Price & purchase</h3>
          <div className="mt-3 grid gap-x-4 sm:grid-cols-3">
            <Field label="Price ₹" error={errors.price} hint={draft.price === null ? 'Not set — blocks costing.' : draft.price === 0 ? 'Explicitly free.' : `per ${pricedUnitLabel(preview)}`}>
              <NumberInput value={draft.price} onChange={(v) => set({ price: v })} invalid={!!errors.price || draft.price === null} autoFocus />
            </Field>
            <Field label="Pricing basis" error={errors.pricingBasis}>
              <Select value={draft.pricingBasis} onChange={(e) => set({ pricingBasis: e.target.value as PricingBasis })} aria-invalid={!!errors.pricingBasis || undefined}>
                {(draft.kind === 'sheet' ? (['per_unit', 'per_pack', 'per_kg'] as PricingBasis[]) : (['per_unit', 'per_pack'] as PricingBasis[])).map((b) => (
                  <option key={b} value={b}>
                    {b === 'per_unit' ? (draft.kind === 'sheet' ? 'Per sheet' : `Per ${draft.uom || 'unit'}`) : PRICING_BASIS_LABEL[b]}
                  </option>
                ))}
              </Select>
            </Field>
            {draft.pricingBasis === 'per_pack' ? (
              <Field label={`Pack size (${draft.kind === 'sheet' ? 'sheets' : draft.uom})`} required error={errors.packSize}>
                <NumberInput value={draft.packSize} onChange={(v) => set({ packSize: v })} invalid={!!errors.packSize} />
              </Field>
            ) : draft.pricingBasis === 'per_kg' ? (
              <Field label="GSM" required error={errors.gsm} hint="Sheet weight = L × W × GSM.">
                <NumberInput value={draft.gsm} onChange={(v) => set({ gsm: v })} invalid={!!errors.gsm} />
              </Field>
            ) : (
              <div />
            )}
            <Field label="Wastage %" error={errors.wastagePct} hint="Applied once to net requirement.">
              <NumberInput value={draft.wastagePct} onChange={(v) => set({ wastagePct: v ?? 0 })} invalid={!!errors.wastagePct} />
            </Field>
            <Field label="Purchase rounding" error={errors.purchaseMultiple} hint={`Buy in multiples of this many ${pricedUnitLabel(preview)}s.`}>
              <NumberInput value={draft.purchaseMultiple} onChange={(v) => set({ purchaseMultiple: v ?? NaN })} invalid={!!errors.purchaseMultiple} />
            </Field>
            {draft.kind === 'quantity' ? (
              <Field label="Unit of measure" required error={errors.uom}>
                <Input value={draft.uom} onChange={(e) => set({ uom: e.target.value })} aria-invalid={!!errors.uom || undefined} />
              </Field>
            ) : null}
          </div>
          <p className="text-xs text-muted">
            {material.priceUpdatedAt ? `Price last changed ${fmtDateTime(material.priceUpdatedAt)} by ${material.priceUpdatedBy}.` : 'Price has never been set.'}
          </p>
        </section>

        {draft.kind === 'sheet' ? (
          <section>
            <h3 className="vx-smallcaps text-ink">Source sheet</h3>
            <div className="mt-3 grid gap-x-4 sm:grid-cols-4">
              <Field label="Size unit">
                <Select value={u} onChange={(e) => set({ sizeUnit: e.target.value as LengthUnit })}>
                  <option value="mm">Millimetres</option>
                  <option value="cm">Centimetres</option>
                  <option value="in">Inches</option>
                </Select>
              </Field>
              <Field label={`Length (${u})`} error={errors.sheetLengthMm}>
                <NumberInput value={fromMm(draft.sheetLengthMm, u)} onChange={mm('sheetLengthMm')} invalid={!!errors.sheetLengthMm || !draft.sheetLengthMm} />
              </Field>
              <Field label={`Width (${u})`} error={errors.sheetWidthMm}>
                <NumberInput value={fromMm(draft.sheetWidthMm, u)} onChange={mm('sheetWidthMm')} invalid={!!errors.sheetWidthMm || !draft.sheetWidthMm} />
              </Field>
              <div />
              <Field label={`Edge allowance (${u})`} error={errors.edgeMarginMm} hint="Kept clear on all 4 edges.">
                <NumberInput value={fromMm(draft.edgeMarginMm, u)} onChange={mm('edgeMarginMm')} invalid={!!errors.edgeMarginMm} />
              </Field>
              <Field label={`Cutting gap (${u})`} error={errors.cutGapMm} hint="Between adjacent pieces.">
                <NumberInput value={fromMm(draft.cutGapMm, u)} onChange={mm('cutGapMm')} invalid={!!errors.cutGapMm} />
              </Field>
            </div>
            <p className="flex gap-2 rounded-md bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-ink-2">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" aria-hidden="true" />
              Ups are calculated for a straight grid: every piece in one orientation (the better of as-drawn or rotated, when rotation is allowed), an edge allowance on all sides and a uniform gap between pieces. Nested, staggered or irregular die-lines are not optimised — use a validated ups override on the product usage for those.
            </p>
          </section>
        ) : null}

        <section>
          <h3 className="vx-smallcaps text-ink">Identity</h3>
          <div className="mt-3 grid gap-x-4 sm:grid-cols-2">
            <Field label="Name" required error={errors.name}>
              <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} aria-invalid={!!errors.name || undefined} />
            </Field>
            <Field label="Code" error={errors.code}>
              <Input spellCheck={false} value={draft.code} onChange={(e) => set({ code: e.target.value })} aria-invalid={!!errors.code || undefined} />
            </Field>
            <Field label="Supplier">
              <Input value={draft.supplier} onChange={(e) => set({ supplier: e.target.value })} />
            </Field>
            <Field label="Notes">
              <Textarea rows={1} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
            </Field>
          </div>
          {errors.kind ? <p className="text-sm text-risk">{errors.kind}</p> : null}
        </section>

        <div className="sticky bottom-0 -mx-5 flex flex-wrap items-center gap-2 border-t border-rule bg-surface px-5 py-3">
          <Button type="submit" icon={<Save className="h-4 w-4" />} disabled={!dirty}>
            Save material
          </Button>
          <span className="text-xs text-muted" aria-live="polite">
            {dirty ? 'Unsaved changes' : 'Saved'}
          </span>
          <span className="ml-auto flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={async () => {
                const r = await run(setMaterialActive(material.id, !material.active))
                if (r.ok) pushToast({ title: material.active ? 'Material deactivated' : 'Material reactivated', level: 'info' })
              }}
            >
              {material.active ? 'Deactivate' : 'Activate'}
            </Button>
            {!usages.length ? (
              <Button type="button" size="sm" variant="ghost" className="text-risk hover:bg-risk-wash" onClick={() => setConfirmDelete(true)}>
                Delete…
              </Button>
            ) : null}
          </span>
        </div>
      </form>

      <section>
        <h3 className="vx-smallcaps text-ink">Used in products ({usages.length})</h3>
        <p className="mt-1 text-sm text-muted">Which products use this material and for what. How much each product takes is set in that product.</p>
        {usages.length === 0 ? (
          <p className="mt-3 rounded-md border border-dashed border-rule-2 px-4 py-5 text-center text-sm text-muted">Not used by any product.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {usages.map(({ product, line }) => (
              <UsageSummary key={line.id} product={product} line={line} material={preview} />
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={confirmDelete}
        tone="danger"
        title={`Delete ${material.name}?`}
        body="The material is not used by any product and will be removed from the registry."
        confirmLabel="Delete material"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          const r = await run(deleteMaterial(material.id))
          setConfirmDelete(false)
          if (r.ok) {
            pushToast({ title: 'Material deleted', level: 'info' })
            onDeleted()
          } else pushToast({ title: 'Cannot delete', message: r.error, level: 'danger' })
        }}
      />
    </div>
  )
}

/**
 * Where this material is used — read only. The material itself is set up once,
 * above; how much of it a product takes (cut size, pieces) belongs to that
 * product and is changed there, so nothing here can block or ask twice.
 */
function UsageSummary({ product, line, material }: { product: Product; line: ProductMaterial; material: Material }) {
  const u = material.sizeUnit
  const pieces = line.piecesPerProduct ?? 1
  const y =
    material.kind === 'sheet' && material.sheetLengthMm && material.sheetWidthMm && line.cutLengthMm && line.cutWidthMm
      ? calculateYield({
          sheetLengthMm: material.sheetLengthMm,
          sheetWidthMm: material.sheetWidthMm,
          cutLengthMm: line.cutLengthMm,
          cutWidthMm: line.cutWidthMm,
          edgeMarginMm: material.edgeMarginMm,
          cutGapMm: material.cutGapMm,
          rotationAllowed: line.rotationAllowed,
        })
      : null
  const where = [stageLabel(product, line.stageId), line.processId ? processLabel(product, line.processId) : ''].filter(Boolean).join(' › ')

  return (
    <li className="flex flex-wrap items-start gap-3 rounded-md border border-rule-2 px-4 py-3 text-sm">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">{product.name}</p>
        <p className="mt-0.5 text-ink-2">
          {where ? `Used for ${where}` : 'Used in this product'}
          {material.kind === 'sheet'
            ? line.cutLengthMm && line.cutWidthMm
              ? ` · cut piece ${fromMm(line.cutLengthMm, u)} × ${fromMm(line.cutWidthMm, u)} ${u} · ${pieces} piece${pieces === 1 ? '' : 's'} per product`
              : ' · cut size not entered yet'
            : line.qtyPerPiece !== null
              ? ` · ${line.qtyPerPiece} ${material.uom} per piece`
              : ' · quantity per piece not entered yet'}
        </p>
        {material.kind === 'sheet' && y && !y.error ? (
          <p className="mt-0.5 text-xs text-muted">
            {line.upsOverride !== null ? `${line.upsOverride} pieces per sheet (set in the product)` : `${y.ups} pieces per sheet`} · {y.yieldPct.toFixed(0)}% of the sheet used
          </p>
        ) : null}
      </div>
      <Link
        to={`/master/products/${product.id}`}
        className="vx-focus inline-flex h-9 shrink-0 items-center rounded-md border border-rule-2 px-3 text-sm font-medium text-ink hover:bg-surface-2"
      >
        Change in product →
      </Link>
    </li>
  )
}
