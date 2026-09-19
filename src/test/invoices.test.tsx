// @vitest-environment jsdom
/* Invoices page through the real UI. Passwords are disposable test values. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import App from '../App'
import { StoreProvider } from '../store/store'
import { DB_KEY } from '../lib/db'
import type { VertexDB } from '../lib/types'
import { ADMIN, PROCESS_UNITS, UNIT, ctxFor, must, seedMaster, seedResources } from './fixtures'
import { savePlan, submitPlan } from '../domain/planning'
import { finalizeCosting, openCosting } from '../domain/orderCosting'
import { assignProcessResources, completeProcess } from '../domain/production'
import { confirmDispatch, confirmDispatchReceived } from '../domain/dispatch'
import { DocumentBlockedError, invoiceDoc } from '../components/DocumentPreview'
import { saveCompanyProfile } from '../domain/system'

const TEST_PASSWORD = 'disposable-test-pass-1'

/** A 10,000-piece order dispatched 300 (received) then 5,000 (awaiting receipt), plus an undispatched second order. */
function seed(): VertexDB {
  const seeded = seedMaster()
  const res = seedResources(seeded.db)
  let db = res.db
  const makeOrder = (quantity: number) => {
    const plan = must(
      savePlan({ customerId: seeded.customerId, productId: seeded.productId, quantity, orderDate: '2026-09-15', deliveryDate: '2026-10-10', priority: 'Normal', customerRef: '', dimensions: '', options: '', instructions: '', processUnits: PROCESS_UNITS })(db, ctxFor()),
    )
    db = must(submitPlan(plan.value.id)(plan.db, ctxFor())).db
    const costing = must(openCosting(plan.value.id)(db, ctxFor()))
    const f = must(finalizeCosting(costing.value.id)(costing.db, ctxFor()))
    db = f.db
    return f.value.order
  }
  const order = makeOrder(10_000)
  makeOrder(500)
  for (const pr of order.stages.flatMap((s) => s.processes)) {
    const u = ctxFor(UNIT(Number(pr.unitId.slice(1))))
    db = must(assignProcessResources(order.id, pr.id, { responsiblePersonId: res.personOf(pr.unitId), machineId: res.machineOf(pr.unitId), noMachineRequired: false })(db, u)).db
    db = must(completeProcess(order.id, pr.id)(db, u)).db
  }
  db = must(saveCompanyProfile({ name: 'Vertex Print Pack (TEST)', address: 'Demo Estate', phone: '', email: '', gstin: '33AAACV1234C1ZW', invoicePrefix: 'INV', bankDetails: '', invoiceTerms: '' })(db, ctxFor())).db
  const ship = (requestId: string, quantity: number, date: string) =>
    (db = must(confirmDispatch({ requestId, orderId: order.id, date, quantity, deliveryAddress: 'Warehouse', transporter: 'Fast Freight', vehicleNo: '', notes: '' })(db, ctxFor(ADMIN[0]))).db)
  ship('r1', 300, '2026-09-15')
  db = must(confirmDispatchReceived(db.dispatches[0].id)(db, ctxFor(ADMIN[1]))).db
  ship('r2', 5_000, '2026-09-16')
  return db
}

function mount(path = '/login') {
  const router = createMemoryRouter([{ path: '*', element: (<StoreProvider><App /></StoreProvider>) }], { initialEntries: [path] })
  const view = render(<RouterProvider router={router} />)
  return { router, view }
}

async function signIn(name: string) {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('radio', { name: new RegExp(name) }))
  await user.type(screen.getByLabelText(/New password/), TEST_PASSWORD)
  await user.type(screen.getByLabelText(/Confirm password/), TEST_PASSWORD)
  await user.click(screen.getByRole('button', { name: /Create password & sign in/ }))
  return user
}

const stored = (): VertexDB => JSON.parse(localStorage.getItem(DB_KEY)!)

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  localStorage.setItem(DB_KEY, JSON.stringify(seed()))
})
afterEach(() => cleanup())

const PENDING = 'Confirm delivery received in Dispatch to enable invoice download.'
const PENDING_BILLING = 'Awaiting delivery confirmation from Administrator 1 or 2.'

