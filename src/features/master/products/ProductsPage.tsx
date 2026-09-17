import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Boxes, CheckCircle2, FileInput, Layers, Package, Pencil, Plus, Search, TriangleAlert } from 'lucide-react'
import { useStore } from '../../../store/store'
import type { Product } from '../../../lib/types'
import { deleteProduct, setProductActive } from '../../../domain/master'
import { fmtDate } from '../../../lib/format'
import { Badge, Button, Card, CardHead, ConfirmDialog, EmptyState, Modal, SearchInput, Select } from '../../../components/ui'
import { importProductTemplates, planTemplateImport, TEMPLATE_BATCHES } from '../../../domain/imports'
import type { ImportResult } from '../../../domain/imports'
import { JEWELLERY_BATCH_ID } from '../../../lib/templates/jewelleryBoxes'
import { LinkButton, PageHeader, StatStrip, StatTile, useDocumentTitle } from '../../../components/page'
import { ActiveBadge } from '../../../components/status'
import { productIssues } from '../masterSelectors'

type StatusFilter = 'all' | 'active' | 'inactive' | 'issues'

export function ProductsPage() {
  useDocumentTitle('Master · Products')
  const { db, run, pushToast, can } = useStore()
  const [importOpen, setImportOpen] = useState(false)
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const status = (params.get('status') ?? 'all') as StatusFilter
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null)

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value && value !== 'all') next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const rows = useMemo(
    () =>
      db.products.map((p) => ({
        product: p,
        issues: productIssues(db, { productId: p.id, stages: p.stages, materials: p.materials, spec: p.spec }),
        plans: db.plans.filter((x) => x.productId === p.id).length,
        processes: p.stages.reduce((n, s) => n + s.processes.length, 0),
      })),
    [db],
  )

  const filtered = rows
    .filter((r) => (status === 'active' ? r.product.active : status === 'inactive' ? !r.product.active : status === 'issues' ? r.issues.length > 0 : true))
    .filter(
      (r) =>
        !q.trim() ||
        `${r.product.name} ${r.product.code} ${r.product.category} ${r.product.spec?.sourceName ?? ''} ${r.product.spec?.rawSize ?? ''} ${r.product.spec?.aliases.join(' ') ?? ''}`
          .toLowerCase()
          .includes(q.trim().toLowerCase()),
    )
    .sort((a, b) => Number(b.product.active) - Number(a.product.active) || a.product.name.localeCompare(b.product.name))

  const withIssues = rows.filter((r) => r.issues.length).length

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Master"
        title="Products"
        subtitle="Reusable product definitions: ordered stages, the processes inside each stage, and the materials they consume. Planning and costing read these definitions; they never change them."
        icon={<Package className="h-4 w-4" />}
        actions={
          <div className="flex flex-wrap gap-2">
            {can('master') ? (
              <Button variant="secondary" icon={<FileInput className="h-4 w-4" />} onClick={() => setImportOpen(true)}>
                Import product templates…
              </Button>
            ) : null}
            <LinkButton to="/master/products/new" icon={<Plus className="h-4 w-4" />}>
              New product
            </LinkButton>
          </div>
        }
      />

      <StatStrip className="grid-cols-2 lg:grid-cols-4">
        <StatTile label="Products" value={String(db.products.length)} icon={<Package className="h-4 w-4" />} tone="indigo" hint={`${db.products.filter((p) => p.active).length} active`} onClick={() => setParam('status', 'all')} active={status === 'all'} />
        <StatTile label="Needs setup" value={String(withIssues)} icon={<TriangleAlert className="h-4 w-4" />} tone="amber" hint="Missing prices, rates or yields" onClick={() => setParam('status', 'issues')} active={status === 'issues'} />
        <StatTile label="Materials" value={String(db.materials.length)} icon={<Boxes className="h-4 w-4" />} tone="violet" hint="In the shared registry" />
        <StatTile label="Stages defined" value={String(db.products.reduce((n, p) => n + p.stages.length, 0))} icon={<Layers className="h-4 w-4" />} tone="slate" hint="Across all products" />
      </StatStrip>

      <Card className="vx-anim-up overflow-hidden">
        <CardHead
          title="Product register"
          subtitle={`${filtered.length} of ${rows.length} products`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput value={q} onChange={(v) => setParam('q', v)} placeholder="Search name, size, code, alias…" className="w-full sm:w-64" />
              <Select aria-label="Filter products" value={status} onChange={(e) => setParam('status', e.target.value)} className="w-full sm:w-44">
                <option value="all">All products</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="issues">Needs setup</option>
              </Select>
            </div>
          }
        />
        {rows.length === 0 ? (
          <EmptyState
            icon={<Package className="h-6 w-6" />}
            title="No products yet"
            message="Start with a product: give it a name, choose how many stages it passes through, then add processes and materials to each stage."
            action={
              <LinkButton to="/master/products/new" icon={<Plus className="h-4 w-4" />}>
                Create the first product
              </LinkButton>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Search className="h-6 w-6" />}
            title="No products match"
            message="Clear the search or choose another filter."
            action={
              <Button variant="secondary" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr>
                  <th className="vx-th">Product</th>
                  <th className="vx-th text-right">Stages</th>
                  <th className="vx-th text-right">Processes</th>
                  <th className="vx-th text-right">Materials</th>
                  <th className="vx-th">Configuration</th>
                  <th className="vx-th text-right">Plans</th>
                  <th className="vx-th">Updated</th>
                  <th className="vx-th">Status</th>
                  <th className="vx-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ product: p, issues, plans, processes }) => (
                  <tr key={p.id} className="vx-row">
                    <td className="vx-td vx-td-wrap">
                      <Link to={`/master/products/${p.id}`} className="vx-focus rounded-xs font-medium text-ink hover:text-accent-text hover:underline">
                        {p.name}
                      </Link>
                      <span className="block text-2xs text-faint">
                        <span className="vx-code">{p.code}</span>
                        {p.category ? ` · ${p.category}` : ''}
                        {p.spec ? (
                          <>
                            {' · size '}
                            <span className="vx-code">{p.spec.rawSize || '—'}</span>
                            {p.spec.sizeUnit ? ` ${p.spec.sizeUnit}` : ' (unit unconfirmed)'}
                            {p.spec.requestedQty !== null ? ` · requested ${p.spec.requestedQty}` : ''}
                          </>
                        ) : null}
                      </span>
                      {p.spec?.status === 'proposed' ? (
                        <Badge tone="amber" className="mt-1">
                          Proposed specification
                        </Badge>
                      ) : null}
                    </td>
                    <td className="vx-td text-right tabular-nums">{p.stages.length}</td>
                    <td className="vx-td text-right tabular-nums">{processes}</td>
                    <td className="vx-td text-right tabular-nums">{p.materials.length}</td>
                    <td className="vx-td">
                      {issues.length ? (
                        <Badge tone="amber">
                          <TriangleAlert className="h-3 w-3" aria-hidden="true" />
                          {issues.length} to fix
                        </Badge>
                      ) : (
                        <Badge tone="green">
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          Ready to cost
                        </Badge>
                      )}
                    </td>
                    <td className="vx-td text-right tabular-nums">{plans}</td>
                    <td className="vx-td">
                      <span className="block text-ink-2">{fmtDate(p.updatedAt)}</span>
                      <span className="block text-2xs text-faint">
                        v{p.version} · {p.updatedBy}
                      </span>
                    </td>
                    <td className="vx-td">
                      <ActiveBadge active={p.active} />
                    </td>
                    <td className="vx-td">
                      <div className="flex items-center justify-end gap-1">
                        <LinkButton to={`/master/products/${p.id}`} variant="secondary" size="sm" icon={<Pencil className="h-3.5 w-3.5" />}>
                          Edit
                        </LinkButton>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            const r = await run(setProductActive(p.id, !p.active))
                            if (r.ok) pushToast({ title: p.active ? `${p.name} deactivated` : `${p.name} reactivated`, message: p.active ? 'It can no longer be selected in new plans.' : undefined, level: 'info' })
                          }}
                        >
                          {p.active ? 'Deactivate' : 'Activate'}
                        </Button>
                        {plans === 0 ? (
                          <Button size="sm" variant="ghost" className="text-risk hover:bg-risk-wash" onClick={() => setPendingDelete(p)}>
                            Delete…
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {importOpen ? <ImportTemplatesDialog onClose={() => setImportOpen(false)} /> : null}

      <ConfirmDialog
        open={!!pendingDelete}
        tone="danger"
        title={`Delete ${pendingDelete?.name ?? ''}?`}
        body="The product has never been planned, so it can be removed. Its materials stay in the shared registry."
        confirmLabel="Delete product"
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (pendingDelete) {
            const r = await run(deleteProduct(pendingDelete.id))
            pushToast(r.ok ? { title: 'Product deleted', level: 'info' } : { title: 'Cannot delete', message: r.error, level: 'danger' })
          }
          setPendingDelete(null)
        }}
      />
    </div>
  )
}

