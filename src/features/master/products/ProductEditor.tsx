import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Boxes,
  ClipboardList,
  Layers,
  ListPlus,
  Package,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { useStore } from '../../../store/store'
import type { CostBasis, LengthUnit, Material, MaterialKind, Product, ProductMaterial, ProductProcess, ProductSpec, ProductStage } from '../../../lib/types'
import { draftKey, readDraft, removeDraft, writeDraft } from '../../../lib/drafts'
import type { StoredDraft } from '../../../lib/drafts'
import { remote } from '../../../store/remote'
import { fromWire } from '../../../lib/wire'
import type { MaterialDraft, ProductDraft } from '../../../domain/master'
import { blankMaterialDraft, saveMaterial, saveProduct } from '../../../domain/master'
import { COST_BASIS_LABEL, computeOrderCosting, pricedUnitLabel } from '../../../lib/costing'
import { calculateYield, fromMm, toMm } from '../../../lib/yield'
import { cx, uid } from '../../../lib/format'
import { Badge, Button, Card, CardHead, ConfirmDialog, EmptyState, Field, IconButton, Input, Modal, Select, Textarea } from '../../../components/ui'
import { ConflictNotice, IssueList, LinkButton, NumberInput, PageHeader, focusFirstInvalid, useDocumentTitle, useUnsavedChanges } from '../../../components/page'
import { NO_PRICING_INPUTS } from '../masterSelectors'
import type { OpResult } from '../../../domain/common'

export function ProductEditorPage() {
  const { productId } = useParams()
  const { db } = useStore()
  const [params, setParams] = useSearchParams()
  const newDraftId = params.get('draft')
  // Each unsaved new product has its own recovery key, kept in the URL so a refresh finds it again.
  useEffect(() => {
    if (productId !== 'new' || newDraftId) return
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('draft', uid('new'))
        return next
      },
      { replace: true },
    )
  }, [productId, newDraftId, setParams])
  const product = productId === 'new' ? undefined : db.products.find((p) => p.id === productId)
  if (productId !== 'new' && !product)
    return (
      <Card>
        <EmptyState
          icon={<Package className="h-6 w-6" />}
          title="Product not found"
          message="It may have been deleted. Return to the product register."
          action={<LinkButton to="/master/products">Back to products</LinkButton>}
        />
      </Card>
    )
  if (productId === 'new' && !newDraftId) return null
  const scopeId = product ? product.id : `new:${newDraftId}`
  return <ProductEditor key={scopeId} product={product} scopeId={scopeId} />
}

function toDraft(p?: Product): ProductDraft {
  if (!p) return { code: '', name: '', category: '', description: '', hsn: '', uom: 'pcs', taxPct: null, stages: [], materials: [] }
  return structuredClone({
    id: p.id,
    code: p.code,
    name: p.name,
    category: p.category,
    description: p.description,
    hsn: p.hsn,
    uom: p.uom,
    taxPct: p.taxPct,
    stages: p.stages,
    materials: p.materials,
    spec: p.spec ?? null,
    expectedUpdatedAt: p.updatedAt,
  })
}

const newProcess = (): ProductProcess => ({
  id: uid('prc'),
  name: '',
  description: '',
  // Unknown until measured — blank, not zero.
  setupHours: null,
  runHoursPer1000: null,
  chargeId: null,
  costBasis: 'per_1000',
  rate: null,
  setupCharge: null,
  // Manual by default: a unit may run it with "No machine required".
  requiresMachine: false,
  method: '',
})

type AutosaveState =
  | { state: 'idle' }
  | { state: 'saving' }
  | { state: 'saved'; at: string }
  | { state: 'failed'; error: string }
  | { state: 'newer'; newer: StoredDraft<ProductDraft> }

function browserLocal(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

const blankSpec = (): ProductSpec => ({
  importKey: null,
  status: 'proposed',
  sourceRow: null,
  sourceName: '',
  rawSize: '',
  sizeUnit: null,
  dimensionBasis: null,
  lengthMm: null,
  widthMm: null,
  heightMm: null,
  requestedQty: null,
  construction: '',
  insertApproach: '',
  aliases: [],
  openItems: [],
  notes: '',
})

const newStage = (): ProductStage => ({ id: uid('stg'), name: '', description: '', processes: [newProcess()] })

function move<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const to = index + dir
  if (to < 0 || to >= list.length) return list
  const next = [...list]
  ;[next[index], next[to]] = [next[to], next[index]]
  return next
}

interface PendingConfirm {
  title: string
  body: string
  confirmLabel: string
  run: () => void
}

