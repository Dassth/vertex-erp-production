// @vitest-environment jsdom
/* Company profile editing through the real UI. Passwords are disposable test values. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import App from '../App'
import { StoreProvider } from '../store/store'
import { DB_KEY } from '../lib/db'
import { buildEmptyDB } from '../lib/defaults'
import type { VertexDB } from '../lib/types'

const TEST_PASSWORD = 'disposable-test-pass-1'
const OWNER_NOTICE = 'Administrator 1 must complete the company profile before invoices can be issued.'

function mount(path = '/login') {
  const router = createMemoryRouter([{ path: '*', element: (<StoreProvider><App /></StoreProvider>) }], { initialEntries: [path] })
  const view = render(<RouterProvider router={router} />)
  return { router, view }
}

const stored = (): VertexDB => JSON.parse(localStorage.getItem(DB_KEY)!)

async function signInFirstTime(name: string) {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('radio', { name: new RegExp(name) }))
  await user.type(screen.getByLabelText(/New password/), TEST_PASSWORD)
  await user.type(screen.getByLabelText(/Confirm password/), TEST_PASSWORD)
  await user.click(screen.getByRole('button', { name: /Create password & sign in/ }))
  return user
}

async function openCompanyProfile(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Account — Administrator 1' }))
  await user.click(await screen.findByRole('button', { name: 'Company profile…' }))
  return screen.findByRole('dialog', { name: 'Company profile' })
}

beforeEach(() => {
  // jsdom has no layout; focusFirstInvalid scrolls the field into view.
  Element.prototype.scrollIntoView = () => {}
  localStorage.clear()
  sessionStorage.clear()
  const db = buildEmptyDB()
  db.company = { ...db.company, address: '', gstin: '' }
  localStorage.setItem(DB_KEY, JSON.stringify(db))
})
afterEach(() => cleanup())

describe('company profile', () => {
  it('Administrator 1 edits, sees inline errors, saves, reloads and edits again', async () => {
    const first = mount()
    const user = await signInFirstTime('Administrator 1')
    await screen.findByRole('heading', { name: /^Good (morning|afternoon|evening),/ }, { timeout: 5000 })

    // Dispatch reports the incomplete profile.
    await first.router.navigate('/dispatch')
    expect(await screen.findByText(/Invoices cannot be issued yet/, {}, { timeout: 5000 })).toBeTruthy()

    let dialog = await openCompanyProfile(user)
    const name = within(dialog).getByLabelText(/Company name/) as HTMLInputElement
    expect(name.value).toBe(stored().company.name)

    const gstin = within(dialog).getByLabelText(/GSTIN/) as HTMLInputElement
    await user.type(within(dialog).getByLabelText(/Address/), '42 Demo Estate')
    await user.type(gstin, '1234567890')
    await user.click(within(dialog).getByRole('button', { name: 'Save company details' }))

    // Rejected beside the field, value kept, focus moved there, nothing stored.
    expect(await within(dialog).findByText(/You entered 10 characters/)).toBeTruthy()
    expect(gstin.value).toBe('1234567890')
    await waitFor(() => expect(document.activeElement).toBe(gstin))
    expect(stored().company.gstin).toBe('')

    await user.clear(gstin)
    await user.type(gstin, '33aaacv1234c1zw')
    await user.click(within(dialog).getByRole('button', { name: 'Save company details' }))
    expect(await screen.findByText('Company details saved')).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Company profile' })).toBeNull())
    expect(stored().company).toMatchObject({ address: '42 Demo Estate', gstin: '33AAACV1234C1ZW' })

    // Dispatch readiness updates immediately.
    await waitFor(() => expect(screen.queryByText(/Invoices cannot be issued yet/)).toBeNull())

    // Reload: the saved values come back and can be edited again.
    first.view.unmount()
    mount('/dispatch')
    dialog = await openCompanyProfile(user)
    expect((within(dialog).getByLabelText(/GSTIN/) as HTMLInputElement).value).toBe('33AAACV1234C1ZW')
    const phone = within(dialog).getByLabelText(/Phone/)
    await user.type(phone, '0422 000000')
    await user.click(within(dialog).getByRole('button', { name: 'Save company details' }))
    await waitFor(() => expect(stored().company.phone).toBe('0422 000000'))
    expect(stored().company.address).toBe('42 Demo Estate')
  }, 30000)

  it('Administrator 2 gets a notice on Dispatch and no way to open the editor', async () => {
    const { router } = mount()
    const user = await signInFirstTime('Administrator 2')
    await screen.findByRole('heading', { name: /^Good (morning|afternoon|evening),/ }, { timeout: 5000 })
    await router.navigate('/dispatch')

    expect(await screen.findByText(OWNER_NOTICE)).toBeTruthy()
    expect(screen.queryByText(/Invoices cannot be issued yet/)).toBeNull()
    expect(screen.queryByRole('button', { name: /company profile/i })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Account — Administrator 2' }))
    expect(await screen.findByRole('button', { name: 'Sign out' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /company profile/i })).toBeNull()
    expect(screen.queryByRole('dialog', { name: 'Company profile' })).toBeNull()
  }, 30000)
})
