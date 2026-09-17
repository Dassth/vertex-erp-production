/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Suspense, lazy } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { RouteBoundary } from './RouteBoundary'
import { PageSkeleton } from './ui'

/* A code-split screen is fetched when it is opened, so the fetch can fail after a
   redeploy or a network drop. The app shell must survive that. */

afterEach(cleanup)

const screenFor = (load: () => Promise<{ default: () => React.JSX.Element }>) => lazy(load)

function App({ Screen }: { Screen: React.ComponentType }) {
  return (
    <MemoryRouter initialEntries={['/billing']}>
      <nav>Vertex ERP</nav>
      <RouteBoundary>
        <Suspense fallback={<PageSkeleton />}>
          <Screen />
        </Suspense>
      </RouteBoundary>
    </MemoryRouter>
  )
}

describe('lazy screen loading', () => {
  it('shows the skeleton while loading, then the screen', async () => {
    const Screen = screenFor(() => Promise.resolve({ default: () => <p>Invoice register</p> }))
    render(<App Screen={Screen} />)
    expect(screen.getByRole('status')).toHaveProperty('ariaBusy', 'true')
    expect(await screen.findByText('Invoice register')).toBeTruthy()
  })

  it('keeps the shell and offers a reload when the screen file cannot be fetched', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const Screen = screenFor(() => Promise.reject(new Error('Failed to fetch dynamically imported module')))
    render(<App Screen={Screen} />)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('This screen could not be loaded')
    // The surrounding application is still usable.
    expect(screen.getByText('Vertex ERP')).toBeTruthy()
    expect(screen.getByRole('button', { name: /reload page/i })).toBeTruthy()
    errors.mockRestore()
  })
})
