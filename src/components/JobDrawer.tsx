import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, CheckCircle2, Circle, Repeat2 } from 'lucide-react'
import { useStore } from '../store/store'
import type { JobProcess, Priority, ProductionOrder } from '../lib/types'
import { PRIORITIES, isProcessDone, isStageDone, processBlockers, productionDates } from '../lib/schedule'
import { machineName, personName, stageUnitsLabel, toJobView } from '../lib/selectors'
import { orderBalance } from '../lib/billing'
import { countdown, cx, fmtDate, fmtDateTime, pieces, planWindow } from '../lib/format'
import { reassignProcessUnit, reviseDeliveryDate, setOrderPriority } from '../domain/production'
import { Badge, Button, Drawer, Field, Input, Modal, ProgressBar, Select, Textarea } from './ui'
import { Detail } from './page'
import { HealthBadge, PriorityBadge, ProcessBadge, StageBadge } from './status'
import { AuditTrail } from './AuditTrail'

/* Administrator job detail. Monitoring only: no process progress actions, no
   costing or master edits. Priority, delivery date and the unit of a process
   that has not started are adjustable, and only by an account that may plan. */

export function JobDrawer({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const { db } = useStore()
  const order = db.orders.find((o) => o.id === orderId) ?? null
  return (
    <Drawer open={!!order} onClose={onClose} title={order?.code ?? ''} subtitle={order?.customer.company} width="w-full max-w-3xl">
      {order ? <JobDetail order={order} /> : null}
    </Drawer>
  )
}

function JobDetail({ order }: { order: ProductionOrder }) {
  const { db, can } = useStore()
  const view = useMemo(() => toJobView(order), [order])
  const [tab, setTab] = useState<'stages' | 'activity'>('stages')
  const balance = orderBalance(order, db.dispatches)
  const dates = productionDates(order)
  const unitName = (id: string) => db.units.find((u) => u.id === id)?.shortName ?? id
  const cd = countdown(`${order.deliveryDate}T18:00:00`)
  const stageIds = new Set(order.stages.flatMap((s) => [s.id, ...s.processes.map((p) => p.id)]))
  const audit = db.audit.filter((a) => a.entityId === order.id || stageIds.has(a.entityId) || a.entityLabel.includes(order.code))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <HealthBadge health={view.health} />
        <PriorityBadge priority={order.priority} />
        {order.status === 'Completed' ? <Badge tone="green">Ready for dispatch</Badge> : null}
      </div>

      <dl className="grid gap-4 sm:grid-cols-3">
        <Detail label="Customer">{order.customer.company}</Detail>
        <Detail label="Product">{order.productName}</Detail>
        <Detail label="Ordered quantity">{pieces(order.quantity)}</Detail>
        <Detail label="Order date">{fmtDate(order.orderDate)}</Detail>
        <Detail label="Delivery date">
          {fmtDate(order.deliveryDate)}
          {order.status !== 'Completed' ? <span className={cx('block text-xs', cd.overdue ? 'text-risk' : 'text-muted')}>{cd.text}</span> : null}
        </Detail>
        <Detail label="Customer ref.">{order.customerRef || '—'}</Detail>
        <Detail label="Planned start → end">{planWindow(order.stages[0]?.plannedStart, order.stages[order.stages.length - 1]?.plannedEnd)}</Detail>
        <Detail label="Actual start">{fmtDateTime(dates.startedAt)}</Detail>
        <Detail label="Completed">{fmtDateTime(dates.completedAt)}</Detail>
        <Detail label="Delivery address" className="sm:col-span-2">
          {order.customer.deliveryAddress}
        </Detail>
        <Detail label="Dispatched / remaining">
          {pieces(balance.dispatchedQty)} / {order.status === 'Completed' ? pieces(balance.remainingQty) : '—'}
        </Detail>
        {order.dimensions || order.options ? (
          <Detail label="Dimensions / options" className="sm:col-span-3">
            {[order.dimensions, order.options].filter(Boolean).join(' · ')}
          </Detail>
        ) : null}
      </dl>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-medium text-ink-2">
            {view.doneCount} of {view.totalStages} stages closed
          </span>
          <span className="text-muted">{view.current ? `Now: ${view.current.name} · ${stageUnitsLabel(view.current, unitName)}` : 'All stages closed'}</span>
        </div>
        <ProgressBar value={view.progress} showLabel tone={view.health === 'Completed' ? 'green' : view.health === 'Delayed' ? 'red' : view.health === 'At Risk' ? 'amber' : 'indigo'} />
      </div>

      {order.instructions ? (
        <p className="border-l-2 border-warn-edge pl-3 text-sm leading-relaxed text-warn">
          <strong className="font-semibold">Instructions</strong> · {order.instructions}
        </p>
      ) : null}

      {/* Monitoring accounts see the job; only a planner may adjust it. */}
      {can('planning') ? <AdminAdjustments order={order} /> : null}

      <div className="flex flex-wrap gap-2 text-sm">
        {/* The costing editor is not reachable from monitoring for accounts without it. */}
        {can('costing') ? (
          <Link className="vx-focus rounded-xs font-medium text-accent-text hover:underline" to={`/costing/${order.planId}`}>
            View finalized costing
          </Link>
        ) : null}
        {order.status === 'Completed' && can('dispatch') ? (
          <Link className="vx-focus rounded-xs font-medium text-accent-text hover:underline" to={`/dispatch?order=${order.id}`}>
            Open in Dispatch
          </Link>
        ) : null}
      </div>

      <div className="flex gap-1 border-b border-rule" role="tablist">
        {(
          [
            ['stages', `Stages & processes (${order.stages.length})`],
            ['activity', `Activity (${audit.length})`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cx('vx-press vx-focus relative px-3 py-2.5 text-base font-medium', tab === k ? 'text-accent-text' : 'text-muted hover:text-ink')}
          >
            {label}
            {tab === k ? <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" aria-hidden="true" /> : null}
          </button>
        ))}
      </div>

      {tab === 'stages' ? <StageMonitor order={order} unitName={unitName} /> : <AuditTrail entries={audit} limit={80} />}
    </div>
  )
}

export function StageMonitor({ order, unitName }: { order: ProductionOrder; unitName: (id: string) => string }) {
  const { db } = useStore()
  return (
    <ol className="space-y-2">
      {order.stages.map((s) => {
        const done = isStageDone(s)
        const blockers = processBlockers(order, s.processes[0]?.id ?? '')
        return (
          <li key={s.id} className={cx('vx-tile px-4 py-3', s.status === 'In Progress' && 'ring-1 ring-inset ring-live-edge')}>
            <div className="flex flex-wrap items-start gap-3">
              <span
                className={cx(
                  'vx-code flex h-7 w-7 shrink-0 items-center justify-center rounded-xs text-sm font-medium',
                  done ? 'bg-ok text-canvas' : s.status === 'In Progress' ? 'bg-live text-canvas' : s.status === 'Delayed' || s.status === 'Blocked' ? 'bg-risk text-canvas' : 'bg-surface-3 text-muted',
                )}
                aria-hidden="true"
              >
                {s.index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-ink">{s.name}</p>
                  <StageBadge status={s.status} />
                  {/* A stage can span units — never imply a single owner. */}
                  <Badge tone="indigo">{stageUnitsLabel(s, unitName)}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted">
                  Planned {planWindow(s.plannedStart, s.plannedEnd)} · {s.durationHours} h
                </p>
                <p className="text-xs text-muted">
                  Actual {s.actualStart ? fmtDateTime(s.actualStart) : 'not started'}
                  {s.actualEnd ? ` → ${fmtDateTime(s.actualEnd)}` : ''}
                  {s.updatedBy ? ` · last update by ${s.updatedBy}` : ''}
                </p>
                {!done && blockers.length ? (
                  <p className="mt-1 text-xs text-warn">
                    Waiting for {blockers.slice(0, 2).map((b) => `${b.stageName} › ${b.name} (${unitName(b.unitId)})`).join(', ')}
                    {blockers.length > 2 ? ` and ${blockers.length - 2} more` : ''}
                  </p>
                ) : null}
                {s.problem ? <p className="mt-1.5 rounded-sm bg-risk-wash px-2.5 py-1.5 text-xs text-risk">Problem: {s.problem}</p> : null}
                {s.note ? <p className="mt-1.5 rounded-sm bg-surface-3 px-2.5 py-1.5 text-xs text-ink-2">Note: {s.note}</p> : null}
                {/* Every process with its own unit, resources, status and timings. */}
                <ul className="mt-2 grid gap-2">
                  {s.processes.map((p) => (
                    <li key={p.id} className="flex items-start gap-1.5 rounded-sm bg-surface-2 px-2.5 py-2 text-xs text-ink-2">
                      {isProcessDone(p) ? (
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" aria-label="Done" />
                      ) : (
                        <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" aria-label="Open" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-ink">
                            {s.index + 1}.{p.index + 1} {p.name}
                          </span>
                          <ProcessBadge status={p.status} />
                          <Badge tone="indigo">{unitName(p.unitId)}</Badge>
                          {p.historical ? <Badge tone="slate">Migrated</Badge> : null}
                        </span>
                        <span className="mt-0.5 block text-2xs text-faint">
                          Planned {planWindow(p.plannedStart, p.plannedEnd)} · {p.durationHours} h
                        </span>
                        <span className="block text-2xs text-faint">
                          Person: {personName(db, p.responsiblePersonId) ?? (p.historical ? 'not recorded' : 'not assigned')} · Machine:{' '}
                          {machineName(db, p.machineId) ??
                            (p.noMachineRequired ? 'Manual' : p.historical ? 'not recorded' : p.requiresMachine ? 'required' : 'not assigned')}
                        </span>
                        <span className="block text-2xs text-faint">
                          Actual {p.actualStart ? fmtDateTime(p.actualStart) : 'not started'}
                          {p.actualEnd ? ` → ${fmtDateTime(p.actualEnd)}` : ''}
                          {p.doneBy ? ` · ${p.doneBy}` : ''}
                        </span>
                        {p.problem ? <span className="mt-1 block rounded-sm bg-risk-wash px-2 py-1 text-2xs text-risk">Problem: {p.problem}</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function AdminAdjustments({ order }: { order: ProductionOrder }) {
  const { db, run, pushToast } = useStore()
  const [dateOpen, setDateOpen] = useState(false)
  const [unitProcess, setUnitProcess] = useState<JobProcess | null>(null)
  const [newDate, setNewDate] = useState(order.deliveryDate)
  const [newUnit, setNewUnit] = useState('')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  // Only a process that has not started can move; its person and machine are cleared.
  const movable = order.stages.flatMap((s) => s.processes).filter((p) => !isProcessDone(p) && p.status !== 'In Progress' && !p.actualStart)
  if (order.status === 'Completed') return null

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md bg-surface-2 p-3">
      <span className="vx-mono-label !mb-0 mr-1">Adjust</span>
      <Select
        aria-label="Job priority"
        value={order.priority}
        onChange={async (e) => {
          const r = await run(setOrderPriority(order.id, e.target.value as Priority))
          if (r.ok) pushToast({ title: 'Priority updated', level: 'info' })
        }}
        className="h-9 w-40 text-sm"
      >
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {p} priority
          </option>
        ))}
      </Select>
      <Button
        size="sm"
        variant="secondary"
        icon={<CalendarClock className="h-3.5 w-3.5" />}
        onClick={() => {
          setNewDate(order.deliveryDate)
          setReason('')
          setErrors({})
          setDateOpen(true)
        }}
      >
        Revise delivery date…
      </Button>
      {movable.length ? (
        <Button
          size="sm"
          variant="secondary"
          icon={<Repeat2 className="h-3.5 w-3.5" />}
          onClick={() => {
            setUnitProcess(movable[0])
            setNewUnit(movable[0].unitId)
            setReason('')
            setErrors({})
          }}
        >
          Move a process to another unit…
        </Button>
      ) : null}

      <Modal
        open={dateOpen}
        onClose={() => setDateOpen(false)}
        title="Revise delivery date"
        subtitle={`${order.code} — completed stages keep their record; pending stages are re-planned`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                const r = await run(reviseDeliveryDate(order.id, newDate, reason))
                if (!r.ok) return setErrors(r.fieldErrors ?? { reason: r.error })
                setDateOpen(false)
                pushToast({ title: 'Schedule re-planned', level: 'success' })
              }}
            >
              Re-plan
            </Button>
          </>
        }
      >
        <Field label="New delivery date" required error={errors.deliveryDate}>
          <Input type="date" value={newDate} min={order.orderDate} onChange={(e) => setNewDate(e.target.value)} aria-invalid={!!errors.deliveryDate || undefined} />
        </Field>
        <Field label="Reason" required error={errors.reason}>
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={!!errors.reason || undefined} />
        </Field>
      </Modal>

      <Modal
        open={!!unitProcess}
        onClose={() => setUnitProcess(null)}
        title="Move a process to another unit"
        subtitle="Only processes that have not started can move; the responsible person and machine are cleared"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setUnitProcess(null)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!unitProcess) return
                const r = await run(reassignProcessUnit(order.id, unitProcess.id, newUnit, reason))
                if (!r.ok) return setErrors(r.fieldErrors ?? { reason: r.error })
                setUnitProcess(null)
                pushToast({ title: 'Process re-assigned', message: 'The new unit must allocate its own person and machine.', level: 'success' })
              }}
            >
              Move process
            </Button>
          </>
        }
      >
        <Field label="Process">
          <Select
            value={unitProcess?.id ?? ''}
            onChange={(e) => {
              const s = movable.find((x) => x.id === e.target.value) ?? null
              setUnitProcess(s)
              if (s) setNewUnit(s.unitId)
            }}
          >
            {movable.map((s) => (
              <option key={s.id} value={s.id}>
                {s.stageName} › {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Production unit">
          <Select value={newUnit} onChange={(e) => setNewUnit(e.target.value)}>
            {db.units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Reason" required error={errors.reason}>
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={!!errors.reason || undefined} />
        </Field>
      </Modal>
    </div>
  )
}
