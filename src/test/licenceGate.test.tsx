// @vitest-environment jsdom
/* The licence lock screen of an installed copy, and each computer's own sign-in address. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { LicenceGate } from '../components/LicenceGate'
import App from '../App'
import { StoreProvider } from '../store/store'

const base = { ok: true, managed: true, licenceId: 'VPP-2026-01', customer: 'Vertex Print Pack', checkedAt: '2026-09-26T04:00:00Z', validUntil: null, lastError: null }
const locked = { ...base, active: false, reason: 'suspended', message: 'Payment pending — please call Back Moon Devs.' }
const open = { ...base, active: true, reason: null, message: 'Licence active.' }

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('licence lock screen', () => {
  it('replaces the app while suspended and opens it again after "Check again"', async () => {
    let answer: object = locked
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(answer), { status: 200 })))
    render(
      <LicenceGate>
        <p>The app</p>
      </LicenceGate>,
    )
    expect(await screen.findByRole('heading', { name: 'Vertex ERP is suspended' })).toBeTruthy()
    expect(screen.getByText('Payment pending — please call Back Moon Devs.')).toBeTruthy()
    expect(screen.getByText(/Your data is safe/)).toBeTruthy()
    expect(screen.queryByText('The app')).toBeNull()

    answer = open
    await userEvent.setup().click(screen.getByRole('button', { name: 'Check again' }))
    await waitFor(() => expect(screen.getByText('The app')).toBeTruthy())
  })

  it('stays out of the way when the server does not manage a licence', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true, managed: false, active: true }), { status: 200 })))
    render(
      <LicenceGate>
        <p>The app</p>
      </LicenceGate>,
    )
    expect(await screen.findByText('The app')).toBeTruthy()
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