function ProductEditor({ product, scopeId }: { product?: Product; scopeId: string }) {
  useDocumentTitle(product ? `Master · ${product.name}` : 'Master · New product')
  const { db, user, run, pushToast, storageMode } = useStore()
  const navigate = useNavigate()
  const storage = useMemo(() => browserLocal(), [])
  const serverRev = useRef(0)
  const recoveryKey = draftKey(user?.id ?? 'anonymous', 'product', scopeId)
  const tabId = useMemo(() => uid('tab'), [])
  // A recovery copy from an earlier visit, a refresh or a failed save is restored exactly as it was.
  const [recovered] = useState(() => (storage ? readDraft<ProductDraft>(storage, recoveryKey) : null))
  const knownRev = useRef(recovered?.rev ?? 0)
  const [draft, setDraft] = useState<ProductDraft>(() => recovered?.data ?? toDraft(product))
  const [baseline, setBaseline] = useState(() => JSON.stringify(toDraft(product)))
  const [autosave, setAutosave] = useState<AutosaveState>(recovered ? { state: 'saved', at: recovered.savedAt } : { state: 'idle' })
  const [restoredNotice, setRestoredNotice] = useState<StoredDraft<ProductDraft> | null>(recovered)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [lastSave, setLastSave] = useState<'' | 'draft' | 'complete'>('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [stageCount, setStageCount] = useState<number | null>(3)
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null)
  const [newMaterialOpen, setNewMaterialOpen] = useState(false)
  const [pickMaterial, setPickMaterial] = useState('')
  const [conflict, setConflict] = useState('')
  const saving = useRef(false)
  const [savePhase, setSavePhase] = useState<'idle' | 'saving'>('idle')
  const dirty = JSON.stringify(draft) !== baseline
  const guard = useUnsavedChanges(dirty)

  /** Write the recovery copy now. Returns false when it could not be kept. */
  const persistRecovery = (value: ProductDraft): boolean => {
    if (!storage || !user) {
      setAutosave({ state: 'failed', error: 'Browser storage is unavailable.' })
      return false
    }
    const r = writeDraft(storage, recoveryKey, value, { userId: user.id, tabId, knownRev: knownRev.current, baseUpdatedAt: product?.updatedAt ?? null })
    if (r.ok) {
      knownRev.current = r.rev
      setAutosave({ state: 'saved', at: r.savedAt })
      if (storageMode === 'server') void syncServerDraft(value)
      return true
    }
    if (r.reason === 'newer') setAutosave({ state: 'newer', newer: r.current as StoredDraft<ProductDraft> })
    else setAutosave({ state: 'failed', error: r.error })
    return false
  }

  /** Server mode: the recovery copy is also kept on the server, so it survives losing this browser. */
  const syncServerDraft = async (value: ProductDraft) => {
    try {
      const r = await remote.putDraft(recoveryKey, serverRev.current, value)
      if (r.body.ok) serverRev.current = r.body.rev
      else if ('current' in r.body && r.body.current) {
        const newer = fromWire<ProductDraft>(r.body.current.data)
        setAutosave({ state: 'newer', newer: { key: recoveryKey, userId: user?.id ?? '', rev: r.body.current.rev, tabId: 'server', savedAt: r.body.current.updatedAt, baseUpdatedAt: null, data: newer } })
        serverRev.current = r.body.current.rev
      }
    } catch {
      setAutosave({ state: 'failed', error: 'The server copy of this draft could not be saved (the copy in this browser was kept).' })
    }
  }

  // Server mode: with no copy in this browser, offer the one stored on the server.
  useEffect(() => {
    if (storageMode !== 'server' || recovered) return
    let cancelled = false
    remote
      .getDraft(recoveryKey)
      .then((r) => {
        if (cancelled || !r.body.ok) return
        const data = fromWire<ProductDraft>(r.body.data)
        serverRev.current = r.body.rev
        setDraft(data)
        setRestoredNotice({ key: recoveryKey, userId: user?.id ?? '', rev: r.body.rev, tabId: 'server', savedAt: r.body.updatedAt, baseUpdatedAt: null, data })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recoveryKey, storageMode])

  // Autosave shortly after typing stops.
  const draftRef = useRef(draft)
  const dirtyRef = useRef(dirty)
  useEffect(() => {
    draftRef.current = draft
    dirtyRef.current = dirty
    if (!dirty || autosave.state === 'newer') return
    setAutosave({ state: 'saving' })
    const t = window.setTimeout(() => persistRecovery(draft), 400)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, dirty])

  // Flush when the tab is hidden or closed, and notice newer drafts written by another tab.
  useEffect(() => {
    const flush = () => {
      if (dirtyRef.current) persistRecovery(draftRef.current)
    }
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key !== recoveryKey || !storage || !e.newValue) return
      const other = readDraft<ProductDraft>(storage, recoveryKey)
      if (other && other.rev > knownRev.current && other.tabId !== tabId) setAutosave({ state: 'newer', newer: other })
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('storage', onStorage)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recoveryKey, storage, tabId])

  const loadNewerDraft = (newer: StoredDraft<ProductDraft>) => {
    knownRev.current = newer.rev
    setDraft(newer.data)
    setAutosave({ state: 'saved', at: newer.savedAt })
  }
  const keepMine = () => {
    // Explicit choice: this tab's form replaces the other tab's newer copy.
    if (autosave.state === 'newer') knownRev.current = autosave.newer.rev
    persistRecovery(draftRef.current)
  }
  const discardDraft = () => {
    if (storage) removeDraft(storage, recoveryKey)
    if (storageMode === 'server') void remote.deleteDraft(recoveryKey).catch(() => {})
    knownRev.current = 0
    const fresh = toDraft(product)
    setDraft(fresh)
    setBaseline(JSON.stringify(fresh))
    setErrors({})
    setRestoredNotice(null)
    setAutosave({ state: 'idle' })
    setDiscardOpen(false)
  }

  const set = (patch: Partial<ProductDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const setStages = (fn: (s: ProductStage[]) => ProductStage[]) => setDraft((d) => ({ ...d, stages: fn(d.stages) }))
  const setLines = (fn: (l: ProductMaterial[]) => ProductMaterial[]) => setDraft((d) => ({ ...d, materials: fn(d.materials) }))
  const updateStage = (id: string, patch: Partial<ProductStage>) => setStages((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  const updateProcess = (stageId: string, processId: string, patch: Partial<ProductProcess>) =>
    setStages((list) => list.map((s) => (s.id === stageId ? { ...s, processes: s.processes.map((p) => (p.id === processId ? { ...p, ...patch } : p)) } : s)))
  const updateLine = (id: string, patch: Partial<ProductMaterial>) => setLines((list) => list.map((l) => (l.id === id ? { ...l, ...patch } : l)))

  const openPlans = product ? db.plans.filter((p) => p.productId === product.id && (p.status === 'Draft' || p.status === 'Ready for Costing')).length : 0
  const orders = product ? db.orders.filter((o) => o.productId === product.id).length : 0

  const liveIssues = useMemo(
    () =>
      computeOrderCosting({
        quantity: 1000,
        product: { productId: product?.id ?? 'new', stages: draft.stages, materials: draft.materials, spec: draft.spec },
        materials: db.materials,
        settings: db.settings,
        inputs: NO_PRICING_INPUTS,
      })
        .issues.filter((i) => i.level === 'error' && !/^Requested quantity/.test(i.message))
        // Product-level issues are fixed on this page, so they need no link.
        .map((i) => (/^\/master\/products\//.test(i.fix?.to ?? '') ? { ...i, fix: undefined } : i)),
    [draft.stages, draft.materials, draft.spec, db.materials, db.settings, product?.id],
  )

  const removeStage = (stage: ProductStage, index: number) => {
    const linked = draft.materials.filter((l) => l.stageId === stage.id).length
    const doIt = () => {
      setStages((list) => list.filter((s) => s.id !== stage.id))
      setLines((list) => list.map((l) => (l.stageId === stage.id ? { ...l, stageId: null, processId: null } : l)))
    }
    const used = linked > 0 || stage.processes.some((p) => p.name.trim())
    if (!used) return doIt()
    setConfirm({
      title: `Remove stage ${index + 1}${stage.name ? ` “${stage.name}”` : ''}?`,
      body: `Its ${stage.processes.length} process(es) are removed${linked ? ` and ${linked} material link(s) become “whole product”` : ''}.${openPlans ? ` ${openPlans} open plan(s) will need their unit assignments reviewed.` : ''} Orders already in production keep their own copy.`,
      confirmLabel: 'Remove stage',
      run: doIt,
    })
  }

  const removeProcess = (stage: ProductStage, process: ProductProcess) => {
    const linked = draft.materials.filter((l) => l.processId === process.id).length
    const doIt = () => {
      updateStage(stage.id, { processes: stage.processes.filter((p) => p.id !== process.id) })
      setLines((list) => list.map((l) => (l.processId === process.id ? { ...l, processId: null } : l)))
    }
    if (!linked && !process.name.trim()) return doIt()
    setConfirm({
      title: `Remove process${process.name ? ` “${process.name}”` : ''}?`,
      body: linked ? `${linked} material link(s) to this process will stay on the stage.` : 'The process and its duration and cost settings are removed from this product.',
      confirmLabel: 'Remove process',
      run: doIt,
    })
  }

  const addLine = (material: Material) =>
    setLines((list) => [
      ...list,
      {
        id: uid('bom'),
        materialId: material.id,
        stageId: null,
        processId: null,
        // Not measured yet: left blank for the user to enter.
        qtyPerPiece: null,
        piecesPerProduct: null,
        cutLengthMm: null,
        cutWidthMm: null,
        rotationAllowed: true,
        upsOverride: null,
        upsOverrideReason: '',
        note: '',
      },
    ])

  const loadLatest = () => {
    const next = toDraft(product)
    setDraft(next)
    setBaseline(JSON.stringify(next))
    setErrors({})
    setConflict('')
  }

  // Another tab saved this product: follow along unless this screen has its own unsaved edits.
  useEffect(() => {
    if (!product || dirty || product.updatedAt === draft.expectedUpdatedAt) return
    loadLatest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.updatedAt])

  const save = async () => {
    if (saving.current) return
    saving.current = true
    // The recovery copy is written first, so a failed or interrupted save loses nothing.
    if (dirty) persistRecovery(draft)
    setSavePhase('saving')
    const incomplete = liveIssues.length > 0
    let r: OpResult<Product>
    try {
      r = await run(saveProduct(draft))
    } catch (err) {
      r = { ok: false, error: `Unexpected error: ${err instanceof Error ? err.message : String(err)}` }
    } finally {
      saving.current = false
      setSavePhase('idle')
    }
    if (!r.ok) {
      if (r.conflict) setConflict(r.error)
      setErrors(r.fieldErrors ?? {})
      pushToast({ title: 'Product not saved', message: `${r.error} Your entries are kept as a recovery draft in this browser.`, level: 'danger' })
      focusFirstInvalid()
      return
    }
    setErrors({})
    // Only a saved record makes the recovery copy redundant.
    if (storage) removeDraft(storage, recoveryKey)
    if (storageMode === 'server') void remote.deleteDraft(recoveryKey).catch(() => {})
    knownRev.current = 0
    setRestoredNotice(null)
    setAutosave({ state: 'idle' })
    const saved = toDraft(r.value)
    setDraft(saved)
    setBaseline(JSON.stringify(saved))
    setLastSave(incomplete ? 'draft' : 'complete')
    pushToast(
      incomplete
        ? { title: 'Saved as draft — costing details need attention', message: `${r.value.code} version ${r.value.version}. The missing details are listed under Costing readiness.`, level: 'warn' }
        : { title: product ? 'Product updated' : 'Product created', message: `${r.value.code} saved as version ${r.value.version}.`, level: 'success' },
    )
    if (!product) {
      guard.bypass()
      navigate(`/master/products/${r.value.id}`, { replace: true })
    }
  }

  const err = (key: string) => errors[key]
  const activeCharges = db.settings.processCharges

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        eyebrow="Master · Products"
        title={product ? product.name : 'New product'}
        subtitle={
          product
            ? `${product.code} · version ${product.version}. Edits apply to plans that are not yet costed. ${orders ? `${orders} production order(s) keep the definition they were finalized with.` : ''}`
            : 'Enter the basic details, choose how many stages the product passes through, then configure the processes and materials.'
        }
        icon={<Package className="h-4 w-4" />}
        actions={
          <LinkButton to="/master/products" variant="secondary" icon={<ArrowLeft className="h-4 w-4" />}>
            Products
          </LinkButton>
        }
      />

      {conflict ? <ConflictNotice message={conflict} onReload={loadLatest} /> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <form
          className="min-w-0 space-y-6"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          {/* ----------------------------- 1. Basics ---------------------------- */}
          <Card className="vx-anim-up">
            <CardHead title="1 · Basic information" icon={<Package className="h-4 w-4" />} />
            <div className="grid gap-x-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Product name" required error={err('name')} className="sm:col-span-2">
                <Input name="product-name" value={draft.name} onChange={(e) => set({ name: e.target.value })} aria-invalid={!!err('name') || undefined} placeholder="e.g. Rigid box with lid…" />
              </Field>
              <Field label="Code" error={err('code')} hint="Leave blank to number automatically.">
                <Input name="product-code" spellCheck={false} value={draft.code} onChange={(e) => set({ code: e.target.value })} aria-invalid={!!err('code') || undefined} />
              </Field>
              <Field label="Category">
                <Input value={draft.category} onChange={(e) => set({ category: e.target.value })} placeholder="e.g. Rigid box…" />
              </Field>
              <Field label="HSN / SAC">
                <Input spellCheck={false} value={draft.hsn} onChange={(e) => set({ hsn: e.target.value })} />
              </Field>
              <Field label="Finished-goods unit" required error={err('uom')}>
                <Input value={draft.uom} onChange={(e) => set({ uom: e.target.value })} aria-invalid={!!err('uom') || undefined} />
              </Field>
              <Field label="Tax %" error={err('taxPct')} hint={`Blank uses the default (${db.settings.taxLabel} ${db.settings.taxPct}%).`}>
                <NumberInput value={draft.taxPct} onChange={(v) => set({ taxPct: v })} invalid={!!err('taxPct')} />
              </Field>
              <Field label="Description" className="sm:col-span-2">
                <Textarea rows={2} value={draft.description} onChange={(e) => set({ description: e.target.value })} />
              </Field>
            </div>
          </Card>

          {restoredNotice ? (
            <div role="status" className="vx-anim-up flex flex-wrap items-center gap-3 rounded-md bg-accent-wash px-4 py-3 text-sm text-accent-text ring-1 ring-inset ring-accent-edge">
              <span className="min-w-0 flex-1">
                Restored your unsaved entries from {new Date(restoredNotice.savedAt).toLocaleString('en-IN')}. They are not in the product register until you save.
                {product && restoredNotice.baseUpdatedAt && restoredNotice.baseUpdatedAt !== product.updatedAt ? ' The saved product has changed since then — saving will ask you to review.' : ''}
              </span>
              <Button type="button" size="sm" variant="secondary" onClick={() => setRestoredNotice(null)}>
                Keep editing
              </Button>
              <Button type="button" size="sm" variant="danger-outline" onClick={() => setDiscardOpen(true)}>
                Discard draft…
              </Button>
            </div>
          ) : null}

          <SpecCard spec={draft.spec ?? null} errors={errors} onChange={(spec) => set({ spec })} />

          {/* ----------------------------- 2. Stages ---------------------------- */}
          <Card className="vx-anim-up">
            <CardHead
              title="2 · Stages and processes"
              subtitle="Stages run in this order on the shop floor. Each needs at least one process."
              icon={<Layers className="h-4 w-4" />}
              actions={draft.stages.length ? <Badge tone="indigo">{draft.stages.length} stages</Badge> : null}
            />
            <div className="space-y-4 p-5">
              {err('stages') ? <p className="text-sm font-medium text-risk">{err('stages')}</p> : null}
              {draft.stages.length === 0 ? (
                <div className="flex flex-wrap items-end gap-3 rounded-md bg-surface-2 p-4">
                  <Field label="Number of stages" hint="You can add, remove and reorder stages afterwards." className="w-48">
                    <NumberInput value={stageCount} onChange={setStageCount} invalid={stageCount !== null && !(Number.isInteger(stageCount) && stageCount >= 1 && stageCount <= 40)} />
                  </Field>
                  <Button
                    type="button"
                    className="mb-5"
                    icon={<ListPlus className="h-4 w-4" />}
                    disabled={!(stageCount && Number.isInteger(stageCount) && stageCount >= 1 && stageCount <= 40)}
                    onClick={() => setStages(() => Array.from({ length: stageCount ?? 0 }, newStage))}
                  >
                    Generate {stageCount && stageCount > 0 ? stageCount : ''} stage sections
                  </Button>
                </div>
              ) : null}

              {draft.stages.map((stage, si) => (
                <section key={stage.id} aria-labelledby={`${stage.id}-title`} className="rounded-lg border border-rule-2">
                  <div className="flex flex-wrap items-center gap-2 border-b border-rule bg-surface-2 px-4 py-2.5">
                    <span className="vx-code flex h-7 w-7 items-center justify-center rounded-xs bg-accent text-sm font-medium text-accent-ink" aria-hidden="true">
                      {si + 1}
                    </span>
                    <h3 id={`${stage.id}-title`} className="min-w-0 flex-1 truncate text-base font-semibold text-ink">
                      Stage {si + 1}
                      {stage.name ? ` · ${stage.name}` : ''}
                    </h3>
                    <IconButton type="button" label={`Move stage ${si + 1} up`} disabled={si === 0} onClick={() => setStages((l) => move(l, si, -1))}>
                      <ArrowUp className="h-4 w-4" />
                    </IconButton>
                    <IconButton type="button" label={`Move stage ${si + 1} down`} disabled={si === draft.stages.length - 1} onClick={() => setStages((l) => move(l, si, 1))}>
                      <ArrowDown className="h-4 w-4" />
                    </IconButton>
                    <IconButton type="button" label={`Remove stage ${si + 1}`} onClick={() => removeStage(stage, si)} className="hover:text-risk">
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                  <div className="grid gap-x-4 px-4 pt-4 sm:grid-cols-2">
                    <Field label="Stage name" required error={err(`stage.${stage.id}.name`)}>
                      <Input value={stage.name} onChange={(e) => updateStage(stage.id, { name: e.target.value })} aria-invalid={!!err(`stage.${stage.id}.name`) || undefined} placeholder="e.g. Printing…" />
                    </Field>
                    <Field label="Description">
                      <Input value={stage.description} onChange={(e) => updateStage(stage.id, { description: e.target.value })} />
                    </Field>
                  </div>

                  <div className="px-4 pb-4">
                    <p className="vx-mono-label">Processes in this stage</p>
                    {err(`stage.${stage.id}.processes`) ? <p className="mb-2 text-sm font-medium text-risk">{err(`stage.${stage.id}.processes`)}</p> : null}
                    <ol className="space-y-2">
                      {stage.processes.map((proc, pi) => {
                        const k = (f: string) => err(`process.${proc.id}.${f}`)
                        const charge = activeCharges.find((c) => c.id === proc.chargeId)
                        return (
                          <li key={proc.id} className="rounded-md border border-rule bg-surface p-3">
                            <div className="flex items-center gap-2">
                              <span className="vx-code text-sm text-muted" aria-hidden="true">
                                {si + 1}.{pi + 1}
                              </span>
                              <span className="sr-only">
                                Process {pi + 1} of stage {si + 1}
                              </span>
                              <span className="ml-auto flex items-center gap-0.5">
                                <IconButton type="button" label={`Move process ${pi + 1} up`} disabled={pi === 0} onClick={() => updateStage(stage.id, { processes: move(stage.processes, pi, -1) })}>
                                  <ArrowUp className="h-4 w-4" />
                                </IconButton>
                                <IconButton type="button" label={`Move process ${pi + 1} down`} disabled={pi === stage.processes.length - 1} onClick={() => updateStage(stage.id, { processes: move(stage.processes, pi, 1) })}>
                                  <ArrowDown className="h-4 w-4" />
                                </IconButton>
                                <IconButton type="button" label={`Remove process ${pi + 1}`} onClick={() => removeProcess(stage, proc)} className="hover:text-risk">
                                  <Trash2 className="h-4 w-4" />
                                </IconButton>
                              </span>
                            </div>
                            <div className="grid gap-x-3 sm:grid-cols-2 lg:grid-cols-6">
                              <Field label="Process name" required error={k('name')} className="sm:col-span-2">
                                <Input value={proc.name} onChange={(e) => updateProcess(stage.id, proc.id, { name: e.target.value })} aria-invalid={!!k('name') || undefined} />
                              </Field>
                              <Field label="Production method" className="sm:col-span-2 lg:col-span-4" hint="e.g. in-house digital print, outsourced lamination. Blank = not selected yet.">
                                <Input value={proc.method ?? ''} onChange={(e) => updateProcess(stage.id, proc.id, { method: e.target.value })} />
                              </Field>
                              <Field label="Setup hours" error={k('setupHours')}>
                                <NumberInput value={proc.setupHours} onChange={(v) => updateProcess(stage.id, proc.id, { setupHours: v })} invalid={!!k('setupHours')} placeholder="Not measured" />
                              </Field>
                              <Field label="Run h / 1,000 pcs" error={k('runHoursPer1000')}>
                                <NumberInput value={proc.runHoursPer1000} onChange={(v) => updateProcess(stage.id, proc.id, { runHoursPer1000: v })} invalid={!!k('runHoursPer1000')} placeholder="Not measured" />
                              </Field>
                              <Field label="Cost from" error={k('chargeId')} className="sm:col-span-2">
                                <Select value={proc.chargeId ?? ''} onChange={(e) => updateProcess(stage.id, proc.id, { chargeId: e.target.value || null })} aria-invalid={!!k('chargeId') || undefined}>
                                  <option value="">Custom rate for this process</option>
                                  {activeCharges
                                    .filter((c) => c.active || c.id === proc.chargeId)
                                    .map((c) => (
                                      <option key={c.id} value={c.id}>
                                        Reusable charge: {c.name}
                                      </option>
                                    ))}
                                </Select>
                              </Field>
                              {proc.chargeId ? (
                                <p className="text-sm text-muted sm:col-span-2 lg:col-span-6">
                                  {charge
                                    ? `${charge.name}: ${charge.rate === null ? 'rate not set' : `₹${charge.rate} ${COST_BASIS_LABEL[charge.basis]}`} · setup ${charge.setupCharge === null ? 'not set' : `₹${charge.setupCharge}`}. Edit in Master → Costing.`
                                    : 'Charge not found.'}
                                </p>
                              ) : (
                                <>
                                  <Field label="Cost basis" className="sm:col-span-2">
                                    <Select value={proc.costBasis} onChange={(e) => updateProcess(stage.id, proc.id, { costBasis: e.target.value as CostBasis })}>
                                      {(['per_1000', 'per_piece', 'per_hour', 'fixed'] as CostBasis[]).map((b) => (
                                        <option key={b} value={b}>
                                          {COST_BASIS_LABEL[b]}
                                        </option>
                                      ))}
                                    </Select>
                                  </Field>
                                  <Field label="Rate ₹" error={k('rate')} hint="Blank = not configured; 0 = no charge.">
                                    <NumberInput value={proc.rate} onChange={(v) => updateProcess(stage.id, proc.id, { rate: v })} invalid={!!k('rate')} />
                                  </Field>
                                  <Field label="Setup charge ₹" error={k('setupCharge')}>
                                    <NumberInput value={proc.setupCharge} onChange={(v) => updateProcess(stage.id, proc.id, { setupCharge: v })} invalid={!!k('setupCharge')} />
                                  </Field>
                                </>
                              )}
                              {/* Production uses this: a machine-bound process cannot start without one. */}
                              <label className="mb-5 flex items-start gap-2.5 sm:col-span-2">
                                <input
                                  type="checkbox"
                                  className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
                                  checked={proc.requiresMachine}
                                  onChange={(e) => updateProcess(stage.id, proc.id, { requiresMachine: e.target.checked })}
                                />
                                <span className="min-w-0">
                                  <span className="block text-base text-ink">This process needs a machine</span>
                                  <span className="block text-xs text-muted">
                                    Leave unticked for manual work — the unit then records “No machine required”.
                                  </span>
                                </span>
                              </label>
                            </div>
                          </li>
                        )
                      })}
                    </ol>
                    <Button type="button" size="sm" variant="secondary" className="mt-2" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => updateStage(stage.id, { processes: [...stage.processes, newProcess()] })}>
                      Add process to stage {si + 1}
                    </Button>
                  </div>
                </section>
              ))}

              {draft.stages.length ? (
                <Button type="button" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setStages((l) => [...l, newStage()])}>
                  Add stage
                </Button>
              ) : null}
            </div>
          </Card>

          {/* ---------------------------- 3. Materials -------------------------- */}
          <Card className="vx-anim-up">
            <CardHead
              title="3 · Materials"
              subtitle="Choose from the shared material registry. Prices, pack sizes and sheet settings are maintained in Master → Costing."
              icon={<Boxes className="h-4 w-4" />}
            />
            <div className="space-y-4 p-5">
              <div className="flex flex-wrap items-end gap-2">
                <Field label="Add existing material" className="min-w-[240px] flex-1" hint={db.materials.length ? undefined : 'The registry is empty — create the first material.'}>
                  <Select value={pickMaterial} onChange={(e) => setPickMaterial(e.target.value)}>
                    <option value="">Select a material…</option>
                    {db.materials
                      .filter((m) => m.active)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.code}) · {m.kind === 'sheet' ? 'sheet' : m.uom}
                        </option>
                      ))}
                  </Select>
                </Field>
                <Button
                  type="button"
                  variant="secondary"
                  className="mb-5"
                  disabled={!pickMaterial}
                  onClick={() => {
                    const m = db.materials.find((x) => x.id === pickMaterial)
                    if (m) addLine(m)
                    setPickMaterial('')
                  }}
                >
                  Add
                </Button>
                <Button type="button" variant="secondary" className="mb-5" icon={<Plus className="h-4 w-4" />} onClick={() => setNewMaterialOpen(true)}>
                  New material…
                </Button>
              </div>

              {draft.materials.length === 0 ? (
                <p className="rounded-md border border-dashed border-rule-2 px-4 py-6 text-center text-sm text-muted">No materials linked yet.</p>
              ) : (
                <ul className="space-y-3">
                  {draft.materials.map((line) => (
                    <MaterialLineEditor
                      key={line.id}
                      line={line}
                      stages={draft.stages}
                      material={db.materials.find((m) => m.id === line.materialId)}
                      errors={errors}
                      onChange={(patch) => updateLine(line.id, patch)}
                      onRemove={() =>
                        setConfirm({
                          title: 'Remove this material from the product?',
                          body: 'The material stays in the shared registry for other products.',
                          confirmLabel: 'Remove material',
                          run: () => setLines((l) => l.filter((x) => x.id !== line.id)),
                        })
                      }
                    />
                  ))}
                </ul>
              )}
            </div>
          </Card>
          <button type="submit" hidden />
        </form>

        {/* ------------------------------ Summary ------------------------------ */}
        <aside className="space-y-4 xl:sticky xl:top-24">
          <Card className="vx-anim-up p-4">
            <p className="vx-smallcaps text-ink">Summary</p>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                ['Stages', draft.stages.length],
                ['Processes', draft.stages.reduce((n, s) => n + s.processes.length, 0)],
                ['Materials', draft.materials.length],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md bg-surface-2 px-2 py-2.5">
                  <dt className="vx-mono-label !mb-0">{label}</dt>
                  <dd className="vx-code mt-1 text-lg font-semibold text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex flex-col gap-2">
              <Button type="button" icon={<Save className="h-4 w-4" />} onClick={save} loading={savePhase === 'saving'} block>
                {liveIssues.length ? 'Save draft' : product ? 'Save changes' : 'Create product'}
              </Button>
              <p className="text-center text-xs text-muted" aria-live="polite">
                {dirty
                  ? 'Unsaved changes — not in the product register yet'
                  : lastSave === 'draft' || (product && liveIssues.length)
                    ? 'Saved as draft — costing details need attention'
                    : product
                      ? 'All changes saved'
                      : 'Not saved yet'}
              </p>
              <AutosaveLine status={autosave} dirty={dirty} onLoadNewer={loadNewerDraft} onKeepMine={keepMine} onRetry={() => persistRecovery(draftRef.current)} />
              {restoredNotice || dirty ? (
                <button type="button" className="vx-focus self-center rounded-xs text-xs font-medium text-risk hover:underline" onClick={() => setDiscardOpen(true)}>
                  Discard unsaved draft…
                </button>
              ) : null}
            </div>
          </Card>
          <Card className="vx-anim-up p-4">
            <p className="vx-smallcaps text-ink">Costing readiness</p>
            <p className="mt-1 text-xs text-muted">Checked live against the shared registry.</p>
            <div className="mt-3">
              {!draft.stages.length ? (
                <p className="rounded-md bg-surface-2 px-3 py-2.5 text-sm text-muted">Add stages, processes and materials to check costing readiness.</p>
              ) : liveIssues.length ? (
                <IssueList issues={liveIssues} title={`${liveIssues.length} setting(s) missing`} />
              ) : (
                <p className="rounded-md bg-ok-wash px-3 py-2.5 text-sm text-ok ring-1 ring-inset ring-ok-edge">Prices, rates and yields are complete.</p>
              )}
            </div>
            {liveIssues.length ? <p className="mt-2 text-xs text-muted">These do not stop you saving a draft. The product cannot be finally costed or released until they are resolved.</p> : null}
          </Card>
        </aside>
      </div>

      <NewMaterialModal
        open={newMaterialOpen}
        onClose={() => setNewMaterialOpen(false)}
        onUse={(m) => {
          addLine(m)
          setNewMaterialOpen(false)
        }}
      />
      <ConfirmDialog
        open={!!confirm}
        tone="danger"
        title={confirm?.title ?? ''}
        body={confirm?.body ?? ''}
        confirmLabel={confirm?.confirmLabel}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          confirm?.run()
          setConfirm(null)
        }}
      />
      <ConfirmDialog
        open={discardOpen}
        tone="danger"
        title="Discard the unsaved draft?"
        body={product ? 'Your unsaved edits are deleted and the form returns to the last saved version of this product.' : 'Everything entered for this new product is deleted. This cannot be undone.'}
        confirmLabel="Discard draft"
        onCancel={() => setDiscardOpen(false)}
        onConfirm={discardDraft}
      />
      {guard.dialog}
    </div>
  )
}

