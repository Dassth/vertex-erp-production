// @vitest-environment jsdom
/* The licence lock screen of an installed copy, and each computer's own sign-in address. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { LicenceGate } from '../components/LicenceGate'
import App from '../App'
import { StoreProvider } from '../store/store'

const base = { ok: true, managed: true, licenceId: 'VPP-2026-01', customer: 'Vertex Print Pack', checkedAt: '2026-09-26T04:00:00Z', validUntil: null, lastError: null }
const suspended = { ...base, active: false, mode: 'view-only', reason: 'suspended', message: 'Payment pending — please call Back Moon Devs.' }
const deactivated = { ...base, active: false, mode: 'locked', reason: 'deactivated', message: 'This copy has been deactivated.' }
const open = { ...base, active: true, mode: 'open', reason: null, message: 'Licence active.' }

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function app(onAdd = vi.fn()) {
  render(
    <LicenceGate>
      <h1>The app</h1>
      <a href="#orders">Orders</a>
      <button type="button" onClick={onAdd}>
        Add new
      </button>
    </LicenceGate>,
  )
  return onAdd
}

describe('licence', () => {
  it('while suspended, keeps pages open but answers any button with the suspension notice', async () => {
    let answer: object = suspended
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(answer), { status: 200 })))
    const onAdd = app()
    const user = userEvent.setup()
    expect(await screen.findByRole('heading', { name: 'The app' })).toBeTruthy()
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 0))

    await user.click(screen.getByRole('button', { name: 'Add new' }))
    expect(onAdd).not.toHaveBeenCalled()
    const notice = await screen.findByRole('alertdialog', { name: 'Vertex ERP is suspended' })
    expect(within(notice).getByText('Payment pending — please call Back Moon Devs.')).toBeTruthy()
    expect(within(notice).getByRole('link', { name: /Call 89400/ }).getAttribute('href')).toBe('tel:+918940095659')

    // Paid: "Check again" opens everything, and buttons work again.
    answer = open
    await user.click(within(notice).getByRole('button', { name: 'Check again' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await user.click(screen.getByRole('button', { name: 'Add new' }))
    expect(onAdd).toHaveBeenCalledTimes(1)
  })

  it('shows the full lock screen when deactivated', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(deactivated), { status: 200 })))
    app()
    expect(await screen.findByRole('heading', { name: 'Vertex ERP is deactivated' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'The app' })).toBeNull()
  })

  it('stays out of the way when the server does not manage a licence', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true, managed: false, active: true }), { status: 200 })))
    const onAdd = app()
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Add new' }))
    expect(onAdd).toHaveBeenCalledTimes(1)
  })
})

describe('each computer signs in at its own address', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('shows only Administrator 2 at /admin2 and remembers the address', async () => {
    const router = createMemoryRouter([{ path: '*', element: (<StoreProvider><App /></StoreProvider>) }], { initialEntries: ['/admin2'] })
    render(<RouterProvider router={router} />)
    expect(await screen.findByText('Administrator 2')).toBeTruthy()
    expect(screen.queryByText('Administrator 1')).toBeNull()
    expect(screen.queryByRole('radio')).toBeNull()
    expect(localStorage.getItem('vertex-entry')).toBe('/admin2')
  })
})
