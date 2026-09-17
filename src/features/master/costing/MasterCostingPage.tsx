import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BadgeIndianRupee, Boxes, CircleSlash, Settings2, TriangleAlert } from 'lucide-react'
import { useStore } from '../../../store/store'
import { PRICING_BASIS_LABEL, pricedUnitLabel } from '../../../lib/costing'
import { fromMm } from '../../../lib/yield'
import { cx, fmtDate, moneyPaise } from '../../../lib/format'
import { Badge, Button, Card, CardHead, EmptyState, Pagination, SearchInput, Segmented, Select } from '../../../components/ui'
import { LinkButton, PageHeader, StatStrip, StatTile, useDocumentTitle } from '../../../components/page'
import { materialRows } from '../masterSelectors'
import type { MaterialRow } from '../masterSelectors'
import { MaterialDrawer } from './MaterialDrawer'
import { DefaultsPanel, ProcessChargesPanel } from './ConfigPanels'

type Tab = 'materials' | 'charges' | 'defaults'
type Filter = 'all' | 'missing-price' | 'needs-config' | 'sheet' | 'quantity' | 'unused' | 'inactive'
type Sort = 'priority' | 'name' | 'price' | 'updated'
const PAGE_SIZE = 25

export function MasterCostingPage() {
  useDocumentTitle('Master · Costing configuration')
  const { db } = useStore()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') ?? 'materials') as Tab
  const filter = (params.get('filter') ?? 'all') as Filter
  const sort = (params.get('sort') ?? 'priority') as Sort
  const q = params.get('q') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const materialId = params.get('material')

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '' || (k === 'tab' && v === 'materials') || (k === 'filter' && v === 'all') || (k === 'sort' && v === 'priority') || (k === 'page' && v === '1')) next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: !('material' in patch) })
  }

  const rows = useMemo(() => materialRows(db), [db])
  const counts = {
    missing: rows.filter((r) => r.missingPrice && r.material.active).length,
    config: rows.filter((r) => r.needsConfig && r.material.active).length,
    unused: rows.filter((r) => r.unused).length,
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    const list = rows.filter((r) => {
      const m = r.material
      if (term && !`${m.name} ${m.code} ${m.supplier} ${r.usages.map((u) => u.product.name).join(' ')}`.toLowerCase().includes(term)) return false
      switch (filter) {
        case 'missing-price':
          return r.missingPrice
        case 'needs-config':
          return r.needsConfig
        case 'sheet':
          return m.kind === 'sheet'
        case 'quantity':
          return m.kind === 'quantity'
        case 'unused':
          return r.unused
        case 'inactive':
          return !m.active
        default:
          return true
      }
    })
    const rank = (r: MaterialRow) => (!r.material.active ? 3 : r.missingPrice ? 0 : r.needsConfig ? 1 : 2)
    return list.sort((a, b) => {
      if (sort === 'name') return a.material.name.localeCompare(b.material.name)
      if (sort === 'price') return (b.material.price ?? -1) - (a.material.price ?? -1)
      if (sort === 'updated') return b.material.updatedAt.localeCompare(a.material.updatedAt)
      return rank(a) - rank(b) || a.material.name.localeCompare(b.material.name)
    })
  }, [rows, q, filter, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = filtered.slice((Math.min(page, pageCount) - 1) * PAGE_SIZE, Math.min(page, pageCount) * PAGE_SIZE)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Master"
        title="Costing configuration"
        subtitle={
          <>
            Shared material prices, sheet yield settings, reusable process charges and costing defaults. Every order costing reads these values; to cost a specific planned order use the main{' '}
            <Link to="/costing" className="vx-focus rounded-xs font-medium text-accent-text hover:underline">
              Costing
            </Link>{' '}
            module.
          </>
        }
        icon={<BadgeIndianRupee className="h-4 w-4" />}
      />

      <StatStrip className="grid-cols-2 lg:grid-cols-4">
        <StatTile label="Materials" value={String(rows.length)} icon={<Boxes className="h-4 w-4" />} tone="indigo" hint="From all products" onClick={() => update({ tab: 'materials', filter: 'all', page: null })} active={tab === 'materials' && filter === 'all'} />
        <StatTile label="Price missing" value={String(counts.missing)} icon={<TriangleAlert className="h-4 w-4" />} tone="red" hint="Blocks order costing" onClick={() => update({ tab: 'materials', filter: 'missing-price', page: null })} active={tab === 'materials' && filter === 'missing-price'} />
        <StatTile label="Needs configuration" value={String(counts.config)} icon={<Settings2 className="h-4 w-4" />} tone="amber" hint="Sheet size, cut size, pack…" onClick={() => update({ tab: 'materials', filter: 'needs-config', page: null })} active={tab === 'materials' && filter === 'needs-config'} />
        <StatTile label="Unused" value={String(counts.unused)} icon={<CircleSlash className="h-4 w-4" />} tone="slate" hint="Not linked to any product" onClick={() => update({ tab: 'materials', filter: 'unused', page: null })} active={tab === 'materials' && filter === 'unused'} />
      </StatStrip>

      <Segmented
        value={tab}
        onChange={(v) => update({ tab: v, page: null })}
        options={[
          { value: 'materials', label: 'Materials & yield', count: rows.length },
          { value: 'charges', label: 'Process charges', count: db.settings.processCharges.length },
          { value: 'defaults', label: 'Defaults & order charges' },
        ]}
      />

      {tab === 'materials' ? (
        <Card className="vx-anim-up overflow-hidden">
          <CardHead
            title="Material register"
            subtitle={`${filtered.length} of ${rows.length} · materials appear here automatically when added to a product`}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <SearchInput value={q} onChange={(v) => update({ q: v, page: null })} placeholder="Search material, code, product…" className="w-full sm:w-64" />
                <Select aria-label="Filter materials" value={filter} onChange={(e) => update({ filter: e.target.value, page: null })} className="w-full sm:w-44">
                  <option value="all">All materials</option>
                  <option value="missing-price">Price missing</option>
                  <option value="needs-config">Needs configuration</option>
                  <option value="sheet">Sheet materials</option>
                  <option value="quantity">Quantity materials</option>
                  <option value="unused">Unused</option>
                  <option value="inactive">Inactive</option>
                </Select>
                <Select aria-label="Sort materials" value={sort} onChange={(e) => update({ sort: e.target.value })} className="w-full sm:w-48">
                  <option value="priority">Sort: needs attention first</option>
                  <option value="name">Sort: name</option>
                  <option value="price">Sort: price (high → low)</option>
                  <option value="updated">Sort: recently updated</option>
                </Select>
              </div>
            }
          />
          {rows.length === 0 ? (
            <EmptyState
              icon={<Boxes className="h-6 w-6" />}
              title="No materials yet"
              message="Materials are defined while building a product. Add a product with its materials, then return here to set prices and yield."
              action={<LinkButton to="/master/products/new">Create a product</LinkButton>}
            />
          ) : filtered.length === 0 ? (
            <EmptyState icon={<Boxes className="h-6 w-6" />} title="Nothing matches" message="Clear the search or pick another filter." action={<Button variant="secondary" onClick={() => setParams(new URLSearchParams(), { replace: true })}>Clear filters</Button>} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px]">
                <thead>
                  <tr>
                    <th className="vx-th">Material</th>
                    <th className="vx-th">Unit</th>
                    <th className="vx-th">Used by</th>
                    <th className="vx-th text-right">Price</th>
                    <th className="vx-th">Pricing basis</th>
                    <th className="vx-th">Sheet · yield · wastage</th>
                    <th className="vx-th">Status</th>
                    <th className="vx-th text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {current.map((r) => {
                    const m = r.material
                    const u = m.sizeUnit
                    return (
                      <tr key={m.id} className={cx('vx-row', r.missingPrice && m.active && 'bg-risk-wash/40')}>
                        <td className="vx-td vx-td-wrap">
                          <span className="block font-medium text-ink">{m.name}</span>
                          <span className="vx-code block text-2xs text-faint">{m.code}</span>
                          {m.approval === 'candidate' ? (
                            <Badge tone="amber" className="mt-1">
                              Candidate — awaiting confirmation
                            </Badge>
                          ) : null}
                        </td>
                        <td className="vx-td">
                          <Badge tone={m.kind === 'sheet' ? 'violet' : 'slate'}>{m.kind === 'sheet' ? 'Sheet' : m.uom}</Badge>
                        </td>
                        <td className="vx-td vx-td-wrap max-w-[240px]">
                          {r.usages.length ? (
                            <span className="text-sm text-ink-2">{[...new Set(r.usages.map((x) => x.product.name))].join(', ')}</span>
                          ) : (
                            <span className="text-sm text-faint">Not used</span>
                          )}
                        </td>
                        <td className="vx-td text-right">
                          {m.price === null ? (
                            <Badge tone="red">
                              <TriangleAlert className="h-3 w-3" aria-hidden="true" />
                              Not set
                            </Badge>
                          ) : (
                            <span className="vx-code text-ink">
                              {moneyPaise(m.price)}
                              {m.price === 0 ? <span className="block text-2xs text-muted">explicit zero</span> : null}
                            </span>
                          )}
                        </td>
                        <td className="vx-td text-sm">
                          <span className="block">{PRICING_BASIS_LABEL[m.pricingBasis]}</span>
                          <span className="block text-2xs text-faint">per {pricedUnitLabel(m)} · rounding {m.purchaseMultiple}</span>
                        </td>
                        <td className="vx-td text-sm">
                          {m.kind === 'sheet' ? (
                            <>
                              <span className="block">
                                {m.sheetLengthMm && m.sheetWidthMm ? `${fromMm(m.sheetLengthMm, u)} × ${fromMm(m.sheetWidthMm, u)} ${u}` : <span className="text-risk">Sheet size missing</span>}
                              </span>
                              <span className="block text-2xs text-faint">
                                edge {fromMm(m.edgeMarginMm, u)} · gap {fromMm(m.cutGapMm, u)} {u} · wastage {m.wastagePct}% · {r.usages.length} usage(s)
                              </span>
                            </>
                          ) : (
                            <span className="block">Wastage {m.wastagePct}%</span>
                          )}
                        </td>
                        <td className="vx-td vx-td-wrap max-w-[220px]">
                          {!m.active ? (
                            <Badge tone="slate">Inactive</Badge>
                          ) : r.issues.length || r.usageIssueCount ? (
                            <span className="block text-xs text-warn">{[...r.issues, ...(r.usageIssueCount ? [`${r.usageIssueCount} usage setting(s)`] : [])].join(' · ')}</span>
                          ) : (
                            <Badge tone="green" dot>
                              Ready
                            </Badge>
                          )}
                          <span className="mt-0.5 block text-2xs text-faint">Updated {fmtDate(m.updatedAt)}</span>
                        </td>
                        <td className="vx-td text-right">
                          <Button size="sm" variant={r.missingPrice || r.needsConfig ? 'primary' : 'secondary'} onClick={() => update({ material: m.id })}>
                            {r.missingPrice ? 'Set price' : 'Configure'}
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {filtered.length ? <Pagination page={Math.min(page, pageCount)} pageCount={pageCount} total={filtered.length} onChange={(p) => update({ page: String(p) })} label="materials" /> : null}
        </Card>
      ) : tab === 'charges' ? (
        <ProcessChargesPanel />
      ) : (
        <DefaultsPanel />
      )}

      <MaterialDrawer materialId={materialId} onClose={() => update({ material: null })} />
    </div>
  )
}