/* ------------------------------ Template import ---------------------------- */

function ImportTemplatesDialog({ onClose }: { onClose: () => void }) {
  const { db, run, pushToast } = useStore()
  const batch = TEMPLATE_BATCHES[JEWELLERY_BATCH_ID]
  const plan = useMemo(() => planTemplateImport(db, JEWELLERY_BATCH_ID), [db])
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')
  if (!plan) return null
  const creating = plan.rows.filter((r) => r.kind === 'create').length

  const doImport = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const r = await run(importProductTemplates(JEWELLERY_BATCH_ID))
      if (!r.ok) {
        setError(r.error)
        pushToast({ title: 'Import not completed', message: r.error, level: 'danger' })
        return
      }
      setResult(r.value)
      pushToast({
        title: r.value.created.length ? `${r.value.created.length} products imported as drafts` : 'Nothing new to import',
        message: r.value.created.length ? 'Specifications are proposals awaiting confirmation; costing details need attention.' : 'Every row already exists — nothing was changed.',
        level: r.value.created.length ? 'success' : 'info',
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
      title="Import product templates"
      subtitle={batch.title}
      icon={<FileInput className="h-5 w-5" />}
      footer={
        result ? (
          <Button onClick={onClose}>Close</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button icon={<FileInput className="h-4 w-4" />} loading={busy} disabled={!creating} onClick={doImport}>
              {creating ? `Import ${creating} product${creating === 1 ? '' : 's'}` : 'Nothing to import'}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4 text-sm">
        <p className="rounded-md bg-warn-wash px-3 py-2 text-warn ring-1 ring-inset ring-warn-edge">
          These are <strong>proposed</strong> specifications, not confirmed customer requirements. Original size strings and the requested quantity (25) are kept as supplied; size unit, height, times, rates, prices and material quantities stay blank until confirmed. Products are saved as drafts that cannot be finally costed until confirmed.
        </p>
        {error ? (
          <p role="alert" className="rounded-md bg-risk-wash px-3 py-2 text-risk ring-1 ring-inset ring-risk-edge">
            {error}
          </p>
        ) : null}
        <table className="w-full">
          <thead>
            <tr>
              <th className="vx-th">Row</th>
              <th className="vx-th">Product — original size</th>
              <th className="vx-th">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {plan.rows.map((r) => {
              const t = batch.products.find((x) => x.key === r.key)!
              const created = result?.created.find((c) => c.name === r.name)
              return (
                <tr key={r.key} className="vx-row">
                  <td className="vx-td vx-code">{t.sourceRow}</td>
                  <td className="vx-td">
                    {r.name}
                    <span className="block text-2xs text-faint">{t.insertApproach}</span>
                  </td>
                  <td className="vx-td">
                    {created ? (
                      <Badge tone="green">Imported as {created.code}</Badge>
                    ) : r.kind === 'create' ? (
                      <Badge tone="indigo">Will be created</Badge>
                    ) : r.kind === 'already-imported' ? (
                      <Badge tone="slate">Already imported ({r.code}) — unchanged</Badge>
                    ) : (
                      <span className="text-warn">
                        Not imported: {r.reason} ({r.code})
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="text-muted">
          {plan.materialsToCreate.length
            ? `${plan.materialsToCreate.length} candidate materials will be added to the registry without prices or sizes.`
            : 'All candidate materials already exist in the registry.'}
          {plan.materialsReused.length ? ` ${plan.materialsReused.length} existing materials are reused unchanged.` : ''}
        </p>
      </div>
    </Modal>
  )
}
