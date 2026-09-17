import { UnitResourceSetup } from './UnitResourceSetup'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, CircleSlash, Cog, Factory, Hourglass, Play, Send, Timer, UserCog } from 'lucide-react'
import { useStore } from '../../store/store'
import type { UnitId } from '../../lib/types'
import { processReady, unitWork } from '../../lib/selectors'
import type { ProcessWorkRow } from '../../lib/selectors'
import { jobHealth } from '../../lib/schedule'
import { activeMachines, activePeople } from '../../domain/resources'
import { assignProcessResources, completeProcess, reportProcessProblem, saveProcessNote, startProcess } from '../../domain/production'
import { countdown, cx, fmtDate, fmtDateTime, pieces, planWindow } from '../../lib/format'
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, Modal, Segmented, Select, Textarea } from '../../components/ui'
import { PageHeader, StatStrip, StatTile, useDocumentTitle } from '../../components/page'
import { HealthBadge, PriorityBadge, ProcessBadge } from '../../components/status'

type Tab = 'ready' | 'waiting' | 'completed'

/* The shop-floor screen. A unit user sees only the PROCESSES allocated to their
   unit — never costing, never another unit's work. Each process carries its own
   responsible person and machine. */

export function UnitWorkPage({ unitId }: { unitId: UnitId }) {
  const { db } = useStore()
  const unit = db.units.find((u) => u.id === unitId)
  useDocumentTitle(`${unit?.shortName ?? 'Unit'} · Process work`)
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') ?? 'ready') as Tab
  const work = useMemo(() => unitWork(db.orders, unitId), [db.orders, unitId])
  const running = work.ready.filter((r) => r.process.status === 'In Progress').length
  const list = tab === 'waiting' ? work.waiting : tab === 'completed' ? work.completed : work.ready
  const setTab = (t: Tab) => {
    const next = new URLSearchParams(params)
    if (t === 'ready') next.delete('tab')
    else next.set('tab', t)
    setParams(next, { replace: true })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Production · Shop floor"
        title={`${unit?.name ?? unitId} — process work`}
        subtitle="Only the processes allocated to your unit are listed. Record who is responsible and which machine is used, start the process, then complete it. Completing a process never closes anyone else's work."
        icon={<Factory className="h-4 w-4" />}
      />

      <UnitResourceSetup unitId={unitId} />

      <StatStrip className="grid-cols-2 lg:grid-cols-4">
        <StatTile label="Ready now" value={String(work.ready.length)} icon={<Timer className="h-4 w-4" />} tone="indigo" hint="Earlier processes are done" onClick={() => setTab('ready')} active={tab === 'ready'} />
        <StatTile label="In progress" value={String(running)} icon={<Play className="h-4 w-4" />} tone="blue" hint="Started by your unit" />
        <StatTile label="Waiting" value={String(work.waiting.length)} icon={<Hourglass className="h-4 w-4" />} tone="slate" hint="An earlier process is still open" onClick={() => setTab('waiting')} active={tab === 'waiting'} />
        <StatTile label="Needs a person" value={String(work.needsResources.length)} icon={<UserCog className="h-4 w-4" />} tone="amber" hint="Assign before starting" />
      </StatStrip>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'ready', label: 'Ready now', count: work.ready.length },
          { value: 'waiting', label: 'Waiting on earlier work', count: work.waiting.length },
          { value: 'completed', label: 'Completed', count: work.completed.length },
        ]}
      />

      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CheckCircle2 className="h-6 w-6" />}
            title={tab === 'ready' ? 'No process is ready for your unit' : tab === 'waiting' ? 'Nothing waiting' : 'No completed processes yet'}
            message="Work appears here automatically when an order is released to production or an earlier process is completed."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {list.map((row) => (
            <ProcessWorkCard key={row.key} row={row} />
          ))}
        </div>
      )}
    </div>
  )
}

