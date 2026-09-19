/* ---------------------------------------------------------------------------
 * Job card: one plan from A to Z on a single document — customer, product and
 * specification, the process route with the unit (and, once in production, the
 * person, machine, timing and status) for every process, the materials to
 * issue, and the dispatches and invoices raised so far.
 *
 * It is a shop-floor document: it carries no cost, rate or profit figures.
 * ------------------------------------------------------------------------- */

import type { Plan, VertexDB } from './types'

export interface JobCardProcess {
  stage: string
  name: string
  unit: string
  method: string
  resource: string
  planned: string
  status: string
  done: boolean
}

export interface JobCardMaterial {
  code: string
  name: string
  usedIn: string
  perPiece: string
  required: string
  issue: string
}

export interface JobCard {
  plan: Plan
  customer: { code: string; company: string; contact: string; gstin: string; address: string }
  product: { code: string; name: string; hsn: string; uom: string; category: string }
  orderCode: string | null
  costing: string
  productionStatus: string
  processes: JobCardProcess[]
  materials: JobCardMaterial[]
  materialsNote: string
  dispatches: Array<{ code: string; date: string; quantity: number; received: string; invoice: string }>
}

const n = (v: number, digits = 3) => v.toLocaleString('en-IN', { maximumFractionDigits: digits })
const window_ = (start?: string, end?: string) => {
  if (!start || !end) return ''
  const f = (iso: string) => {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? iso : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return `${f(start)} – ${f(end)}`
}

export function jobCard(db: VertexDB, planId: string): JobCard | null {
  const plan = db.plans.find((p) => p.id === planId)
  if (!plan) return null
  const customer = db.customers.find((c) => c.id === plan.customerId)
  const product = db.products.find((p) => p.id === plan.productId)
  const order = db.orders.find((o) => o.id === plan.orderId)
  const costing = db.costings.find((c) => c.id === plan.costingId)
  const unitName = (id: string | undefined) => db.units.find((u) => u.id === id)?.shortName ?? (id ? id : 'Not allocated')
  const person = (id: string | null) => db.people.find((p) => p.id === id)?.name
  const machine = (id: string | null) => {
    const m = db.machines.find((x) => x.id === id)
    return m ? m.code || m.name : undefined
  }

  // In production the job's own stages are the truth; before that, the product route and the plan's allocation.
  const processes: JobCardProcess[] = order
    ? order.stages.flatMap((s) =>
        s.processes.map((p) => {
          const def = product?.stages.flatMap((x) => x.processes).find((x) => x.id === p.processDefId)
          return {
            stage: s.name,
            name: p.name,
            unit: unitName(p.unitId),
            method: def?.method ?? '',
            resource: [person(p.responsiblePersonId), p.noMachineRequired ? 'No machine' : machine(p.machineId)].filter(Boolean).join(' · ') || (p.requiresMachine ? 'Machine to assign' : '—'),
            planned: window_(p.plannedStart, p.plannedEnd),
            status: p.historical ? `${p.status} (not recorded)` : p.status,
            done: p.done,
          }
        }),
      )
    : (product?.stages ?? []).flatMap((s) =>
        s.processes.map((p) => ({
          stage: s.name,
          name: p.name,
          unit: unitName(plan.processUnits[p.id] ?? plan.stageUnits?.[s.id]),
          method: p.method ?? '',
          resource: p.requiresMachine ? 'Machine required' : '—',
          planned: '',
          status: plan.status === 'Cancelled' ? 'Cancelled' : 'Not started',
          done: false,
        })),
      )

  // Material quantities: from the finalized costing when there is one, otherwise per-piece consumption.
  const lines = costing?.snapshot?.result.materialLines
  const place = (stageId: string | null, processId: string | null) => {
    const st = product?.stages.find((s) => s.id === stageId)
    const pr = st?.processes.find((p) => p.id === processId)
    return [st?.name, pr?.name].filter(Boolean).join(' / ') || 'Whole product'
  }
  const materials: JobCardMaterial[] = lines
    ? lines.map((l) => ({
        code: l.code,
        name: l.name,
        usedIn: [l.stageName, l.processName].filter(Boolean).join(' / ') || 'Whole product',
        perPiece: l.sheet ? `${l.sheet.ups} up · ${l.sheet.cutLengthMm}×${l.sheet.cutWidthMm} mm` : '',
        required: `${n(l.totalQty)} ${l.uom}`,
        issue: `${n(l.purchaseQty)} ${l.purchaseUnit}`,
      }))
    : (product?.materials ?? []).map((m) => {
        const mat = db.materials.find((x) => x.id === m.materialId)
        const each = mat?.kind === 'sheet' ? (m.piecesPerProduct !== null ? `${n(m.piecesPerProduct)} cut piece(s)` : 'Cut list pending') : m.qtyPerPiece !== null ? `${n(m.qtyPerPiece)} ${mat?.uom ?? ''}` : 'Not measured'
        const total = mat?.kind === 'sheet' ? (m.piecesPerProduct !== null ? `${n(m.piecesPerProduct * plan.quantity)} cut pieces` : '—') : m.qtyPerPiece !== null ? `${n(m.qtyPerPiece * plan.quantity)} ${mat?.uom ?? ''}` : '—'
        return { code: mat?.code ?? '', name: mat?.name ?? 'Material removed', usedIn: place(m.stageId, m.processId), perPiece: each, required: total, issue: '' }
      })

  const dispatches = order
    ? db.dispatches
        .filter((d) => d.orderId === order.id)
        .sort((a, b) => a.seq - b.seq)
        .map((d) => ({
          code: d.code,
          date: d.date,
          quantity: d.quantity,
          received: d.receivedAt ? d.receivedAt.slice(0, 10) : 'Awaiting',
          invoice: db.invoices.find((i) => i.id === d.invoiceId)?.number ?? '—',
        }))
    : []

  return {
    plan,
    customer: {
      code: customer?.code ?? '',
      company: customer?.company ?? 'Customer removed',
      contact: [customer?.contactPerson, customer?.phone].filter(Boolean).join(' · '),
      gstin: customer?.gstin ?? '',
      address: customer?.deliveryAddress || customer?.billingAddress || '',
    },
    product: {
      code: product?.code ?? '',
      name: product?.name ?? 'Product removed',
      hsn: product?.hsn ?? '',
      uom: product?.uom ?? 'pcs',
      category: product?.category ?? '',
    },
    orderCode: order?.code ?? null,
    costing: costing ? `${costing.code} · ${costing.status}` : 'Not costed yet',
    productionStatus: order
      ? order.status === 'Completed'
        ? `Completed ${order.completedAt ? order.completedAt.slice(0, 10) : ''} · ${n(order.completedQty)} ${order.uom}`
        : `In production · ${processes.filter((p) => p.done).length} of ${processes.length} processes done`
      : plan.status,
    processes,
    materials,
    materialsNote: lines ? 'Quantities from the finalized costing, including wastage and purchase rounding.' : 'Quantities per plan quantity, before wastage — finalize costing for issue quantities.',
    dispatches,
  }
}