function AutosaveLine({
  status,
  dirty,
  onLoadNewer,
  onKeepMine,
  onRetry,
}: {
  status: AutosaveState
  dirty: boolean
  onLoadNewer: (d: StoredDraft<ProductDraft>) => void
  onKeepMine: () => void
  onRetry: () => void
}) {
  if (status.state === 'newer')
    return (
      <div role="alert" className="rounded-md bg-warn-wash px-3 py-2 text-xs text-warn ring-1 ring-inset ring-warn-edge">
        Another tab saved a newer draft of this product ({new Date(status.newer.savedAt).toLocaleTimeString('en-IN')}). This tab stopped autosaving so it does not overwrite it.
        <span className="mt-1.5 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => onLoadNewer(status.newer)}>
            Load newer draft
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onKeepMine}>
            Keep this tab’s version
          </Button>
        </span>
      </div>
    )
  if (status.state === 'failed')
    return (
      <div role="alert" className="rounded-md bg-risk-wash px-3 py-2 text-xs text-risk ring-1 ring-inset ring-risk-edge">
        Draft backup failed: {status.error} Your entries are still on screen — keep this tab open until the product is saved.
        <Button type="button" size="sm" variant="secondary" className="mt-1.5" onClick={onRetry}>
          Retry backup
        </Button>
      </div>
    )
  if (!dirty && status.state === 'idle') return null
  return (
    <p className="text-center text-xs text-muted" role="status">
      {status.state === 'saving' ? 'Saving draft copy…' : status.state === 'saved' ? `Draft copy saved in this browser at ${new Date(status.at).toLocaleTimeString('en-IN')}` : ''}
    </p>
  )
}

