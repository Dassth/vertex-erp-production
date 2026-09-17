import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Circle } from 'lucide-react'
import { useStore } from '../store/store'
import type { VertexDB } from '../lib/types'
import { materialConfigIssues, usageConfigIssues } from '../lib/costing'
import { companyInvoiceIssues } from '../domain/dispatch'
import { cx } from '../lib/format'
import { Drawer } from './ui'

export interface WorkflowStep {
  key: string
  title: string
  detail: string
  done: boolean
  to: string
  action: string
}

export function workflowSteps(db: VertexDB): WorkflowStep[] {
  const materialProblems = db.materials.filter((m) => m.active && materialConfigIssues(m).length).length
  const usageProblems = db.products.reduce(
    (n, p) =>
      n +
      p.materials.filter((l) => {
        const m = db.materials.find((x) => x.id === l.materialId)
        return m ? usageConfigIssues(l, m).length > 0 : true
      }).length,
    0,
  )
  const companyProblems = companyInvoiceIssues(db.company, db.settings.taxPct)
  const finalized = db.costings.filter((c) => c.status === 'Finalized').length
  const completed = db.orders.filter((o) => o.status === 'Completed').length
  return [
    {
      key: 'products',
      title: 'Master → Products',
      detail: db.products.length ? `${db.products.length} product(s) with stages, processes and materials.` : 'Create a product, its stages, processes and materials.',
      done: db.products.length > 0,
      to: '/master/products',
      action: db.products.length ? 'Review products' : 'Create a product',
    },
    {
      key: 'prices',
      title: 'Master → Costing',
      detail: !db.materials.length
        ? 'Materials appear here after you add them to a product.'
        : materialProblems + usageProblems
          ? `${materialProblems} material(s) and ${usageProblems} product usage(s) still need prices or yield settings.`
          : 'All material prices and yield settings are complete.',
      done: db.materials.length > 0 && materialProblems + usageProblems === 0,
      to: '/master/costing',
      action: 'Open costing configuration',
    },
    {
      key: 'customers',
      title: 'Master → Customers',
      detail: db.customers.length ? `${db.customers.length} customer(s).` : 'Add the customers you plan orders for.',
      done: db.customers.length > 0,
      to: '/master/customers',
      action: db.customers.length ? 'Review customers' : 'Add a customer',
    },
    {
      key: 'planning',
      title: 'Planning',
      detail: db.plans.length ? `${db.plans.length} plan(s) created.` : 'Plan an order and assign a unit to every stage.',
      done: db.plans.some((p) => p.status !== 'Draft' && p.status !== 'Cancelled'),
      to: '/planning',
      action: 'Open planning',
    },
    {
      key: 'costing',
      title: 'Costing',
      detail: finalized ? `${finalized} order costing(s) finalized.` : 'Calculate, review and finalize the plan’s costing.',
      done: finalized > 0,
      to: '/costing',
      action: 'Open order costing',
    },
    {
      key: 'production',
      title: 'Production',
      detail: db.orders.length ? `${db.orders.length} order(s), ${completed} completed.` : 'Orders appear here automatically after costing is finalized.',
      done: completed > 0,
      to: '/production',
      action: 'Open production',
    },
    {
      key: 'company',
      title: 'Company profile',
      detail: companyProblems.length ? companyProblems.join(' ') : 'Invoice identity is complete.',
      done: companyProblems.length === 0,
      to: '/dispatch',
      action: 'Needed before invoicing',
    },
    {
      key: 'billing',
      title: 'Dispatch & Billing',
      detail: db.invoices.length ? `${db.invoices.length} invoice(s) issued.` : 'Dispatch completed orders; each dispatch issues an invoice.',
      done: db.invoices.length > 0,
      to: '/dispatch',
      action: 'Open dispatch',
    },
  ]
}

export function SetupGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db } = useStore()
  const steps = useMemo(() => workflowSteps(db), [db])
  return (
    <Drawer open={open} onClose={onClose} title="Workflow guide" subtitle="Master setup → Planning → Costing → Production → Dispatch → Billing">
      <ol className="space-y-2.5">
        {steps.map((s, i) => (
          <li key={s.key} className={cx('vx-tile flex gap-3 px-4 py-3', s.done && 'bg-surface-2')}>
            <span className="mt-0.5 shrink-0" aria-hidden="true">
              {s.done ? <CheckCircle2 className="h-5 w-5 text-ok" /> : <Circle className="h-5 w-5 text-faint" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-ink">
                <span className="vx-code mr-1.5 text-muted">{i + 1}.</span>
                {s.title}
                <span className="sr-only">{s.done ? ' — complete' : ' — to do'}</span>
              </p>
              <p className="mt-0.5 text-sm text-muted">{s.detail}</p>
              <Link to={s.to} onClick={onClose} className="vx-focus mt-1.5 inline-flex items-center gap-1 rounded-xs text-sm font-medium text-accent-text hover:underline">
                {s.action}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-5 text-xs leading-relaxed text-muted">
        The company profile (name, address, GSTIN) is under the account menu → Company profile.
      </p>
    </Drawer>
  )
}
