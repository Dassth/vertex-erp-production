import { differenceInMinutes } from 'date-fns'
import type { Notification, NotifyTopic, ProductionOrder, UnitId } from './types'
import { allProcesses, deliveryMoment, isProcessDone, jobHealth, processBlockers } from './schedule'
import { fmtTime, uid } from './format'
import type { Capability, Principal } from './permissions'
import { can } from './permissions'

/* ---------------------------------------------------------------------------
 * Schedule-driven notifications, re-evaluated on open, focus and a 60 s
 * heartbeat. Every alert has a stable `key` so a situation fires only once.
 * Process alerts are addressed to the unit the PROCESS is allocated to, and
 * each alert carries the module it belongs to so an account is never told about
 * a module it cannot open.
 * ------------------------------------------------------------------------- */

const DUE_SOON_MINUTES = 90
const DEADLINE_WARN_MINUTES = 120

function make(
  key: string,
  title: string,
  message: string,
  level: Notification['level'],
  audience: Notification['audience'],
  orderId: string,
  unitId: UnitId | undefined,
  now: Date,
  topic: NotifyTopic = 'production',
): Notification {
  return { id: uid('ntf'), key, title, message, level, audience, topic, unitId, orderId, createdAt: now.toISOString(), read: false }
}

export function evaluateNotifications(
  orders: ProductionOrder[],
  existingKeys: Set<string>,
  now: Date = new Date(),
): Notification[] {
  const out: Notification[] = []
  const push = (n: Notification) => {
    if (existingKeys.has(n.key)) return
    existingKeys.add(n.key)
    out.push(n)
  }

  for (const order of orders) {
    if (order.status === 'Completed') continue
    const who = order.customer.company
    const pending = allProcesses(order).filter((p) => !isProcessDone(p))

    for (const process of pending.slice(0, 2)) {
      if (processBlockers(order, process.id).length) continue
      const minsToStart = differenceInMinutes(new Date(process.plannedStart), now)
      const minsToEnd = differenceInMinutes(new Date(process.plannedEnd), now)
      const label = `${order.code} — ${process.stageName} › ${process.name}`

      if (process.status === 'Blocked') {
        push(make(`${order.id}:${process.id}:blocked`, `${label} blocked`, `${process.name} is blocked at ${process.unitId}. ${process.problem ?? ''}`, 'danger', 'all', order.id, process.unitId, now))
      } else if (minsToEnd < 0) {
        push(make(`${order.id}:${process.id}:should-finish`, `${label} overdue`, `${process.name} should have been completed by ${fmtTime(process.plannedEnd)}.`, 'danger', 'all', order.id, process.unitId, now))
      } else if (minsToStart < 0 && process.status !== 'In Progress') {
        push(make(`${order.id}:${process.id}:should-start`, `${label} not started`, `${process.name} was planned to start at ${fmtTime(process.plannedStart)}.`, 'warn', 'all', order.id, process.unitId, now))
      } else if (minsToStart >= 0 && minsToStart <= DUE_SOON_MINUTES && process.status !== 'In Progress') {
        push(make(`${order.id}:${process.id}:due-soon`, `${label} due to start`, `${process.name} is due to start at ${fmtTime(process.plannedStart)}.`, 'info', 'unit', order.id, process.unitId, now))
      } else if (process.status === 'In Progress' && minsToEnd <= DEADLINE_WARN_MINUTES) {
        push(make(`${order.id}:${process.id}:closing`, `${label} closing soon`, `${process.name} must be completed by ${fmtTime(process.plannedEnd)} to stay on plan.`, 'warn', 'unit', order.id, process.unitId, now))
      }
    }

    const health = jobHealth(order, now)
    if (health === 'At Risk')
      push(make(`${order.id}:at-risk`, `${order.code} is approaching its deadline`, `${who} — remaining processes may not fit before ${order.deliveryDate}.`, 'warn', 'admin', order.id, undefined, now))
    else if (health === 'Delayed')
      push(make(`${order.id}:delayed`, `${order.code} is delayed`, `${who} — a planned process time has passed or a problem is open.`, 'danger', 'admin', order.id, undefined, now))

    const hoursToDeadline = differenceInMinutes(deliveryMoment(order.deliveryDate), now) / 60
    if (hoursToDeadline > 0 && hoursToDeadline <= 48)
      push(make(`${order.id}:delivery-soon`, `${order.code} delivery approaching`, `Delivery for ${who} is due on ${order.deliveryDate}. ${pending.length} process(es) still open.`, 'warn', 'admin', order.id, undefined, now))
  }
  return out
}

const TOPIC_CAPABILITY: Record<NotifyTopic, Capability[]> = {
  production: ['production.monitor', 'production.work'],
  dispatch: ['dispatch'],
  billing: ['billing'],
}

/**
 * Visibility is both audience-based and permission-based: an administrator who
 * cannot open Production is never shown production alerts, and a unit user only
 * sees alerts addressed to their own unit.
 */
export function isVisibleTo(n: Pick<Notification, 'audience' | 'unitId' | 'topic'>, user: Principal): boolean {
  if (!user) return false
  const capabilities = TOPIC_CAPABILITY[n.topic ?? 'production']
  if (!capabilities.some((c) => can(user, c))) return false
  if (user.role === 'admin') return n.audience === 'admin' || n.audience === 'all'
  if (n.audience === 'admin') return false
  return !!user.unitId && n.unitId === user.unitId
}

export function notificationsFor(all: Notification[], user: Principal): Notification[] {
  return all.filter((n) => isVisibleTo(n, user)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