/* --------------------------- Customer specification ------------------------ */

function SpecCard({ spec, errors, onChange }: { spec: ProductSpec | null; errors: Record<string, string>; onChange: (spec: ProductSpec | null) => void }) {
  if (!spec)
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-dashed border-rule-2 px-4 py-3 text-sm text-muted">
        <span className="min-w-0 flex-1">No customer specification recorded (original size, requested quantity, confirmation status).</span>
        <Button type="button" size="sm" variant="secondary" icon={<ClipboardList className="h-4 w-4" />} onClick={() => onChange(blankSpec())}>
          Add specification
        </Button>
      </div>
    )
  const set = (patch: Partial<ProductSpec>) => onChange({ ...spec, ...patch })
  const e = (k: string) => errors[`spec.${k}`]
  return (
    <Card className="vx-anim-up">
      <CardHead
        title="Customer specification"
        subtitle={spec.importKey ? `Imported from source row ${spec.sourceRow ?? '—'}. The original size is kept exactly as supplied.` : 'What the customer supplied, and what still needs confirmation.'}
        icon={<ClipboardList className="h-4 w-4" />}
        actions={<Badge tone={spec.status === 'confirmed' ? 'green' : 'amber'}>{spec.status === 'confirmed' ? 'Confirmed' : 'Proposed — awaiting confirmation'}</Badge>}
      />
      <div className="grid gap-x-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Source name" hint="Customer spelling.">
          <Input value={spec.sourceName} onChange={(ev) => set({ sourceName: ev.target.value })} readOnly={!!spec.importKey} />
        </Field>
        <Field label="Original size string" hint="Unit and basis unknown until confirmed.">
          <Input value={spec.rawSize} onChange={(ev) => set({ rawSize: ev.target.value })} readOnly={!!spec.importKey} className="vx-code" />
        </Field>
        <Field label="Requested batch quantity" error={e('requestedQty')} hint="Order reference, not consumption.">
          <NumberInput value={spec.requestedQty} onChange={(v) => set({ requestedQty: v })} invalid={!!e('requestedQty')} />
        </Field>
        <Field label="Specification status">
          <Select value={spec.status} onChange={(ev) => set({ status: ev.target.value as ProductSpec['status'] })}>
            <option value="proposed">Proposed — awaiting confirmation</option>
            <option value="confirmed">Confirmed with the customer</option>
          </Select>
        </Field>
        <Field label="Confirmed size unit" error={e('sizeUnit')} hint="Blank = unknown.">
          <Input value={spec.sizeUnit ?? ''} onChange={(ev) => set({ sizeUnit: ev.target.value || null })} aria-invalid={!!e('sizeUnit') || undefined} placeholder="Unknown" />
        </Field>
        <Field label="Dimension basis" error={e('dimensionBasis')}>
          <Select value={spec.dimensionBasis ?? ''} onChange={(ev) => set({ dimensionBasis: (ev.target.value || null) as ProductSpec['dimensionBasis'] })} aria-invalid={!!e('dimensionBasis') || undefined}>
            <option value="">Unknown</option>
            <option value="internal">Internal (inside) dimensions</option>
            <option value="external">External (outside) dimensions</option>
          </Select>
        </Field>
        <Field label="Confirmed L × W × H (mm)" as="div" error={e('lengthMm') ?? e('widthMm') ?? e('heightMm')} className="sm:col-span-2">
          <div className="flex gap-2">
            <NumberInput aria-label="Confirmed length in mm" value={spec.lengthMm} onChange={(v) => set({ lengthMm: v })} invalid={!!e('lengthMm')} placeholder="L" />
            <NumberInput aria-label="Confirmed width in mm" value={spec.widthMm} onChange={(v) => set({ widthMm: v })} invalid={!!e('widthMm')} placeholder="W" />
            <NumberInput aria-label="Confirmed height in mm" value={spec.heightMm} onChange={(v) => set({ heightMm: v })} invalid={!!e('heightMm')} placeholder="H" />
          </div>
        </Field>
        <Field label="Construction" className="sm:col-span-2">
          <Input value={spec.construction} onChange={(ev) => set({ construction: ev.target.value })} />
        </Field>
        <Field label="Insert approach" className="sm:col-span-2">
          <Input value={spec.insertApproach} onChange={(ev) => set({ insertApproach: ev.target.value })} />
        </Field>
        <Field label="Search aliases" hint="Comma-separated, e.g. alternative spellings." className="sm:col-span-2">
          <Input value={spec.aliases.join(', ')} onChange={(ev) => set({ aliases: ev.target.value.split(',').map((a) => a.trim()).filter(Boolean) })} />
        </Field>
        <Field label="Open confirmations (one per line)" className="sm:col-span-2 lg:col-span-4">
          <Textarea rows={Math.min(10, Math.max(3, spec.openItems.length + 1))} value={spec.openItems.join('\n')} onChange={(ev) => set({ openItems: ev.target.value.split('\n') })} />
        </Field>
        <Field label="Source notes" className="sm:col-span-2 lg:col-span-4">
          <Textarea rows={5} value={spec.notes} onChange={(ev) => set({ notes: ev.target.value })} />
        </Field>
      </div>
    </Card>
  )
}