function ProcessWorkCard({ row }: { row: ProcessWorkRow }) {
  const { db, run, pushToast } = useStore()
  const { order, stage, process } = row
  const [confirm, setConfirm] = useState(false)
  const [problemOpen, setProblemOpen] = useState(false)
  const [problem, setProblem] = useState('')
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState(process.note ?? '')
  const [resourceOpen, setResourceOpen] = useState(false)
  const done = process.status === 'Completed'
  const cd = countdown(process.plannedEnd)
  const person = db.people.find((p) => p.id === process.responsiblePersonId)
  const machine = db.machines.find((m) => m.id === process.machineId)
  const resourced = processReady(process)

  const act = async (labelText: string, pending: Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string }) => {
    const r = await pending
    if (!r.ok) pushToast({ title: `${labelText} failed`, message: r.error, level: 'danger' })
    return r.ok
  }

  return (
    <Card className="vx-anim-up overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-rule bg-surface-2 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="vx-code text-md font-semibold text-ink">{order.code}</h3>
            <PriorityBadge priority={order.priority} />
            <HealthBadge health={jobHealth(order)} />
          </div>
          <p className="mt-1 text-sm text-ink-2">
            {order.customer.company} · {order.productName}
          </p>
        </div>
        <div className="text-right">
          <p className="vx-mono-label !mb-0">Quantity</p>
          <p className="vx-code text-lg font-semibold text-ink">{pieces(order.quantity)}</p>
          <p className="text-xs text-muted">Delivery {fmtDate(order.deliveryDate, 'dd MMM')}</p>
        </div>
      </div>

      <div className="space-y-4 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="vx-mono-label !mb-0">
              Stage {stage.index + 1} · {stage.name}
            </p>
            <p className="vx-code text-2xs text-faint" translate="no">
              Stage ID {stage.stageDefId}
            </p>
            <p className="mt-1 text-base font-semibold text-ink">
              {stage.index + 1}.{process.index + 1} {process.name}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ProcessBadge status={process.status} />
            {process.historical ? <Badge tone="slate">Migrated record</Badge> : null}
          </div>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="vx-mono-label">Responsible person</dt>
            <dd className={cx('mt-0.5 text-base', person ? 'text-ink' : 'text-warn')}>
              {person ? person.name : process.historical ? 'Not recorded' : 'Not assigned'}
            </dd>
          </div>
          <div>
            <dt className="vx-mono-label">Machine</dt>
            <dd className={cx('mt-0.5 text-base', machine || process.noMachineRequired ? 'text-ink' : process.requiresMachine ? 'text-warn' : 'text-muted')}>
              {machine ? machine.name : process.noMachineRequired ? 'Manual — no machine' : process.historical ? 'Not recorded' : process.requiresMachine ? 'Machine required' : 'Not assigned'}
            </dd>
          </div>
          <div>
            <dt className="vx-mono-label">Planned</dt>
            <dd className="mt-0.5 text-base text-ink">{planWindow(process.plannedStart, process.plannedEnd)}</dd>
          </div>
          <div>
            <dt className="vx-mono-label">{done ? 'Completed' : 'Time left'}</dt>
            <dd className={cx('mt-0.5 text-base', (row.overdue || cd.overdue) && !done ? 'text-risk' : 'text-ink')}>
              {done ? (process.actualEnd ? fmtDateTime(process.actualEnd) : 'Not recorded') : cd.text}
            </dd>
          </div>
        </dl>

        {process.actualStart ? (
          <p className="text-xs text-muted">
            Started {fmtDateTime(process.actualStart)}
            {process.updatedBy ? ` · last update by ${process.updatedBy}` : ''}
          </p>
        ) : null}

        {row.blockers.length ? (
          <p className="rounded-md bg-surface-2 px-3 py-2 text-sm text-muted" role="status">
            Waiting for {row.blockers.slice(0, 2).map((b) => `${b.stageName} › ${b.name} (${b.unitId})`).join(', ')}
            {row.blockers.length > 2 ? ` and ${row.blockers.length - 2} more` : ''}.
          </p>
        ) : null}

        {process.problem ? (
          <p className="rounded-md bg-risk-wash px-3 py-2 text-sm text-risk ring-1 ring-inset ring-risk-edge" role="alert">
            Problem: {process.problem}
          </p>
        ) : null}

        {process.note ? <p className="rounded-md bg-surface-2 px-3 py-2 text-sm text-ink-2">Note: {process.note}</p> : null}

        {!done ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" icon={<Cog className="h-3.5 w-3.5" />} onClick={() => setResourceOpen(true)}>
              {resourced ? 'Change person / machine…' : 'Assign person / machine…'}
            </Button>
            <Button
              size="sm"
              icon={<Play className="h-3.5 w-3.5" />}
              disabled={!row.ready || process.status === 'In Progress' || !resourced}
              onClick={async () => {
                if (await act('Start', run(startProcess(order.id, process.id))))
                  pushToast({ title: `${process.name} started`, message: 'Start time recorded against your name.', level: 'info' })
              }}
            >
              {process.status === 'In Progress' ? 'Running' : process.status === 'Blocked' ? 'Resume' : 'Start process'}
            </Button>
            <Button size="sm" variant="secondary" disabled={!row.ready || !resourced} onClick={() => setConfirm(true)}>
              Complete process
            </Button>
            <Button size="sm" variant="ghost" icon={<Send className="h-3.5 w-3.5" />} onClick={() => setProblemOpen(true)}>
              Report a problem…
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNoteOpen(true)}>
              {process.note ? 'Edit note…' : 'Add note…'}
            </Button>
          </div>
        ) : null}

        {!resourced && !done ? (
          <p className="text-xs text-warn">
            {process.responsiblePersonId ? 'Select the machine for this process before starting.' : 'Assign a responsible person before starting this process.'}
          </p>
        ) : null}
      </div>

      <ResourceDialog open={resourceOpen} onClose={() => setResourceOpen(false)} row={row} />

      <ConfirmDialog
        open={confirm}
        title={`Complete ${process.name}?`}
        body={`Only this process is closed. ${stage.name} completes when all of its processes are done, and the order completes when every stage is done.`}
        confirmLabel="Complete process"
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          setConfirm(false)
          const r = await run(completeProcess(order.id, process.id))
          if (!r.ok) {
            pushToast({ title: 'Could not complete', message: r.error, level: 'danger' })
            return
          }
          pushToast({
            title: r.value.orderCompleted
              ? `${order.code} production completed`
              : r.value.stageCompleted
                ? `${stage.name} completed`
                : `${process.name} completed`,
            message: r.value.orderCompleted
              ? 'Every stage is closed. The order is now available in Dispatch.'
              : r.value.stageCompleted
                ? 'All processes in this stage are closed.'
                : 'Progress updated.',
            level: 'success',
          })
        }}
      />

      <Modal
        open={problemOpen}
        onClose={() => setProblemOpen(false)}
        title="Report a problem"
        subtitle={`${stage.name} › ${process.name}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setProblemOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (await act('Report', run(reportProcessProblem(order.id, process.id, problem)))) {
                  setProblemOpen(false)
                  setProblem('')
                  pushToast({ title: 'Problem sent to the office', level: 'warn' })
                }
              }}
            >
              Send to office
            </Button>
          </>
        }
      >
        <Field label="What is the problem?" required>
          <Textarea rows={3} value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="e.g. Machine 1 stopped, waiting for spares…" />
        </Field>
      </Modal>

      <Modal
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title="Process note"
        subtitle={`${stage.name} › ${process.name}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setNoteOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (await act('Save note', run(saveProcessNote(order.id, process.id, note)))) {
                  setNoteOpen(false)
                  pushToast({ title: 'Note saved', level: 'success' })
                }
              }}
            >
              Save note
            </Button>
          </>
        }
      >
        <Field label="Note for the office">
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </Modal>
    </Card>
  )
}

