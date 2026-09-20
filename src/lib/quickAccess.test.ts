import { describe, expect, it } from 'vitest'
import { buildEmptyDB } from './defaults'
import { places, rank, records, suggestions, words } from './quickAccess'
import type { Customer, Dispatch, Invoice, Plan, ProductionOrder, VertexDB } from './types'

const top = (query: string, extra = places()) => rank(extra, query)[0]?.id

describe('quick access ranking', () => {
  it('understands a sentence, not just a keyword', () => {
    expect(top('I want to make a purchase bill')).toBe('purchase.new')
    expect(top('i need to take the bill')).toBe('invoice.download')
    expect(top('show me the gst report')).toBe('report.gst')
    expect(top('i want to change the settings')).toBe('go.settings')
    expect(top('create new plan')).toBe('plan.new')
    expect(top('customer history')).toBe('customer.history')
    expect(top('job card')).toBe('jobcard')
  })

  it('ignores filler words entirely', () => {
    expect(words('I want to')).toEqual(['i', 'want', 'to'])
    // …but they carry no meaning on their own.
    expect(rank(places(), 'i want to')).toEqual([])
  })

  it('returns nothing for a query that matches nothing', () => {
    expect(rank(places(), 'zzzz')).toEqual([])
  })

  it('lifts what this account picks often', () => {
    const plain = rank(places(), 'report')
    const second = plain[1].id
    expect(plain[0].id).not.toBe(second)
    // After picking the runner-up often enough, it comes first.
    const learned = rank(places(), 'report', { usage: { [second]: 8 } })
    expect(learned[0].id).toBe(second)
  })
})

function sample(): VertexDB {
  const db = buildEmptyDB(new Date('2026-09-20'))
  db.customers = [{ id: 'c1', code: 'CUS-0001', company: 'Lalchand Jewellers', contactPerson: '', gstin: '', phone: '', active: true } as unknown as Customer]
  db.plans = [{ id: 'pl1', code: 'PLN-0004', customerId: 'c1', productId: 'p1', status: 'Ready for Costing', priority: 'Urgent', customerRef: '' } as unknown as Plan]
  db.orders = [{ id: 'o1', code: 'CUS-0001-20260915-01', customer: { company: 'Lalchand Jewellers' }, productName: 'Necklace box', customerRef: '', status: 'Completed', completedQty: 500, stages: [] } as unknown as ProductionOrder]
  db.invoices = [{ id: 'i1', number: 'INV/2026-27/0001', orderId: 'o1', customer: { company: 'Lalchand Jewellers' }, issueDate: '2026-09-18', refs: { orderCode: 'CUS-0001-20260915-01' } } as unknown as Invoice]
  db.dispatches = [{ id: 'd1', orderId: 'o1', quantity: 100, receivedAt: null } as unknown as Dispatch]
  return db
}

describe('quick access over live records', () => {
  const db = sample()
  const all = [...places(), ...records(db)]

  it('finds a customer, an order and an invoice by what is written on them', () => {
    expect(rank(all, 'lalchand')[0].to).toBe('/customers?id=c1')
    expect(rank(all, 'INV/2026-27/0001')[0].to).toBe('/billing?order=o1')
    expect(rank(all, 'PLN-0004')[0].to).toBe('/planning/pl1')
  })

  it('suggests what needs attention when nothing is typed', () => {
    const s = suggestions(db, all, { now: new Date('2026-09-20') })
    expect(s[0].id).toBe('dispatch.receive')
    expect(s[0].reason).toMatch(/awaiting receipt/)
    expect(s.map((x) => x.id)).toContain('dispatch.new')
    expect(s.length).toBeLessThanOrEqual(6)
  })
})
