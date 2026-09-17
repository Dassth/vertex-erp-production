import { CheckCircle2, CircleDashed, CircleDot, Clock3, OctagonAlert, TriangleAlert, XCircle } from 'lucide-react'
import type { CostingStatus, JobHealth, PlanStatus, Priority, ProcessStatus, StageStatus } from '../lib/types'
import { Badge } from './ui'
import type { Tone } from './ui'

/* Status colour lives in the dot and the word; every badge also carries a
   glyph or text so colour is never the only signal. */

export const STAGE_TONE: Record<StageStatus, Tone> = {
  Scheduled: 'slate',
  'In Progress': 'blue',
  Completed: 'green',
  'Completed by Progression': 'green',
  Delayed: 'red',
  Blocked: 'red',
}

export const HEALTH_TONE: Record<JobHealth, Tone> = {
  'On Time': 'blue',
  'At Risk': 'amber',
  Delayed: 'red',
  Completed: 'green',
}

export const HEALTH_LABEL: Record<JobHealth, string> = {
  'On Time': 'On time',
  'At Risk': 'Approaching deadline',
  Delayed: 'Delayed',
  Completed: 'Completed',
}

export const PRIORITY_TONE: Record<Priority, Tone> = {
  Urgent: 'red',
  High: 'amber',
  Normal: 'indigo',
  Low: 'slate',
}

export const HEALTH_HEX: Record<JobHealth, string> = {
  'On Time': 'var(--color-live)',
  'At Risk': 'var(--color-warn)',
  Delayed: 'var(--color-risk)',
  Completed: 'var(--color-ok)',
}

const STAGE_ICON: Record<StageStatus, typeof Clock3> = {
  Scheduled: Clock3,
  'In Progress': CircleDot,
  Completed: CheckCircle2,
  'Completed by Progression': CheckCircle2,
  Delayed: TriangleAlert,
  Blocked: OctagonAlert,
}

export const PROCESS_TONE: Record<ProcessStatus, Tone> = {
  Scheduled: 'slate',
  'In Progress': 'blue',
  Completed: 'green',
  Delayed: 'red',
  Blocked: 'red',
}

const PROCESS_ICON: Record<ProcessStatus, typeof Clock3> = {
  Scheduled: Clock3,
  'In Progress': CircleDot,
  Completed: CheckCircle2,
  Delayed: TriangleAlert,
  Blocked: OctagonAlert,
}

export function ProcessBadge({ status }: { status: ProcessStatus }) {
  const Icon = PROCESS_ICON[status]
  return (
    <Badge tone={PROCESS_TONE[status]}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {status}
    </Badge>
  )
}

export function StageBadge({ status }: { status: StageStatus }) {
  const Icon = STAGE_ICON[status]
  return (
    <Badge tone={STAGE_TONE[status]}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {status === 'Completed by Progression' ? 'Auto-completed' : status}
    </Badge>
  )
}

export function HealthBadge({ health }: { health: JobHealth }) {
  return (
    <Badge tone={HEALTH_TONE[health]} dot>
      {HEALTH_LABEL[health]}
    </Badge>
  )
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge tone={PRIORITY_TONE[priority]}>{priority}</Badge>
}

const PLAN_TONE: Record<PlanStatus, Tone> = {
  Draft: 'slate',
  'Ready for Costing': 'indigo',
  'In Production': 'blue',
  Cancelled: 'red',
}

export function PlanStatusBadge({ status }: { status: PlanStatus }) {
  const Icon = status === 'Cancelled' ? XCircle : status === 'Draft' ? CircleDashed : status === 'In Production' ? CircleDot : Clock3
  return (
    <Badge tone={PLAN_TONE[status]}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {status}
    </Badge>
  )
}

export function CostingStatusBadge({ status }: { status: CostingStatus | 'Not started' }) {
  if (status === 'Finalized')
    return (
      <Badge tone="green">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        Finalized
      </Badge>
    )
  return (
    <Badge tone="slate">
      <CircleDashed className="h-3 w-3" aria-hidden="true" />
      {status}
    </Badge>
  )
}

export function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge tone="green" dot>
      Active
    </Badge>
  ) : (
    <Badge tone="slate" dot>
      Inactive
    </Badge>
  )
}
