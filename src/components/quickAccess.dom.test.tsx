/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { StoreProvider } from '../store/store'
import { DB_KEY, saveSession } from '../lib/db'
import { QuickAccessBar } from './QuickAccess'
import { ADMIN, seedMaster } from '../test/fixtures'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

function mount() {
  localStorage.setItem(DB_KEY, JSON.stringify(seedMaster().db))
  saveSession(ADMIN[0].id)
  const router = createMemoryRouter(
    [
      { path: '/', element: (<StoreProvider><QuickAccessBar /></StoreProvider>) },
      { path: '*', element: <p>moved</p> },
    ],
    { initialEntries: ['/'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('quick access box', () => {
  it('takes a sentence and goes where it points', async () => {
    const router = mount()
    const user = userEvent.setup()
    const box = await screen.findByRole('combobox', { name: 'Quick access' })
    await user.type(box, 'i want to make a purchase bill')
    const option = await screen.findByRole('option', { name: /Record a purchase bill/ })
    await user.click(option)
    await waitFor(() => expect(router.state.location.pathname + router.state.location.search).toBe('/billing?tab=purchase&new=1'))
  })

  it('offers suggestions before anything is typed, and Enter opens the first one', async () => {
    const router = mount()
    const user = userEvent.setup()
    const box = await screen.findByRole('combobox', { name: 'Quick access' })
    await user.click(box)
    expect(await screen.findByText('Suggested for you right now')).toBeTruthy()
    expect((await screen.findAllByRole('option')).length).toBeGreaterThan(0)
    await user.keyboard('{Enter}')
    await waitFor(() => expect(router.state.location.pathname).not.toBe('/'))
  })
})
