// @vitest-environment jsdom
/* Product editor drafts through the real UI. Passwords are disposable test values. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import App from '../App'
import { StoreProvider } from '../store/store'
import { DB_KEY } from '../lib/db'
import { DRAFT_PREFIX } from '../lib/drafts'
import type { VertexDB } from '../lib/types'
import { seedMaster } from './fixtures'

const TEST_PASSWORD = 'disposable-test-pass-1'

function mount(path: string) {
  const router = createMemoryRouter([{ path: '*', element: (<StoreProvider><App /></StoreProvider>) }], { initialEntries: [path] })
  const view = render(<RouterProvider router={router} />)
  return { router, view }
}

const stored = (): VertexDB => JSON.parse(localStorage.getItem(DB_KEY)!)
const draftKeys = () => Object.keys(localStorage).filter((k) => k.startsWith(DRAFT_PREFIX))

async function signIn() {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('radio', { name: /Administrator 1/ }))
  await user.type(screen.getByLabelText(/New password/), TEST_PASSWORD)
  await user.type(screen.getByLabelText(/Confirm password/), TEST_PASSWORD)
  await user.click(screen.getByRole('button', { name: /Create password & sign in/ }))
  await screen.findByRole('heading', { name: 'Production' }, { timeout: 5000 })
  return user
}

beforeEach(() => {
  Element.prototype.scrollIntoView = () => {}
  localStorage.clear()
  sessionStorage.clear()
  localStorage.setItem(DB_KEY, JSON.stringify(seedMaster().db))
})
afterEach(() => cleanup())

describe('product editor drafts', () => {
  it('restores a new product after a refresh, keeps it through a failed save, and saves an incomplete draft once', async () => {
    const first = mount('/login')
    const user = await signIn()
    await first.router.navigate('/master/products/new')
    await screen.findByRole('heading', { name: 'New product' }, { timeout: 5000 })
    await waitFor(() => expect(first.router.state.location.search).toMatch(/draft=/))
    const url = `${first.router.state.location.pathname}${first.router.state.location.search}`

    await user.type(screen.getByLabelText(/Product name/), 'Draft jewel box')
    await user.click(screen.getByRole('button', { name: /Generate 3 stage sections/ }))
    const stageNames = screen.getAllByPlaceholderText('e.g. Printing…')
    await user.type(stageNames[0], 'Printing')
    // Autosave writes a recovery copy.
    await waitFor(() => expect(draftKeys()).toHaveLength(1), { timeout: 3000 })
    await screen.findByText(/Draft copy saved in this browser/)

    // "Refresh": unmount and open the same URL again — the entries come back.
    first.view.unmount()
    mount(url)
    expect(await screen.findByText(/Restored your unsaved entries/, {}, { timeout: 5000 })).toBeTruthy()
    expect((screen.getByLabelText(/Product name/) as HTMLInputElement).value).toBe('Draft jewel box')
    expect((screen.getAllByPlaceholderText('e.g. Printing…')[0] as HTMLInputElement).value).toBe('Printing')

    // A failed save (stages 2 and 3 have no names) keeps everything, including the recovery copy.
    await user.click(screen.getByRole('button', { name: /Save draft|Create product/ }))
    expect(await screen.findByText('Product not saved')).toBeTruthy()
    expect(draftKeys()).toHaveLength(1)
    expect(stored().products.some((p) => p.name === 'Draft jewel box')).toBe(false)

    // Complete only the required names — process rates and times stay blank.
    const names = screen.getAllByPlaceholderText('e.g. Printing…')
    await user.type(names[1], 'Box making')
    await user.type(names[2], 'Packing')
    const processNames = screen.getAllByLabelText(/Process name/)
    for (const [i, input] of processNames.entries()) await user.type(input, `Step ${i + 1}`)

    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    expect((await screen.findAllByText('Saved as draft — costing details need attention', {}, { timeout: 5000 })).length).toBeGreaterThanOrEqual(2)
    await waitFor(() => expect(stored().products.filter((p) => p.name === 'Draft jewel box')).toHaveLength(1))
    const saved = stored().products.find((p) => p.name === 'Draft jewel box')!
    expect(saved.stages[0].processes[0]).toMatchObject({ rate: null, setupCharge: null, setupHours: null, runHoursPer1000: null })
    // The recovery copy is removed once the save call has returned.
    await waitFor(() => expect(draftKeys()).toHaveLength(0), { timeout: 5000 })

    // Saving again updates the same product (once the editor has switched to the saved record).
    await screen.findByRole('heading', { name: 'Draft jewel box' }, { timeout: 5000 })
    await user.type(screen.getByLabelText(/Category/), 'Jewellery box')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(stored().products.find((p) => p.id === saved.id)!.category).toBe('Jewellery box'))
    expect(stored().products.filter((p) => p.name === 'Draft jewel box')).toHaveLength(1)
  }, 60000)

  it('keeps separate recovery copies for two new products and discards only after confirmation', async () => {
    const first = mount('/login')
    const user = await signIn()
    await first.router.navigate('/master/products/new?draft=alpha')
    await user.type(await screen.findByLabelText(/Product name/, {}, { timeout: 5000 }), 'Alpha box')
    await waitFor(() => expect(draftKeys().some((k) => k.endsWith('new:alpha'))).toBe(true), { timeout: 3000 })

    await first.router.navigate('/master/products/new?draft=beta')
    // Leaving with unsaved edits asks first; stay on the new route by confirming the leave.
    const leave = await screen.findByRole('dialog', {}, { timeout: 3000 }).catch(() => null)
    if (leave) await user.click(within(leave).getByRole('button', { name: /Discard changes|Leave/ }))
    await user.type(await screen.findByLabelText(/Product name/, {}, { timeout: 5000 }), 'Beta box')
    await waitFor(() => expect(draftKeys()).toHaveLength(2), { timeout: 3000 })

    await first.router.navigate('/master/products/new?draft=alpha')
    const leave2 = await screen.findByRole('dialog', {}, { timeout: 3000 }).catch(() => null)
    if (leave2) await user.click(within(leave2).getByRole('button', { name: /Discard changes|Leave/ }))
    await waitFor(() => expect((screen.getByLabelText(/Product name/) as HTMLInputElement).value).toBe('Alpha box'), { timeout: 5000 })

    await user.click(screen.getAllByRole('button', { name: /Discard (unsaved )?draft…/ })[0])
    const confirm = await screen.findByRole('dialog', { name: /Discard the unsaved draft/ })
    await user.click(within(confirm).getByRole('button', { name: 'Discard draft' }))
    await waitFor(() => expect(draftKeys()).toHaveLength(1))
    expect(draftKeys()[0]).toMatch(/new:beta$/)
  }, 60000)
})
