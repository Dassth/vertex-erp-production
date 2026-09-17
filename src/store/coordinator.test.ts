import { describe, expect, it } from 'vitest'
import { DbCoordinator, LEASE_KEY } from './coordinator'
import type { ChannelLike, LockManagerLike } from './coordinator'
import { DB_KEY } from '../lib/db'
import type { StorageLike } from '../lib/db'
import type { VertexDB } from '../lib/types'
import type { Actor, Ctx } from '../domain/common'
import { ADMIN, PROCESS_UNITS, UNIT, ctxFor, must, seedMaster, seedResources } from '../test/fixtures'
import { materialToDraft, saveCustomer, saveMaterial, saveProduct } from '../domain/master'
import type { ProductDraft } from '../domain/master'
import { savePlan, submitPlan } from '../domain/planning'
import { finalizeCosting, openCosting } from '../domain/orderCosting'
import { assignProcessResources, completeProcess } from '../domain/production'
import { confirmDispatch } from '../domain/dispatch'
import { saveCompanyProfile } from '../domain/system'
import { orderBalance } from '../lib/billing'

/* ------------------------------ Test browser ------------------------------ */
/* One shared storage + one lock manager + one broadcast hub model a single
   browser profile; each DbCoordinator is one tab with its own memory. */

function sharedStorage(): StorageLike & { failWrites: boolean } {
  const map = new Map<string, string>()
  return {
    failWrites: false,
    getItem: (k) => map.get(k) ?? null,
    setItem(k, v) {
      if (this.failWrites && k === DB_KEY) throw new Error('QuotaExceededError')
      map.set(k, v)
    },
    removeItem: (k) => void map.delete(k),
  }
}

function browserLocks(): LockManagerLike {
  let tail: Promise<unknown> = Promise.resolve()
  return {
    request<T>(_name: string, _o: { mode: 'exclusive' }, cb: () => Promise<T> | T) {
      const run = tail.then(async () => {
        await new Promise((r) => setTimeout(r, 1)) // force real interleaving between tabs
        return cb()
      })
      tail = run.catch(() => undefined)
      return run
    },
  }
}

function hub() {
  const channels: ChannelLike[] = []
  return () => {
    const ch: ChannelLike = {
      onmessage: null,
      postMessage(message) {
        for (const other of channels) if (other !== ch) queueMicrotask(() => other.onmessage?.({ data: message }))
      },
      close() {
        channels.splice(channels.indexOf(ch), 1)
      },
    }
    channels.push(ch)
    return ch
  }
}

let clock = Date.parse('2026-09-15T10:00:00Z')
const ctxAs = (actor: Actor) => (): Ctx => ({ ...ctxFor(actor), now: new Date((clock += 1000)) })

function browser(initial: VertexDB, withLocks = true) {
  const storage = sharedStorage()
  storage.setItem(DB_KEY, JSON.stringify(initial))
  const locks = withLocks ? browserLocks() : null
  const channel = hub()
  const tab = (id: string) => {
    const changes: string[] = []
    const c = new DbCoordinator(initial, { storage, locks, channel: channel(), tabId: id, onChange: (_db, source) => changes.push(source) })
    return { c, changes }
  }
  return { storage, tab }
}

const persisted = (s: StorageLike): VertexDB => JSON.parse(s.getItem(DB_KEY)!)
const run = <T>(c: DbCoordinator, op: Parameters<DbCoordinator['commit']>[0], actor: Actor = ADMIN[0]) =>
  c.commit(op as never, ctxAs(actor)) as Promise<import('../domain/common').OpResult<T>>

/** Master data + a plan ready for costing, persisted as the starting point. */
function readyForCosting(): { db: VertexDB; planId: string; personOf: (u: string) => string; machineOf: (u: string) => string } {
  const seeded = seedMaster()
  const resources = seedResources(seeded.db)
  let db = resources.db
  const plan = must(
    savePlan({
      customerId: seeded.customerId,
      productId: seeded.productId,
      quantity: 1000,
      orderDate: '2026-09-15',
      deliveryDate: '2026-10-10',
      priority: 'Normal',
      customerRef: '',
      dimensions: '',
      options: '',
      instructions: '',
      processUnits: PROCESS_UNITS,
    })(db, ctxFor()),
  )
  db = must(submitPlan(plan.value.id)(plan.db, ctxFor())).db
  db = must(openCosting(plan.value.id)(db, ctxFor())).db
  return { db, planId: plan.value.id, personOf: resources.personOf, machineOf: resources.machineOf }
}

