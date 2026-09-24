// @vitest-environment jsdom
/* Drives the real sign-in UI (LoginPage, AppShell, routing, store) in jsdom.
   Passwords here are disposable test values for throwaway local accounts. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import App from '../App'
import { StoreProvider } from '../store/store'
import { DB_KEY } from '../lib/db'
import { buildEmptyDB } from '../lib/defaults'
import type { VertexDB } from '../lib/types'
import { ctxFor, must, PROCESS_UNITS, seedMaster } from './fixtures'
import { savePlan, submitPlan } from '../domain/planning'
import { finalizeCosting, openCosting } from '../domain/orderCosting'

const TEST_PASSWORD = 'disposable-test-pass-1'

function mount(path = '/login') {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <StoreProvider>
            <App />
          </StoreProvider>
        ),
      },
    ],
    { initialEntries: [path] },
  )
  const view = render(<RouterProvider router={router} />)
  return { router, view }
}

const stored = (): VertexDB => JSON.parse(localStorage.getItem(DB_KEY)!)

async function chooseAccount(name: string) {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('radio', { name: new RegExp(name) }))
  return user
}

async function signOut(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('button', { name: `Account — ${name}` }))
  await user.click(await screen.findByRole('button', { name: 'Sign out' }))
  await screen.findByRole('heading', { name: 'Sign in' })
}

function seedOrderAcrossUnits(): VertexDB {
  const seeded = seedMaster(buildEmptyDB())
  let db = seeded.db
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
  return must(finalizeCosting(db.costings[0].id)(db, ctxFor())).db
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => cleanup())

describe('sign-in through the real UI', () => {
  it('creates a first password, signs out, rejects a wrong password, signs in and restores the session', async () => {
    const first = mount()
    let user = await chooseAccount('Administrator 1')
    expect(screen.getByText(/First sign-in for Administrator 1/)).toBeTruthy()

    await user.type(screen.getByLabelText(/New password/), TEST_PASSWORD)
    await user.type(screen.getByLabelText(/Confirm password/), 'different-value-9')
    await user.click(screen.getByRole('button', { name: /Create password & sign in/ }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/do not match/)
    expect(stored().users.find((u) => u.id === 'USR-ADM1')!.passwordHash).toBeNull()

    await user.clear(screen.getByLabelText(/Confirm password/))
    await user.type(screen.getByLabelText(/Confirm password/), TEST_PASSWORD)
    await user.click(screen.getByRole('button', { name: /Create password & sign in/ }))
    await screen.findByRole('heading', { name: /^Good (morning|afternoon|evening),/ }, { timeout: 5000 })
    expect(first.router.state.location.pathname).toBe('/home')
    expect(screen.getByRole('button', { name: 'Account — Administrator 1' })).toBeTruthy()
    const saved = stored()
    expect(saved.users.find((u) => u.id === 'USR-ADM1')!.passwordHash).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(saved)).not.toContain(TEST_PASSWORD)
    expect(saved.audit.slice(0, 2).map((a) => `${a.userId}:${a.action}`)).toEqual(['USR-ADM1:Signed in', 'USR-ADM1:Password created on first sign-in'])

    await signOut(user, 'Administrator 1')
    expect(sessionStorage.getItem('vertex-erp-session-v2')).toBeNull()
    expect(stored().audit[0].action).toBe('Signed out')

    user = await chooseAccount('Administrator 1')
    expect(screen.queryByLabelText(/Confirm password/)).toBeNull()
    await user.type(screen.getByLabelText(/^Password/), 'wrong-password-1')
    await user.click(screen.getByRole('button', { name: /^Sign in$/ }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/Incorrect password/)
    expect(first.router.state.location.pathname).toBe('/login')

    await user.clear(screen.getByLabelText(/^Password/))
    await user.type(screen.getByLabelText(/^Password/), TEST_PASSWORD)
    await user.click(screen.getByRole('button', { name: /^Sign in$/ }))
    await screen.findByRole('heading', { name: /^Good (morning|afternoon|evening),/ }, { timeout: 5000 })

    // Reload: unmount everything and mount a fresh app with the same browser storage.
    cleanup()
    const second = mount('/billing')
    await screen.findByRole('heading', { name: 'Billing' }, { timeout: 5000 })
    expect(second.router.state.location.pathname).toBe('/home')
    expect(screen.getByRole('button', { name: 'Account — Administrator 1' })).toBeTruthy()
  }, 30000)

  it('sends a signed-out visitor to sign-in and back to the requested page afterwards', async () => {
    const { router } = mount('/planning')
    await screen.findByRole('heading', { name: 'Sign in' })
    expect(router.state.location.pathname).toBe('/login')
    const user = await chooseAccount('Administrator 1')
    await user.type(screen.getByLabelText(/New password/), TEST_PASSWORD)
    await user.type(screen.getByLabelText(/Confirm password/), TEST_PASSWORD)
    await user.click(screen.getByRole('button', { name: /Create password & sign in/ }))
    await screen.findByRole('heading', { name: 'Planning' }, { timeout: 5000 })
    expect(router.state.location.pathname).toBe('/planning')
  }, 30000)

  it('gives Administrator 2 only Production, Dispatch and Billing — in the nav, by URL, and in the account dialog', async () => {
    localStorage.setItem(DB_KEY, JSON.stringify(seedOrderAcrossUnits()))
    const { router } = mount()
    const user = await chooseAccount('Administrator 2')
    await user.type(screen.getByLabelText(/New password/), TEST_PASSWORD)
    await user.type(screen.getByLabelText(/Confirm password/), TEST_PASSWORD)
    await user.click(screen.getByRole('button', { name: /Create password & sign in/ }))
    await screen.findByRole('heading', { name: /^Good (morning|afternoon|evening),/ }, { timeout: 5000 })
    expect(router.state.location.pathname).toBe('/home')

    const modules = screen.getAllByRole('navigation', { name: 'Modules' })[0]
    const linked = within(modules)
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'))
    expect(linked.sort()).toEqual(['/billing', '/customers', '/dispatch', '/home', '/invoices', '/production', '/reports', '/units'])

    // Restricted modules recover to an allowed page instead of rendering.
    for (const path of ['/master/products', '/master/costing', '/planning', '/costing', '/settings']) {
      await router.navigate(path)
      await waitFor(() => expect(router.state.location.pathname).toBe('/home'))
    }
    expect(screen.queryByText(/Product register|Costing configuration|Units, people & machines/)).toBeNull()

    // Personal actions stay; account administration does not.
    await user.click(screen.getByRole('button', { name: 'Account — Administrator 2' }))
    await user.click(await screen.findByRole('button', { name: 'My account' }))
    expect(await screen.findByRole('heading', { name: 'Display name' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'All accounts' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Reset password/ })).toBeNull()
  }, 30000)

  it('offers only the two administrators on the sign-in screen', async () => {
    mount()
    expect(await screen.findByRole('radio', { name: /Administrator 1/ })).toBeTruthy()
    expect(screen.getByRole('radio', { name: /Administrator 2/ })).toBeTruthy()
    expect(screen.getAllByRole('radio')).toHaveLength(2)
    expect(screen.queryByRole('radio', { name: /Administrator 3/ })).toBeNull()
    expect(screen.queryByRole('radio', { name: /Unit \d Supervisor/ })).toBeNull()
  }, 30000)

  it('lets an administrator run one unit’s work from Units and print its job sheet', async () => {
    localStorage.setItem(DB_KEY, JSON.stringify(seedOrderAcrossUnits()))
    const { router } = mount()
    const user = await chooseAccount('Administrator 2')
    await user.type(screen.getByLabelText(/New password/), TEST_PASSWORD)
    await user.type(screen.getByLabelText(/Confirm password/), TEST_PASSWORD)
    await user.click(screen.getByRole('button', { name: /Create password & sign in/ }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/home'), { timeout: 5000 })
    const modules = (await screen.findAllByRole('navigation', { name: 'Modules' }, { timeout: 5000 }))[0]
    expect(within(modules).getByRole('link', { name: /Units/ })).toBeTruthy()
    // The old unit-only area is gone.
    expect(within(modules).queryByRole('link', { name: /Allocations/ })).toBeNull()

    await router.navigate('/units/U2')
    await screen.findByRole('heading', { level: 1, name: 'Unit 2' }, { timeout: 5000 })
    // Unit 2 is allocated only "Die cut"; other units' processes are not listed here.
    await user.click(screen.getByRole('button', { name: /Waiting on earlier work/ }))
    expect(await screen.findByText(/2.1 Die cut/)).toBeTruthy()
    expect(screen.queryByText(/1.1 Plate making/)).toBeNull()
    expect(screen.queryByText(/3.2 Packing/)).toBeNull()
    // The parent stage and its id travel with the process.
    expect(screen.getByText(/Stage ID st-cut/)).toBeTruthy()
    // Each job can be printed for the unit's in-charge, and no money is shown.
    expect(screen.getAllByRole('button', { name: /Job sheet/ }).length).toBeGreaterThan(0)
    expect(document.body.textContent).not.toMatch(/₹/)
  }, 30000)
})
