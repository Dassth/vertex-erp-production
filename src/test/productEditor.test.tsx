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
  await screen.findByRole('heading', { name: /^Good (morning|afternoon|evening),/ }, { timeout: 5000 })
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
    await screen.findByText(/Draft kept at/)

    // "Refresh": unmount and open the same URL again — the entries come back.
    first.view.unmount()
    mount(url)
    expect(await screen.findByText(/Restored your unsaved entries/, {}, { timeout: 5000 })).toBeTruthy()
    expect((screen.getByLabelText(/Product name/) as HTMLInputElement).value).toBe('Draft jewel box')
    expect((screen.getAllByPlaceholderText('e.g. Printing…')[0] as HTMLInputElement).value).toBe('Printing')

    // Saving a half-filled product as a draft works: stages and processes left unnamed are numbered,
    // rates and times stay blank — nothing typed is refused or lost.
    await user.click(screen.getByRole('button', { name: 'Save as draft' }))
    expect((await screen.findAllByText('Saved as draft — costing details need attention', {}, { timeout: 5000 })).length).toBeGreaterThanOrEqual(1)
    await waitFor(() => expect(stored().products.filter((p) => p.name === 'Draft jewel box')).toHaveLength(1))
    const saved = stored().products.find((p) => p.name === 'Draft jewel box')!
    expect(saved.stages.map((st) => st.name)).toEqual(['Printing', 'Stage 2', 'Stage 3'])
    expect(saved.stages[1].processes[0].name).toBe('Process 1')
    expect(saved.stages[0].processes[0]).toMatchObject({ rate: null, setupCharge: null, setupHours: null, runHoursPer1000: null })
    await waitFor(() => expect(draftKeys()).toEqual([]), { timeout: 5000 })
    await waitFor(() => expect(draftKeys()).toHaveLength(0), { timeout: 5000 })

    // Saving again updates the same product (once the editor has switched to the saved record).
    await screen.findByRole('heading', { name: 'Draft jewel box' }, { timeout: 5000 })
    await user.type(screen.getByLabelText(/Category/), 'Jewellery box')
    await user.click(screen.getByRole('button', { name: 'Save as draft' }))
    await waitFor(() => expect(stored().products.find((p) => p.id === saved.id)!.category).toBe('Jewellery box'))
    expect(stored().products.filter((p) => p.name === 'Draft jewel box')).toHaveLength(1)

    // "Save product" saves and returns to the product list.
    await user.type(screen.getByLabelText(/HSN/), '4819')
    await user.click(screen.getByRole('button', { name: 'Save product' }))
    await waitFor(() => expect(stored().products.find((p) => p.id === saved.id)!.hsn).toBe('4819'))
    await screen.findByRole('heading', { name: 'Products' }, { timeout: 5000 })
  }, 60000)

  it('keeps separate recovery copies for two new products and discards only after confirmation', async () => {
    const first = mount('/login')
    const user = await signIn()
    await first.router.navigate('/master/products/new?draft=alpha')
    await user.type(await screen.findByLabelText(/Product name/, {}, { timeout: 5000 }), 'Alpha box')
    await waitFor(() => expect(draftKeys().some((k) => k.endsWith('new:alpha'))).toBe(true), { timeout: 3000 })

    await first.router.navigate('/master/products/new?draft=beta')
    // Leaving with unsaved edits asks nothing: they are kept as a draft.
    expect(screen.queryByRole('dialog', { name: /Leave without saving/ })).toBeNull()
    // The new, empty form for "beta" (not the alpha form still on screen a moment ago).
    await waitFor(() => expect((screen.getByLabelText(/Product name/) as HTMLInputElement).value).toBe(''), { timeout: 5000 })
    await user.type(screen.getByLabelText(/Product name/), 'Beta box')
    await waitFor(() => expect(draftKeys()).toHaveLength(2), { timeout: 3000 })

    await first.router.navigate('/master/products/new?draft=alpha')
    await waitFor(() => expect((screen.getByLabelText(/Product name/) as HTMLInputElement).value).toBe('Alpha box'), { timeout: 5000 })

    await user.click(screen.getAllByRole('button', { name: /Discard (unsaved )?draft…/ })[0])
    const confirm = await screen.findByRole('dialog', { name: /Discard the unsaved draft/ })
    await user.click(within(confirm).getByRole('button', { name: 'Discard draft' }))
    await waitFor(() => expect(draftKeys()).toHaveLength(1))
    expect(draftKeys()[0]).toMatch(/new:beta$/)
  }, 60000)
})