describe('cross-tab write coordination', () => {
  it('finalizes costing exactly once when two tabs confirm at the same time', async () => {
    const { db } = readyForCosting()
    const b = browser(db)
    const tabA = b.tab('A')
    const tabB = b.tab('B')
    const costingId = db.costings[0].id
    const [ra, rb] = await Promise.all([
      run<{ created: boolean }>(tabA.c, finalizeCosting(costingId), ADMIN[0]),
      run<{ created: boolean }>(tabB.c, finalizeCosting(costingId), ADMIN[0]),
    ])
    expect(ra.ok && rb.ok).toBe(true)
    const created = [ra, rb].filter((r) => r.ok && r.value.created)
    expect(created).toHaveLength(1)
    expect(persisted(b.storage).orders).toHaveLength(1)
    expect(persisted(b.storage).revision).toBe(db.revision + 1)
  })

  it('a stale tab confirming later still gets the existing order, not a duplicate', async () => {
    const { db } = readyForCosting()
    const b = browser(db)
    const tabA = b.tab('A')
    const tabB = b.tab('B')
    tabB.c.dispose() // B never hears about A's write — its memory stays stale
    await run(tabA.c, finalizeCosting(db.costings[0].id))
    const late = await run<{ created: boolean; order: { id: string } }>(tabB.c, finalizeCosting(db.costings[0].id), ADMIN[2])
    expect(late.ok && late.value.created).toBe(false)
    expect(persisted(b.storage).orders).toHaveLength(1)
    expect(tabB.changes).toContain('external')
  })

  it('never over-dispatches or reuses an invoice number across tabs', async () => {
    let { db, personOf, machineOf } = readyForCosting()
    db = must(finalizeCosting(db.costings[0].id)(db, ctxFor())).db
    const order = db.orders[0]
    for (const pr of order.stages.flatMap((s) => s.processes)) {
      const actor = ctxFor(UNIT(Number(pr.unitId.slice(1))))
      db = must(
        assignProcessResources(order.id, pr.id, { responsiblePersonId: personOf(pr.unitId), machineId: machineOf(pr.unitId), noMachineRequired: false })(db, actor),
      ).db
      db = must(completeProcess(order.id, pr.id)(db, actor)).db
    }
    db = must(saveCompanyProfile({ name: 'Co', address: 'Addr', phone: '', email: '', gstin: '33AAAAA0000A1Z5', invoicePrefix: 'INV', bankDetails: '', invoiceTerms: '' })(db, ctxFor())).db
    const b = browser(db)
    const tabA = b.tab('A')
    const tabB = b.tab('B')
    const req = (requestId: string, quantity: number) => confirmDispatch({ requestId, orderId: order.id, date: '2026-09-15', quantity, deliveryAddress: 'X', transporter: '', vehicleNo: '', notes: '' })

    const [a1, b1] = await Promise.all([run(tabA.c, req('a1', 100)), run(tabB.c, req('b1', 200))])
    expect(a1.ok && b1.ok).toBe(true)
    let saved = persisted(b.storage)
    expect(saved.invoices.map((i) => i.number).sort()).toEqual(['INV/2026-27/0001', 'INV/2026-27/0002'])
    expect(orderBalance(saved.orders[0], saved.dispatches).remainingQty).toBe(700)

    // Same request replayed from the other tab returns the stored record.
    const replay = await run<{ duplicate: boolean }>(tabB.c, req('a1', 100))
    expect(replay.ok && replay.value.duplicate).toBe(true)

    // Both tabs try to take the remainder simultaneously: only one can succeed.
    const [a2, b2] = await Promise.all([run(tabA.c, req('a2', 700)), run(tabB.c, req('b2', 700))])
    expect([a2.ok, b2.ok].filter(Boolean)).toHaveLength(1)
    const rejected = [a2, b2].find((r) => !r.ok)
    expect(rejected && !rejected.ok && rejected.error).toMatch(/Nothing remains|remain/)
    saved = persisted(b.storage)
    expect(saved.invoices).toHaveLength(3)
    expect(orderBalance(saved.orders[0], saved.dispatches).remainingQty).toBe(0)
  })

  it('keeps independent edits made from two tabs (no lost update)', async () => {
    const { db, customerId, sheetId } = seedMaster()
    const b = browser(db)
    const tabA = b.tab('A')
    const tabB = b.tab('B')
    const customer = db.customers.find((c) => c.id === customerId)!
    const material = db.materials.find((m) => m.id === sheetId)!
    await Promise.all([
      run(tabA.c, saveCustomer({ ...customer, id: customer.id, paymentTerms: '45 days', expectedUpdatedAt: customer.updatedAt })),
      run(tabB.c, saveMaterial({ ...materialToDraft(material), price: 19 }), ADMIN[0]),
    ])
    const saved = persisted(b.storage)
    expect(saved.customers[0].paymentTerms).toBe('45 days')
    expect(saved.materials.find((m) => m.id === sheetId)!.price).toBe(19)
  })

  it('refuses a stale editor save instead of overwriting a newer version', async () => {
    const { db, productId } = seedMaster()
    const b = browser(db)
    const tabA = b.tab('A')
    const tabB = b.tab('B')
    const p = db.products.find((x) => x.id === productId)!
    const draft = (name: string): ProductDraft => ({ id: p.id, code: p.code, name, category: p.category, description: '', hsn: p.hsn, uom: p.uom, taxPct: p.taxPct, stages: p.stages, materials: p.materials, expectedUpdatedAt: p.updatedAt })
    const first = await run(tabB.c, saveProduct(draft('Edited in tab B')), ADMIN[0])
    expect(first.ok).toBe(true)
    const stale = await run(tabA.c, saveProduct(draft('Edited in stale tab A')))
    expect(stale.ok).toBe(false)
    expect(!stale.ok && stale.conflict).toBe(true)
    expect(!stale.ok && stale.error).toMatch(/Administrator 1/)
    expect(persisted(b.storage).products[0].name).toBe('Edited in tab B')
  })

  it('reports a storage failure and leaves both memory and storage unchanged', async () => {
    const { db, sheetId } = seedMaster()
    const b = browser(db)
    const tabA = b.tab('A')
    const before = b.storage.getItem(DB_KEY)
    b.storage.failWrites = true
    const r = await run(tabA.c, saveMaterial({ ...materialToDraft(db.materials.find((m) => m.id === sheetId)!), price: 99 }))
    expect(!r.ok && r.storageFailure).toBe(true)
    expect(b.storage.getItem(DB_KEY)).toBe(before)
    expect(tabA.c.db.materials.find((m) => m.id === sheetId)!.price).toBe(12)
  })

  it('notifies other tabs after a successful write', async () => {
    const { db, customerId } = seedMaster()
    const b = browser(db)
    const tabA = b.tab('A')
    const tabB = b.tab('B')
    const customer = db.customers.find((c) => c.id === customerId)!
    await run(tabA.c, saveCustomer({ ...customer, id: customer.id, notes: 'from A', expectedUpdatedAt: customer.updatedAt }))
    await new Promise((r) => setTimeout(r, 5))
    expect(tabB.changes).toContain('external')
    expect(tabB.c.db.customers[0].notes).toBe('from A')
  })

  it('without Web Locks, lets one tab write and makes the others read-only', async () => {
    const { db, customerId } = seedMaster()
    const b = browser(db, false)
    const tabA = b.tab('A')
    const tabB = b.tab('B')
    const customer = db.customers.find((c) => c.id === customerId)!
    const ok = await run(tabA.c, saveCustomer({ ...customer, id: customer.id, notes: 'A', expectedUpdatedAt: customer.updatedAt }))
    expect(ok.ok).toBe(true)
    expect(tabB.c.canWrite()).toBe(false)
    const blocked = await run(tabB.c, saveCustomer({ ...customer, id: customer.id, notes: 'B' }))
    expect(!blocked.ok && blocked.readOnly).toBe(true)
    tabA.c.dispose()
    expect(b.storage.getItem(LEASE_KEY)).toBeNull()
    const after = await run(tabB.c, saveCustomer({ ...persisted(b.storage).customers[0], id: customer.id, notes: 'B later' }))
    expect(after.ok).toBe(true)
    tabB.c.dispose()
  })
})
