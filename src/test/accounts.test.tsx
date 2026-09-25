// @vitest-environment jsdom
/* Income & expenses through the real UI. Passwords are disposable test values. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import App from '../App'
import { StoreProvider } from '../store/store'
import { DB_KEY } from '../lib/db'
import { buildEmptyDB } from '../lib/defaults'
import type { Invoice, VertexDB } from '../lib/types'

const TEST_PASSWORD = 'disposable-test-pass-1'
const MONTH = new Date().toISOString().slice(0, 7)

/** An empty database with one unpaid ₹11,800 sales invoice. */
function seed(): VertexDB {
  const invoice = { id: 'INV-1', number: 'INV/2026-27/0001', issueDate: `${MONTH}-02`, total: 11800, customer: { company: 'Apex Industries' } } as unknown as Invoice
  return { ...buildEmptyDB(), invoices: [invoice] }
}

function mount(path = '/login') {
  const router = createMemoryRouter([{ path: '*', element: (<StoreProvider><App /></StoreProvider>) }], { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

const stored = (): VertexDB => JSON.parse(localStorage.getItem(DB_KEY)!)

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  localStorage.setItem(DB_KEY, JSON.stringify(seed()))
})
afterEach(() => cleanup())

describe('Income & Expenses page', () => {
  it('collects an invoice payment and records an expense, updating the month and the dues', async () => {
    const router = mount()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('radio', { name: /Administrator 2/ }))
    await user.type(screen.getByLabelText(/New password/), TEST_PASSWORD)
    await user.type(screen.getByLabelText(/Confirm password/), TEST_PASSWORD)
    await user.click(screen.getByRole('button', { name: /Create password & sign in/ }))
    const nav = (await screen.findAllByRole('navigation', { name: 'Modules' }, { timeout: 5000 }))[0]
    await user.click(within(nav).getByRole('link', { name: /Income & Expenses/ }))
    await screen.findByRole('heading', { level: 1, name: 'Income & Expenses' })

    // The unpaid invoice waits under "To collect".
    await user.click(screen.getByRole('button', { name: /To collect/ }))
    expect(router.state.location.search).toContain('tab=collect')
    await user.click(await screen.findByRole('button', { name: 'Record payment…' }))
    const amount = screen.getByLabelText('Amount in rupees') as HTMLInputElement
    expect(amount.value).toBe('11800')
    await user.clear(amount)
    await user.type(amount, '5000')
    await user.click(screen.getByRole('button', { name: 'Save money in' }))
    await waitFor(() => expect(stored().cashbook).toHaveLength(1))
    expect(stored().cashbook[0]).toMatchObject({ code: 'RCT-0001', invoiceId: 'INV-1', amount: 5000, party: 'Apex Industries' })
    expect(await screen.findByText('₹ 6,800.00')).toBeTruthy()

    // An everyday expense with no bill.
    await user.click(screen.getByRole('button', { name: /Money out…/ }))
    const kind = screen.getByRole('combobox', { name: /Kind/ }) as HTMLInputElement
    await user.clear(kind)
    await user.type(kind, 'Electricity')
    await user.type(screen.getByLabelText('Amount in rupees'), '1200.50')
    await user.type(screen.getByLabelText(/Paid to/), 'TNEB')
    await user.click(screen.getByRole('button', { name: 'Save money out' }))
    await waitFor(() => expect(stored().cashbook).toHaveLength(2))
    expect(stored().cashbook[1]).toMatchObject({ code: 'PAY-0001', direction: 'out', category: 'Electricity', amount: 1200.5 })

    // The month adds up: 5,000 in, 1,200.50 out.
    await user.click(screen.getByRole('button', { name: /Entries/ }))
    expect(screen.getAllByText('₹ 5,000.00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('₹ 1,200.50').length).toBeGreaterThan(0)
    expect(screen.getAllByText('₹ 3,799.50').length).toBeGreaterThan(0)
  }, 60000)
})
