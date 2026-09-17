import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calculator, Info, Save } from 'lucide-react'
import { useStore } from '../../../store/store'
import type { LengthUnit, Material, PricingBasis, Product, ProductMaterial } from '../../../lib/types'
import type { MaterialDraft } from '../../../domain/master'
import { deleteMaterial, materialToDraft, saveMaterial, saveMaterialUsage, setMaterialActive } from '../../../domain/master'
import { PRICING_BASIS_LABEL, computeOrderCosting, pricedUnitLabel } from '../../../lib/costing'
import { calculateYield, fromMm, toMm } from '../../../lib/yield'
import { cx, fmtDateTime, moneyPaise, qty } from '../../../lib/format'
import { Badge, Button, ConfirmDialog, Drawer, Field, Input, Select, Textarea } from '../../../components/ui'
import { ConflictNotice, NumberInput, focusFirstInvalid } from '../../../components/page'
import { NO_PRICING_INPUTS, processLabel, stageLabel } from '../masterSelectors'

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
        <h3 className="vx-smallcaps text-ink">Product usages ({usages.length})</h3>
        <p className="mt-1 text-sm text-muted">How each product consumes this material. Cut sizes and overrides edited here update the product definition.</p>
        {usages.length === 0 ? (
          <p className="mt-3 rounded-md border border-dashed border-rule-2 px-4 py-5 text-center text-sm text-muted">Not used by any product.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {usages.map(({ product, line }) => (
              <UsageEditor key={line.id} product={product} line={line} material={preview} materialDirty={dirty} />
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

type UsagePatch = Pick<ProductMaterial, 'piecesPerProduct' | 'cutLengthMm' | 'cutWidthMm' | 'rotationAllowed' | 'upsOverride' | 'upsOverrideReason' | 'qtyPerPiece'>

function UsageEditor({ product, line, material, materialDirty }: { product: Product; line: ProductMaterial; material: Material; materialDirty: boolean }) {
  const { db, run, pushToast } = useStore()
  const initial: UsagePatch = {
    piecesPerProduct: line.piecesPerProduct,
    cutLengthMm: line.cutLengthMm,
    cutWidthMm: line.cutWidthMm,
    rotationAllowed: line.rotationAllowed,
    upsOverride: line.upsOverride,
    upsOverrideReason: line.upsOverrideReason,
    qtyPerPiece: line.qtyPerPiece,
  }
  const [patch, setPatch] = useState<UsagePatch>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sampleQty, setSampleQty] = useState<number | null>(1000)
  const dirty = JSON.stringify(patch) !== JSON.stringify(initial)
  const u = material.sizeUnit
  const merged: ProductMaterial = { ...line, ...patch }
  const k = (f: string) => errors[`usage.${line.id}.${f}`]

  const y =
    material.kind === 'sheet' && material.sheetLengthMm && material.sheetWidthMm && merged.cutLengthMm && merged.cutWidthMm
      ? calculateYield({
          sheetLengthMm: material.sheetLengthMm,
          sheetWidthMm: material.sheetWidthMm,
          cutLengthMm: merged.cutLengthMm,
          cutWidthMm: merged.cutWidthMm,
          edgeMarginMm: material.edgeMarginMm,
          cutGapMm: material.cutGapMm,
          rotationAllowed: merged.rotationAllowed,
        })
      : null

  const sample = useMemo(() => {
    if (!sampleQty || !Number.isInteger(sampleQty) || sampleQty < 1) return null
    const r = computeOrderCosting({
      quantity: sampleQty,
      product: { productId: product.id, stages: [], materials: [merged] },
      materials: [material],
      settings: db.settings,
      inputs: NO_PRICING_INPUTS,
    })
    return { line: r.materialLines[0], issues: r.issues.filter((i) => i.level === 'error' && !/no stages/.test(i.message)) }
    // merged is derived from patch + line
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleQty, JSON.stringify(merged), material, db.settings, product.id])

  const toMmValue = (v: number | null) => (v === null ? null : Number.isNaN(v) ? NaN : toMm(v, u))

  return (
    <li className="rounded-md border border-rule-2 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Link to={`/master/products/${product.id}`} className="vx-focus rounded-xs font-medium text-ink hover:text-accent-text hover:underline">
          {product.name}
        </Link>
        <span className="text-xs text-muted">
          {stageLabel(product, line.stageId)}
          {line.processId ? ` › ${processLabel(product, line.processId)}` : ''}
        </span>
      </div>

      <div className="mt-3 grid gap-x-3 sm:grid-cols-4">
        {material.kind === 'quantity' ? (
          <Field label={`Per piece (${material.uom})`} error={k('qtyPerPiece')}>
            <NumberInput value={patch.qtyPerPiece} onChange={(v) => setPatch({ ...patch, qtyPerPiece: v ?? NaN })} invalid={!!k('qtyPerPiece')} />
          </Field>
        ) : (
          <>
            <Field label="Pieces / product" error={k('piecesPerProduct')}>
              <NumberInput value={patch.piecesPerProduct} onChange={(v) => setPatch({ ...patch, piecesPerProduct: v ?? NaN })} invalid={!!k('piecesPerProduct')} />
            </Field>
            <Field label={`Cut length (${u})`} error={k('cutLengthMm')}>
              <NumberInput value={fromMm(patch.cutLengthMm, u)} onChange={(v) => setPatch({ ...patch, cutLengthMm: toMmValue(v) })} invalid={!!k('cutLengthMm') || !patch.cutLengthMm} />
            </Field>
            <Field label={`Cut width (${u})`} error={k('cutWidthMm')}>
              <NumberInput value={fromMm(patch.cutWidthMm, u)} onChange={(v) => setPatch({ ...patch, cutWidthMm: toMmValue(v) })} invalid={!!k('cutWidthMm') || !patch.cutWidthMm} />
            </Field>
            <Field label="Rotation" as="div">
              <label className="flex h-9 cursor-pointer items-center gap-2 text-sm text-ink-2">
                <input type="checkbox" className="h-4 w-4 accent-[var(--color-accent)]" checked={patch.rotationAllowed} onChange={(e) => setPatch({ ...patch, rotationAllowed: e.target.checked })} />
                Allowed
              </label>
            </Field>
            <Field label="Ups override" error={k('upsOverride')} hint="Blank uses the calculation.">
              <NumberInput value={patch.upsOverride} onChange={(v) => setPatch({ ...patch, upsOverride: v })} invalid={!!k('upsOverride')} />
            </Field>
            <Field label="Override reason" className="sm:col-span-3">
              <Input value={patch.upsOverrideReason} onChange={(e) => setPatch({ ...patch, upsOverrideReason: e.target.value })} disabled={patch.upsOverride === null} />
            </Field>
          </>
        )}
      </div>

      {material.kind === 'sheet' ? (
        <div className={cx('rounded-md px-3 py-2.5 text-sm', y?.error ? 'bg-risk-wash text-risk' : 'bg-surface-2 text-ink-2')} aria-live="polite">
          {!material.sheetLengthMm || !material.sheetWidthMm
            ? 'Enter the source sheet size above to calculate ups.'
            : !y
              ? 'Enter the cut size to calculate ups.'
              : y.error ?? (
                  <>
                    <strong className="font-semibold text-ink">{y.ups} ups</strong> per sheet — {y.along} along × {y.across} across, {y.orientation === 'rotated' ? 'rotated 90°' : 'as drawn'}. Usable area {fromMm(y.usableLengthMm, u)} × {fromMm(y.usableWidthMm, u)} {u}, {y.yieldPct.toFixed(1)}% of the sheet used. Area limit {y.areaLimit} pieces.
                    {patch.upsOverride !== null ? <span className="block text-warn">Override in use: {patch.upsOverride} ups.</span> : null}
                  </>
                )}
        </div>
      ) : null}

      <div className="mt-3 rounded-md border border-rule p-3">
        <div className="flex flex-wrap items-end gap-3">
          <Calculator className="mb-2.5 h-4 w-4 text-faint" aria-hidden="true" />
          <Field label="Sample order qty" className="w-40">
            <NumberInput value={sampleQty} onChange={setSampleQty} />
          </Field>
          {sample?.line && sample.issues.length === 0 ? (
            <dl className="mb-5 grid flex-1 grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
              {material.kind === 'sheet' ? (
                <>
                  <Pair label="Pieces needed" value={qty(sample.line.piecesNeeded, 0)} />
                  <Pair label="Net sheets" value={qty(sample.line.netQty, 0)} />
                  <Pair label={`Wastage (${material.wastagePct}%)`} value={qty(sample.line.wastageQty, 0)} />
                  <Pair label="Total sheets" value={qty(sample.line.totalQty, 0)} />
                </>
              ) : (
                <>
                  <Pair label="Net" value={`${qty(sample.line.netQty, 3)} ${material.uom}`} />
                  <Pair label={`Wastage (${material.wastagePct}%)`} value={qty(sample.line.wastageQty, 3)} />
                  <Pair label="Total" value={qty(sample.line.totalQty, 3)} />
                </>
              )}
              <Pair label="Purchase" value={`${qty(sample.line.purchaseQty, 3)} × ${sample.line.purchaseUnit}`} />
              <Pair label="Rounding surplus" value={qty(sample.line.surplusQty, 3)} />
              <Pair label="Material cost" value={material.price === null ? 'Price missing' : moneyPaise(sample.line.amount)} />
            </dl>
          ) : (
            <p className="mb-5 flex-1 text-xs text-warn">{sample?.issues[0]?.message ?? 'Enter a whole-number quantity.'}</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={!dirty || materialDirty}
          onClick={async () => {
            const r = await run(saveMaterialUsage(product.id, line.id, patch, product.updatedAt))
            if (!r.ok) {
              setErrors(r.fieldErrors ?? {})
              pushToast({ title: 'Usage not saved', message: r.error, level: 'danger' })
              return
            }
            setErrors({})
            pushToast({ title: `${product.name} usage saved`, message: `Product is now version ${r.value.version}.`, level: 'success' })
          }}
        >
          Save usage
        </Button>
        {materialDirty && dirty ? <span className="text-xs text-warn">Save the material first.</span> : dirty ? <Badge tone="amber">Unsaved</Badge> : null}
      </div>
    </li>
  )
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-faint">{label}</dt>
      <dd className="vx-code truncate font-medium text-ink">{value}</dd>
    </div>
  )
}