/* --------------------------- Resource allocation -------------------------- */

function ResourceDialog({ open, onClose, row }: { open: boolean; onClose: () => void; row: ProcessWorkRow }) {
  const { db, run, pushToast } = useStore()
  const { order, process } = row
  const people = activePeople(db, process.unitId)
  const machines = activeMachines(db, process.unitId)
  const [personId, setPersonId] = useState(process.responsiblePersonId ?? '')
  const [machineId, setMachineId] = useState(process.machineId ?? '')
  const [noMachine, setNoMachine] = useState(process.noMachineRequired)
  const [errors, setErrors] = useState<Record<string, string>>({})

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Who runs this process?"
      subtitle={`${process.stageName} › ${process.name} · ${process.unitId}`}
      icon={<UserCog className="h-5 w-5" />}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              const r = await run(
                assignProcessResources(order.id, process.id, {
                  responsiblePersonId: personId || null,
                  machineId: noMachine ? null : machineId || null,
                  noMachineRequired: noMachine,
                }),
              )
              if (!r.ok) {
                setErrors(r.fieldErrors ?? { responsiblePersonId: r.error })
                return
              }
              setErrors({})
              onClose()
              pushToast({ title: 'Resources assigned', message: `${process.name} is ready to start.`, level: 'success' })
            }}
          >
            Save allocation
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Responsible person" required error={errors.responsiblePersonId} hint={people.length ? 'People registered for your unit.' : 'No staff yet — open Unit settings below and type a name to add one.'}>
          <Select value={personId} onChange={(e) => setPersonId(e.target.value)}>
            <option value="">Select a person…</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.designation ? ` · ${p.designation}` : ''}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Machine"
          required={process.requiresMachine}
          error={errors.machineId}
          hint={process.requiresMachine ? 'This process is configured to need a machine.' : 'Manual processes can run without one.'}
        >
          <Select value={machineId} onChange={(e) => setMachineId(e.target.value)} disabled={noMachine}>
            <option value="">Select a machine…</option>
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.code ? ` · ${m.code}` : ''}
              </option>
            ))}
          </Select>
        </Field>

        {!process.requiresMachine ? (
          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
              checked={noMachine}
              onChange={(e) => {
                setNoMachine(e.target.checked)
                if (e.target.checked) setMachineId('')
              }}
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-base text-ink">
                <CircleSlash className="h-3.5 w-3.5 text-faint" aria-hidden="true" />
                No machine required
              </span>
              <span className="block text-xs text-muted">Record this process as manual work.</span>
            </span>
          </label>
        ) : null}

        <UnitResourceSetup unitId={process.unitId} onPersonAdded={setPersonId} onMachineAdded={id => { setMachineId(id); setNoMachine(false) }} />

        {process.historical ? (
          <p className="rounded-md bg-surface-2 px-3 py-2 text-xs text-muted">
            This process came from a stage-level record created before process tracking. Its earlier operator, machine and timings were never
            captured and are shown as “not recorded”.
          </p>
        ) : null}
      </div>
    </Modal>
  )
}