/* ------------------------------ Material line ----------------------------- */

function MaterialLineEditor({
  line,
  stages,
  material,
  errors,
  onChange,
  onRemove,
}: {
  line: ProductMaterial
  stages: ProductStage[]
  material?: Material
  errors: Record<string, string>
  onChange: (patch: Partial<ProductMaterial>) => void
  onRemove: () => void
}) {
  const k = (f: string) => errors[`material.${line.id}.${f}`]
  const stage = stages.find((s) => s.id === line.stageId)
  const unit: LengthUnit = material?.sizeUnit ?? 'mm'
  const [overrideOpen, setOverrideOpen] = useState(line.upsOverride !== null)

  if (!material)
    return (
      <li className="flex items-center justify-between rounded-md bg-risk-wash px-4 py-3 text-sm text-risk">
        Material no longer exists in the registry.
        <Button type="button" size="sm" variant="danger-outline" onClick={onRemove}>
          Remove
        </Button>
      </li>
    )

  const yieldResult =
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

  return (
    <li className="rounded-md border border-rule-2 bg-surface p-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">{material.name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <span className="vx-code">{material.code}</span>
            <Badge tone={material.kind === 'sheet' ? 'violet' : 'slate'}>{material.kind === 'sheet' ? 'Sheet' : material.uom}</Badge>
            {material.price === null ? <Badge tone="red">Price missing</Badge> : <span>₹{material.price} per {pricedUnitLabel(material)}</span>}
            {!material.active ? <Badge tone="slate">Inactive</Badge> : null}
          </p>
        </div>
        <Link to={`/master/costing?material=${material.id}`} className="vx-focus rounded-xs text-sm font-medium text-accent-text hover:underline">
          Prices & yield settings
        </Link>
        <IconButton type="button" label={`Remove ${material.name}`} onClick={onRemove} className="hover:text-risk">
          <Trash2 className="h-4 w-4" />
        </IconButton>
      </div>

      <div className="mt-3 grid gap-x-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Used in stage" error={k('stage')}>
          <Select value={line.stageId ?? ''} onChange={(e) => onChange({ stageId: e.target.value || null, processId: null })}>
            <option value="">Whole product</option>
            {stages.map((s, i) => (
              <option key={s.id} value={s.id}>
                {i + 1}. {s.name || 'Unnamed stage'}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Process" error={k('process')}>
          <Select value={line.processId ?? ''} disabled={!stage} onChange={(e) => onChange({ processId: e.target.value || null })}>
            <option value="">{stage ? 'Any process in stage' : 'Select a stage first'}</option>
            {stage?.processes.map((p, i) => (
              <option key={p.id} value={p.id}>
                {i + 1}. {p.name || 'Unnamed process'}
              </option>
            ))}
          </Select>
        </Field>

        {material.kind === 'quantity' ? (
          <Field label={`Quantity per piece (${material.uom})`} error={k('qtyPerPiece')}>
            <NumberInput value={line.qtyPerPiece} onChange={(v) => onChange({ qtyPerPiece: v })} placeholder="Not measured" invalid={!!k('qtyPerPiece')} />
          </Field>
        ) : (
          <>
            <Field label="Cut pieces per product" error={k('piecesPerProduct')}>
              <NumberInput value={line.piecesPerProduct} onChange={(v) => onChange({ piecesPerProduct: v })} placeholder="From the approved cut list" invalid={!!k('piecesPerProduct')} />
            </Field>
            <Field label={`Cut size L × W (${unit})`} error={k('cutLengthMm') ?? k('cutWidthMm')} as="div">
              <div className="flex gap-2">
                <NumberInput aria-label={`Cut length in ${unit}`} value={fromMm(line.cutLengthMm, unit)} onChange={(v) => onChange({ cutLengthMm: v === null ? null : Number.isNaN(v) ? NaN : toMm(v, unit) })} invalid={!!k('cutLengthMm')} />
                <NumberInput aria-label={`Cut width in ${unit}`} value={fromMm(line.cutWidthMm, unit)} onChange={(v) => onChange({ cutWidthMm: v === null ? null : Number.isNaN(v) ? NaN : toMm(v, unit) })} invalid={!!k('cutWidthMm')} />
              </div>
            </Field>
            <div className="sm:col-span-2 lg:col-span-4">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <label className="flex min-h-6 cursor-pointer items-center gap-2 text-sm text-ink-2">
                  <input type="checkbox" checked={line.rotationAllowed} onChange={(e) => onChange({ rotationAllowed: e.target.checked })} className="h-4 w-4 accent-[var(--color-accent)]" />
                  Rotation allowed on the sheet
                </label>
                <p className="text-sm text-muted" aria-live="polite">
                  {!material.sheetLengthMm || !material.sheetWidthMm
                    ? 'Sheet size not set in Master → Costing yet.'
                    : !yieldResult
                      ? 'Enter the cut size to calculate ups.'
                      : yieldResult.error
                        ? <span className="text-risk">{yieldResult.error}</span>
                        : `${yieldResult.ups} ups per sheet (${yieldResult.along} × ${yieldResult.across}${yieldResult.orientation === 'rotated' ? ', rotated' : ''}) · ${yieldResult.yieldPct.toFixed(1)}% of sheet used`}
                </p>
                <button type="button" className="vx-focus rounded-xs text-sm font-medium text-accent-text hover:underline" aria-expanded={overrideOpen} onClick={() => setOverrideOpen((v) => !v)}>
                  {overrideOpen ? 'Hide yield override' : 'Override yield…'}
                </button>
              </div>
              {overrideOpen ? (
                <div className="mt-3 grid gap-x-3 rounded-md bg-surface-2 p-3 sm:grid-cols-3">
                  <Field label="Ups override" error={k('upsOverride')} hint="For nested or irregular layouts.">
                    <NumberInput value={line.upsOverride} onChange={(v) => onChange({ upsOverride: v })} invalid={!!k('upsOverride')} />
                  </Field>
                  <Field label="Reason" className="sm:col-span-2">
                    <Input value={line.upsOverrideReason} onChange={(e) => onChange({ upsOverrideReason: e.target.value })} placeholder="e.g. Interlocking die-line from vendor layout…" />
                  </Field>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </li>
  )
}

/* ------------------------------ New material ------------------------------ */

function NewMaterialModal({ open, onClose, onUse }: { open: boolean; onClose: () => void; onUse: (m: Material) => void }) {
  const { db, run, pushToast } = useStore()
  const [draft, setDraft] = useState<MaterialDraft>(() => blankMaterialDraft('sheet'))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (patch: Partial<MaterialDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const term = draft.name.trim().toLowerCase()
  const matches = term.length >= 2 ? db.materials.filter((m) => m.name.toLowerCase().includes(term) || m.code.toLowerCase().includes(term)).slice(0, 5) : []

  const reset = () => {
    setDraft(blankMaterialDraft('sheet'))
    setErrors({})
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title="New material"
      subtitle="Added to the shared registry and linked to this product"
      icon={<Boxes className="h-5 w-5" />}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              reset()
              onClose()
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={async () => {
              const r = await run(saveMaterial(draft))
              if (!r.ok) {
                setErrors(r.fieldErrors ?? {})
                focusFirstInvalid()
                return
              }
              pushToast({ title: `${r.value.name} added to the registry`, message: r.value.price === null ? 'Its price is still missing — set it in Master → Costing.' : undefined, level: 'success' })
              reset()
              onUse(r.value)
            }}
          >
            Create & add
          </Button>
        </>
      }
    >
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Material name" required error={errors.name} className="sm:col-span-2">
          <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} aria-invalid={!!errors.name || undefined} autoComplete="off" />
        </Field>
        {matches.length ? (
          <div className="mb-4 rounded-md bg-accent-wash p-3 sm:col-span-2" aria-live="polite">
            <p className="text-sm font-medium text-accent-text">Already in the registry — reuse instead of creating a duplicate:</p>
            <ul className="mt-2 space-y-1">
              {matches.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate text-ink-2">
                    {m.name} <span className="vx-code text-faint">{m.code}</span>
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      reset()
                      onUse(m)
                    }}
                  >
                    Use this
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <Field label="Material type" as="div" error={errors.kind} className="sm:col-span-2">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Material type">
            {(
              [
                ['sheet', 'Sheet material', 'Cut into pieces from a sheet — yield applies'],
                ['quantity', 'Quantity material', 'Consumed per finished piece'],
              ] as Array<[MaterialKind, string, string]>
            ).map(([kind, label, hint]) => (
              <label key={kind} className={cx('vx-press flex flex-1 cursor-pointer items-start gap-2 rounded-md border px-3 py-2.5', draft.kind === kind ? 'border-accent bg-accent-wash' : 'border-rule-2 hover:bg-surface-2')}>
                <input type="radio" name="material-kind" className="mt-1 accent-[var(--color-accent)]" checked={draft.kind === kind} onChange={() => setDraft({ ...blankMaterialDraft(kind), name: draft.name, price: draft.price })} />
                <span>
                  <span className="block text-sm font-medium text-ink">{label}</span>
                  <span className="block text-xs text-muted">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </Field>
        {draft.kind === 'quantity' ? (
          <Field label="Unit of measure" required error={errors.uom}>
            <Input value={draft.uom} onChange={(e) => set({ uom: e.target.value })} aria-invalid={!!errors.uom || undefined} placeholder="kg, nos, mtr…" />
          </Field>
        ) : (
          <Field label={`Sheet size L × W (${draft.sizeUnit})`} as="div" error={errors.sheetLengthMm ?? errors.sheetWidthMm} hint="Optional now; required before costing.">
            <div className="flex gap-2">
              <NumberInput aria-label="Sheet length" value={fromMm(draft.sheetLengthMm, draft.sizeUnit)} onChange={(v) => set({ sheetLengthMm: v === null ? null : Number.isNaN(v) ? NaN : toMm(v, draft.sizeUnit) })} />
              <NumberInput aria-label="Sheet width" value={fromMm(draft.sheetWidthMm, draft.sizeUnit)} onChange={(v) => set({ sheetWidthMm: v === null ? null : Number.isNaN(v) ? NaN : toMm(v, draft.sizeUnit) })} />
              <Select aria-label="Size unit" value={draft.sizeUnit} onChange={(e) => set({ sizeUnit: e.target.value as LengthUnit })} className="w-20">
                <option value="mm">mm</option>
                <option value="cm">cm</option>
                <option value="in">in</option>
              </Select>
            </div>
          </Field>
        )}
        <Field label={`Price ₹ per ${draft.kind === 'sheet' ? 'sheet' : draft.uom || 'unit'}`} error={errors.price} hint="Leave blank if not known yet.">
          <NumberInput value={draft.price} onChange={(v) => set({ price: v })} invalid={!!errors.price} />
        </Field>
        <Field label="Wastage %" error={errors.wastagePct}>
          <NumberInput value={draft.wastagePct} onChange={(v) => set({ wastagePct: v ?? 0 })} invalid={!!errors.wastagePct} />
        </Field>
      </div>
    </Modal>
  )
}
