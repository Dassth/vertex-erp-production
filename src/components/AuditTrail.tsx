import { ArrowRight, History } from 'lucide-react'
import type { AuditEntry } from '../lib/types'
import { fmtDateTime } from '../lib/format'
import { Badge, EmptyState } from './ui'
import type { Tone } from './ui'

const ENTITY_TONE: Record<AuditEntry['entity'], Tone> = {
  Product: 'indigo',
  Material: 'violet',
  'Costing Config': 'violet',
  Customer: 'green',
  Plan: 'amber',
  Costing: 'violet',
  'Production Order': 'indigo',
  Stage: 'blue',
  Process: 'blue',
  Resource: 'violet',
  Dispatch: 'blue',
  Invoice: 'green',
  Account: 'slate',
  System: 'slate',
}

const ROLE_LABEL: Record<AuditEntry['role'], string> = {
  admin: 'Administrator',
  unit: 'Unit user',
  system: 'System',
}

export function AuditTrail({ entries, limit = 150 }: { entries: AuditEntry[]; limit?: number }) {
  if (!entries.length) {
    return (
      <EmptyState
        icon={<History className="h-6 w-6" />}
        title="No activity recorded yet"
        message="Master changes, planning, costing, stage updates, dispatches and invoices are recorded here with the account, time and old/new values."
      />
    )
  }

  const shown = entries.slice(0, limit)
  return (
    <ol className="relative">
      {shown.map((e, i) => (
        <li key={e.id} className="relative flex gap-3 pb-5">
          <div className="flex flex-col items-center" aria-hidden="true">
            <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-accent ring-4 ring-accent-edge" />
            {i < shown.length - 1 ? <span className="mt-1 w-px flex-1 bg-hairline" /> : null}
          </div>
          <div className="min-w-0 flex-1 rounded-md border border-rule bg-surface-2 px-3.5 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-ink">{e.action}</span>
              <Badge tone={ENTITY_TONE[e.entity] ?? 'slate'}>{e.entity}</Badge>
            </div>
            <p className="mt-0.5 break-words text-sm text-ink-2">{e.entityLabel}</p>
            {e.field || e.newValue ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                {e.field ? <span className="font-medium text-muted">{e.field}:</span> : null}
                {e.oldValue ? (
                  <span className="rounded-md bg-surface px-1.5 py-0.5 text-muted line-through ring-1 ring-rule-2">{e.oldValue}</span>
                ) : null}
                {e.oldValue && e.newValue ? <ArrowRight className="h-3 w-3 text-faint" aria-label="changed to" /> : null}
                {e.newValue ? (
                  <span className="break-words rounded-md bg-ok-wash px-1.5 py-0.5 font-medium text-ok ring-1 ring-ok-edge">{e.newValue}</span>
                ) : null}
              </div>
            ) : null}
            {e.reason ? (
              <p className="mt-1.5 rounded-sm bg-warn-wash px-2 py-1.5 text-xs text-warn ring-1 ring-warn-edge">Reason: {e.reason}</p>
            ) : null}
            <p className="mt-1.5 text-2xs text-faint">
              <span className="font-medium text-ink-2">{e.user}</span> · {ROLE_LABEL[e.role]} · {fmtDateTime(e.at)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}