describe('Invoices page', () => {
  it.each(['Administrator 1', 'Administrator 2', 'Administrator 3'])('%s sees dispatched / received / awaiting quantities and gated downloads', async (name) => {
    const { router, view } = mount()
    const user = await signIn(name)
    const nav = (await screen.findAllByRole('navigation', { name: 'Modules' }))[0]
    await user.click(within(nav).getByRole('link', { name: /Invoices/ }))
    await screen.findByRole('heading', { name: 'Invoices' })
    expect(router.state.location.pathname).toBe('/invoices')

    const row = (await screen.findByRole('button', { name: 'CUS-0001-20260915-01' })).closest('tr')!
    for (const t of ['10,000 pcs', '5,300 pcs', '300 pcs', '5,000 pcs', '4,700 pcs', 'Partially dispatched']) expect(within(row).getByText(t)).toBeTruthy()

    const records = JSON.stringify({ invoices: stored().invoices, counters: stored().counters })
    await user.click(screen.getByRole('button', { name: 'CUS-0001-20260915-01' }))
    // 300 received → the cumulative Download PDF is available.
    const download = await screen.findByRole('button', { name: 'Download PDF — cumulative invoice summary' })
    expect((download as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByText(/5,000 pcs dispatched but awaiting receipt are not included yet/)).toBeTruthy()
    const [first, second] = stored().invoices
    expect((screen.getByRole('button', { name: `Download this dispatch invoice — invoice ${first.number}` }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByRole('button', { name: `Download this dispatch invoice — invoice ${second.number}` }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(name === 'Administrator 3' ? PENDING_BILLING : PENDING)).toBeTruthy()
    expect(screen.queryAllByRole('link', { name: /Confirm received/ })).toHaveLength(name === 'Administrator 3' ? 0 : 1)

    // Survives a reload.
    const url = `${router.state.location.pathname}${router.state.location.search}`
    view.unmount()
    const again = mount(url)
    expect(((await screen.findByRole('button', { name: 'Download PDF — cumulative invoice summary' })) as HTMLButtonElement).disabled).toBe(false)

    // Nothing received yet: the button is visible but unavailable, with the reason.
    await user.click(screen.getByRole('button', { name: 'All orders' }))
    await user.click(await screen.findByRole('button', { name: 'CUS-0001-20260915-02' }))
    expect(await screen.findByText('Nothing dispatched yet')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Download PDF — cumulative invoice summary' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(name === 'Administrator 3' ? PENDING_BILLING : PENDING)).toBeTruthy()

    // Viewing never creates financial records.
    expect(JSON.stringify({ invoices: stored().invoices, counters: stored().counters })).toBe(records)

    if (name === 'Administrator 3') {
      await again.router.navigate('/dispatch')
      await waitFor(() => expect(again.router.state.location.pathname).toBe('/billing'))
    }
    if (name === 'Administrator 2') {
      await again.router.navigate('/costing')
      await waitFor(() => expect(again.router.state.location.pathname).toBe('/production'))
    }
  }, 90000)

  it('Administrator 1 confirms the 5,000 shipment in Dispatch; Invoices then covers 5,300 after a reload', async () => {
    const orderId = stored().orders.find((o) => o.code === 'CUS-0001-20260915-01')!.id
    const first = mount()
    const user = await signIn('Administrator 1')
    await screen.findByRole('heading', { name: 'Production' }, { timeout: 5000 })
    await first.router.navigate(`/dispatch?order=${orderId}`)
    const [, awaiting] = stored().dispatches
    await user.click(await screen.findByRole('button', { name: `Confirm received — ${awaiting.code}` }, { timeout: 5000 }))
    const dialog = await screen.findByRole('dialog', { name: 'Confirm delivery received?' })
    expect(within(dialog).getByText('CUS-0001-20260915-01')).toBeTruthy()
    expect(within(dialog).getByText(awaiting.code)).toBeTruthy()
    expect(within(dialog).getByText('5,000 pcs')).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: 'Confirm received' }))
    await waitFor(() => expect(stored().dispatches[1].receivedAt).toBeTruthy())
    expect(stored().dispatches[1].receivedBy).toBe('Administrator 1')
    expect(screen.queryByRole('button', { name: `Confirm received — ${awaiting.code}` })).toBeNull()
    expect(stored().invoices).toHaveLength(2)

    first.view.unmount()
    mount(`/invoices?order=${orderId}`)
    expect(await screen.findByText(/Updated cumulative invoice summary of the 2 shipment\(s\) confirmed received: 5,300 pcs/, {}, { timeout: 5000 })).toBeTruthy()
    for (const inv of stored().invoices)
      expect((screen.getByRole('button', { name: `Download this dispatch invoice — invoice ${inv.number}` }) as HTMLButtonElement).disabled).toBe(false)
  }, 90000)

  it('refuses to build an invoice PDF for a shipment that is not confirmed received', async () => {
    const db = stored()
    const pending = db.invoices[1]
    await expect(invoiceDoc(pending, () => db).build()).rejects.toBeInstanceOf(DocumentBlockedError)
  })

  it('unit users do not get Invoices', async () => {
    const { router } = mount()
    await signIn('Unit 1 Supervisor')
    await screen.findByRole('heading', { name: /Unit 1/ }, { timeout: 5000 })
    const nav = screen.getAllByRole('navigation', { name: 'Modules' })[0]
    expect(within(nav).queryByRole('link', { name: /Invoices/ })).toBeNull()
    await router.navigate('/invoices')
    await waitFor(() => expect(router.state.location.pathname).toBe('/production'))
  }, 30000)
})
