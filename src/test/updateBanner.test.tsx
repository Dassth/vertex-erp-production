// @vitest-environment jsdom
/* An open window notices that a newer version was installed and asks to reload. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../lib/build', () => ({ APP_BUILD: '2026.09.26.1200' }))
const { UpdateBanner } = await import('../components/UpdateBanner')

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const health = (version: string) => vi.fn(async () => new Response(JSON.stringify({ ok: true, version }), { status: 200 }))

describe('update banner', () => {
  it('asks to reload when the installed version is newer than this window', async () => {
    vi.stubGlobal('fetch', health('vertex-erp@2026.09.26.1405'))
    render(<UpdateBanner />)
    expect(await screen.findByText(/updated to version 2026\.09\.26\.1405/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reload now' })).toBeTruthy()
  })

  it('stays hidden when the window already runs the installed version', async () => {
    const f = health('vertex-erp@2026.09.26.1200')
    vi.stubGlobal('fetch', f)
    render(<UpdateBanner />)
    await vi.waitFor(() => expect(f).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'Reload now' })).toBeNull()
  })
})
