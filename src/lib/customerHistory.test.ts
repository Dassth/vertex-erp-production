import { describe, expect, it } from 'vitest'
import { buildEmptyDB } from './defaults'
import { customerHistory, searchCustomers } from './customerHistory'
import { customerOrderCode } from '../domain/common'
import type { Customer, Dispatch, Invoice, Plan, ProductionOrder } from './types'

const customer = (id: string, code: string, company: string) => ({ id, code, company, contactPerson: '', gstin: '', phone: '', active: true }) as unknown as Customer
const order = (p: Partial<ProductionOrder>) =>
  ({ id: 'o', code: 'X', customerId: 'c1', productId: 'p1', productName: 'Necklace box', uom: 'pcs', quantity: 1000, orderDate: '2026-09-01', status: 'Completed', completedQty: 1000, ...p }) as unknown as ProductionOrder

function sample() {
  const db = buildEmptyDB(new Date('2026-09-19'))
  db.customers = [customer('c1', 'CUS-0001', 'Back Moon Devs'), customer('c2', 'CUS-0002', 'Lalchand Jewellers')]
  db.orders = [
    order({ id: 'o1', code: 'CUS-0001-20250310-01', orderDate: '2025-03-10' }),
    order({ id: 'o2', code: 'CUS-0001-20260901-01', orderDate: '2026-09-01', status: 'Active' }),
    order({ id: 'o3', code: 'CUS-0002-20260905-01', customerId: 'c2', orderDate: '2026-09-05' }),
  ]
  db.dispatches = [{ id: 'd1', orderId: 'o1', seq: 1, quantity: 1000, invoiceId: 'i1', date: '2025-03-20' } as Dispatch]
  db.invoices = [{ id: 'i1', orderId: 'o1', dispatchId: 'd1', number: 'INV/2024-25/0007', total: 5900, customer: { id: 'c1' } } as unknown as Invoice]
  db.plans = [{ id: 'pl1', code: 'PLN-0009', customerId: 'c1', productId: 'p1', status: 'Cancelled', orderId: null, orderDate: '2026-08-01', quantity: 500 } as unknown as Plan]
  return db
}

describe('order ID', () => {
  it('is customer ID + order date + running number for that day', () => {
    const db = sample()
    expect(customerOrderCode(db, 'CUS-0001', '2026-09-19')).toBe('CUS-0001-20260919-01')
    expect(customerOrderCode(db, 'CUS-0001', '2026-09-01')).toBe('CUS-0001-20260901-02')
  })
})

describe('customer history', () => {
  it('shows every order from every year, with invoices and what was not ordered', () => {
    const db = sample()
    const h = customerHistory(db, db.customers[0])
    expect(h.orders.map((o) => o.order.code)).toEqual(['CUS-0001-20260901-01', 'CUS-0001-20250310-01'])
    expect(h.orders[1]).toMatchObject({ stage: 'Fully dispatched', billed: 5900 })
    expect(h.orders[1].invoices.map((i) => i.number)).toEqual(['INV/2024-25/0007'])
    expect(h.orders[0].stage).toBe('In production')
    expect(h.years).toEqual(['2026', '2025'])
    expect(h.enquiries).toHaveLength(1)
    expect(h.products[0]).toMatchObject({ productName: 'Necklace box', orders: 2, quantity: 2000 })
  })

  it('finds a customer by ID, name, order ID or invoice number', () => {
    const db = sample()
    expect(searchCustomers(db, 'cus-0002').map((c) => c.id)).toEqual(['c2'])
    expect(searchCustomers(db, 'moon').map((c) => c.id)).toEqual(['c1'])
    expect(searchCustomers(db, '20260905').map((c) => c.id)).toEqual(['c2'])
    expect(searchCustomers(db, '2024-25/0007').map((c) => c.id)).toEqual(['c1'])
  })
})
