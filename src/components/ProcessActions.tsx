import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Play } from 'lucide-react'
import { useStore } from '../store/store'
import type { JobProcess, ProductionOrder } from '../lib/types'
import { isProcessDone, processBlockers } from '../lib/schedule'
import { assignProcessResources, completeProcess, reportProcessProblem, startProcess } from '../domain/production'
import { fmtDateTime } from '../lib/format'
import { Button, Field, Modal, Select, Textarea } from './ui'

/**
 * One process of a job: start it (with who does it and on which machine),
 * complete it, or report a problem. Every change goes to the Activity log;
 * the stage, the order's progress and the Units page follow by themselves,
 * and the order completes when its last process does.
 */
export function ProcessActions({ order, process, onClose }: { order: ProductionOrder; process: JobProcess; onClose: () => void }) {
  const { db, run, pushToast } = useStore()
  const unit = db.units.find((u) => u.id === process.unitId)
  const people = unit?.outside ? [] : db.people.filter((p) => p.unitId === process.unitId && (p.active || p.id === process.responsiblePersonId))
  const machines = unit?.outside ? [] : db.machines.filter((m) => m.unitId === process.unitId && (m.active || m.id === process.machineId))
  const [personId, setPersonId] = useState(process.responsiblePersonId ?? '')
  const [machineId, setMachineId] = useState(process.machineId ?? (process.noMachineRequired ? 'manual' : ''))
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const blockers = processBlockers(order, process.id)
  const started = process.status === 'In Progress'
  const done = isProcessDone(process)

  const go = async (what: 'start' | 'complete' | 'problem') => {
    if (busy) return
    setBusy(what)
    setError(null)
    try {
      if (what === 'problem') {
        const r = await run(reportProcessProblem(order.id, process.id, problem))
        if (!r.ok) return setError(r.error)
        pushToast({ title: `${process.name}: problem reported`, level: 'warn' })
        return onClose()
      }
      // Who does it and on which machine are saved first when they changed.
      const changed = (personId || null) !== (process.responsiblePersonId ?? null) || (machineId === 'manual' ? !process.noMachineRequired : (machineId || null) !== (process.machineId ?? null))
      if (changed && (personId || machineId)) {
        const a = await run(assignProcessResources(order.id, process.id, { responsiblePersonId: personId || null, machineId: machineId && machineId !== 'manual' ? machineId : null, noMachineRequired: machineId === 'manual' }))
        if (!a.ok) return setError(a.error)
      }
      if (what === 'start') {
        const r = await run(startProcess(order.id, process.id))
        if (!r.ok) return setError(r.error)
        pushToast({ title: `${process.name} started`, level: 'info' })
      } else {
        if (!started) {
          const s = await run(startProcess(order.id, process.id))
          if (!s.ok) return setError(s.error)
        }
        const r = await run(completeProcess(order.id, process.id))
        if (!r.ok) return setError(r.error)
        pushToast({
          title: `${process.name} completed`,
          message: r.value.orderCompleted ? `${order.code} is complete — ready for dispatch.` : r.value.stageCompleted ? `Stage ${process.stageName} is complete.` : undefined,
          level: 'success',
        })
      }
      onClose()
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${process.stageName} › ${process.name}`}
      subtitle={`${order.code} · ${unit?.name ?? process.unitId}${process.actualStart ? ` · started ${fmtDateTime(process.actualStart)}` : ''}`}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {done ? (
        <p className="rounded-md bg-ok-wash px-3 py-2 text-sm text-ok ring-1 ring-inset ring-ok-edge">Completed {process.actualEnd ? fmtDateTime(process.actualEnd) : ''}.</p>
      ) : blockers.length ? (
        <p className="rounded-md bg-warn-wash px-3 py-2 text-sm text-warn ring-1 ring-inset ring-warn-edge">
          Waiting for {blockers.slice(0, 2).map((b) => `${b.stageName} › ${b.name}`).join(', ')} — complete that first.
        </p>
      ) : (
        <div className="space-y-4">
          {people.length || machines.length ? (
            <div className="grid gap-x-4 sm:grid-cols-2">
              {people.length ? (
                <Field label="Who does it">
                  <Select value={personId} onChange={(e) => setPersonId(e.target.value)}>
                    <option value="">Choose…</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
              {machines.length ? (
                <Field label="Machine">
                  <Select value={machineId} onChange={(e) => setMachineId(e.target.value)}>
                    <option value="">Choose…</option>
                    {machines.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                    <option value="manual">No machine needed</option>
                  </Select>
                </Field>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted">{unit?.outside ? 'Outside unit (job work) — they use their own people and machines.' : 'No people or machines are set up for this unit.'}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {!started ? (
              <Button icon={<Play className="h-4 w-4" />} loading={busy === 'start'} onClick={() => void go('start')}>
                {process.status === 'Blocked' ? 'Resume' : 'Start'}
              </Button>
            ) : null}
            <Button variant={started ? 'primary' : 'secondary'} icon={<CheckCircle2 className="h-4 w-4" />} loading={busy === 'complete'} onClick={() => void go('complete')}>
              Complete
            </Button>
          </div>
          <Field label="Report a problem" hint="Stops the process until it is resumed.">
            <Textarea rows={2} value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="Machine down, material short…" />
          </Field>
          <Button variant="secondary" icon={<AlertTriangle className="h-4 w-4" />} loading={busy === 'problem'} disabled={!problem.trim()} onClick={() => void go('problem')}>
            Report problem
          </Button>
          {error ? (
            <p role="alert" className="rounded-md bg-risk-wash px-3 py-2 text-sm text-risk ring-1 ring-inset ring-risk-edge">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </Modal>
  )
}
