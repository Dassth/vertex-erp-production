/* ---------------------------------------------------------------------------
 * Customer history: everything one customer has asked for, ordered, received
 * and been invoiced for, across all years — built from saved records only.
 *
 *   • orders   — every production order, with dispatch progress and invoices
 *   • enquiries — plans that never became an order (draft, awaiting costing,
 *                 cancelled): what the customer asked about but did not buy
 *   • products — what the customer buys, how often and how much
 * ------------------------------------------------------------------------- */

import type { Customer, Invoice, Plan, ProductionOrder, VertexDB } from './types'
import { fromPaise, toPaise } from './costing'
import { orderInvoiceSummary } from './billing'

export type OrderStage = 'In production' | 'Ready to dispatch' | 'Partly dispatched' | 'Fully dispatched'

export interface CustomerOrder {
  order: ProductionOrder
  stage: OrderStage
  dispatchedQty: number
  remainingQty: number
  billed: number
  invoices: Invoice[]
}

export interface CustomerEnquiry {
  plan: Plan
  productName: string
  /** Why it is not an order. */
  state: 'Draft' | 'Awaiting costing' | 'Cancelled'
}

export interface CustomerProduct {
  productId: string
  productName: string
  uom: string
  orders: number
  quantity: number
  billed: number
  lastOrdered: string
}

export interface CustomerHistory {
  customer: Customer
  orders: CustomerOrder[]
  enquiries: CustomerEnquiry[]
  products: CustomerProduct[]
  totalOrders: number
  totalBilled: number
  openOrders: number
  firstOrder: string | null
  lastOrder: string | null
  years: string[]
}

function stageOf(order: ProductionOrder, dispatched: number): OrderStage {
  if (order.status !== 'Completed') return 'In production'
  if (dispatched === 0) return 'Ready to dispatch'
  return dispatched >= order.quantity ? 'Fully dispatched' : 'Partly dispatched'
}

export function customerHistory(db: VertexDB, customer: Customer): CustomerHistory {
  const orders: CustomerOrder[] = db.orders
    .filter((o) => o.customerId === customer.id)
    .map((order) => {
      const s = orderInvoiceSummary(order, db.dispatches, db.invoices)
      return {
        order,
        stage: stageOf(order, s.dispatchedQty),
        dispatchedQty: s.dispatchedQty,
        remainingQty: s.remainingQty,
        billed: s.billed,
        invoices: s.shipments.map((x) => x.invoice).filter((i): i is Invoice => !!i),
      }
    })
    .sort((a, b) => b.order.orderDate.localeCompare(a.order.orderDate) || b.order.code.localeCompare(a.order.code))

  const enquiries: CustomerEnquiry[] = db.plans
    .filter((p) => p.customerId === customer.id && !p.orderId && p.status !== 'In Production')
    .map((plan) => ({
      plan,
      productName: db.products.find((p) => p.id === plan.productId)?.name ?? 'Product removed',
      state: plan.status === 'Cancelled' ? ('Cancelled' as const) : plan.status === 'Draft' ? ('Draft' as const) : ('Awaiting costing' as const),
    }))
    .sort((a, b) => b.plan.orderDate.localeCompare(a.plan.orderDate))

  const byProduct = new Map<string, CustomerProduct & { paise: number }>()
  for (const o of orders) {
    const key = o.order.productId || o.order.productName
    const p = byProduct.get(key) ?? { productId: key, productName: o.order.productName, uom: o.order.uom, orders: 0, quantity: 0, billed: 0, lastOrdered: '', paise: 0 }
    p.orders += 1
    p.quantity += o.order.quantity
    p.paise += toPaise(o.billed)
    if (o.order.orderDate > p.lastOrdered) p.lastOrdered = o.order.orderDate
    byProduct.set(key, p)
  }
  const products = [...byProduct.values()]
    .map(({ paise, ...p }) => ({ ...p, billed: fromPaise(paise) }))
    .sort((a, b) => b.orders - a.orders || b.lastOrdered.localeCompare(a.lastOrdered))

  const dates = orders.map((o) => o.order.orderDate).sort()
  const years = [...new Set([...orders.map((o) => o.order.orderDate.slice(0, 4)), ...enquiries.map((e) => e.plan.orderDate.slice(0, 4))])].sort().reverse()
  return {
    customer,
    orders,
    enquiries,
    products,
    totalOrders: orders.length,
    totalBilled: fromPaise(orders.reduce((s, o) => s + toPaise(o.billed), 0)),
    openOrders: orders.filter((o) => o.stage !== 'Fully dispatched').length,
    firstOrder: dates[0] ?? null,
    lastOrder: dates[dates.length - 1] ?? null,
    years,
  }
}

/** Customers matching an ID, name, GSTIN, phone, order ID or invoice number. */
export function searchCustomers(db: VertexDB, query: string): Customer[] {
  const q = query.trim().toLowerCase()
  const list = [...db.customers].sort((a, b) => a.code.localeCompare(b.code))
  if (!q) return list
  return list.filter((c) => {
    const own = `${c.code} ${c.company} ${c.contactPerson} ${c.gstin} ${c.phone}`.toLowerCase()
    if (own.includes(q)) return true
    return (
      db.orders.some((o) => o.customerId === c.id && o.code.toLowerCase().includes(q)) ||
      db.invoices.some((i) => i.customer.id === c.id && i.number.toLowerCase().includes(q))
    )
  })
}
