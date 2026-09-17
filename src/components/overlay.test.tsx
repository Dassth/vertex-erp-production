/** @vitest-environment jsdom */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { ConfirmDialog, Drawer } from './ui'

/* jsdom has no layout, so every element reports zero client rects and would count as hidden to
   the overlay's "visible focusable" filter. Report one rect, as a laid-out page would. */
const originalRects = HTMLElement.prototype.getClientRects
beforeAll(() => {
  HTMLElement.prototype.getClientRects = function () {
    return [{ x: 0, y: 0, width: 10, height: 10 }] as unknown as DOMRectList
  }
})
afterAll(() => {
  HTMLElement.prototype.getClientRects = originalRects
})
afterEach(cleanup)

/* Content that grabs focus itself, like the material and job editors. React applies autoFocus
   during commit, before the overlay's effect runs — the case that used to lose the opener. */
function Editor({ onDirty }: { onDirty: () => void }) {
  return (
    <label>
      Price
      {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
      <input autoFocus onChange={onDirty} />
    </label>
  )
}

function Page() {
  const [open, setOpen] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const requestClose = () => (dirty ? setConfirm(true) : setOpen(false))
  return (
    <>
      <button type="button">Before</button>
      <button type="button" onClick={() => setOpen(true)}>
        Configure
      </button>
      <Drawer open={open} onClose={requestClose} title="Art board">
        <Editor onDirty={() => setDirty(true)} />
      </Drawer>
      <ConfirmDialog
        open={confirm}
        title="Close without saving?"
        body="Unsaved changes will be lost."
        confirmLabel="Discard changes"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false)
          setDirty(false)
          setOpen(false)
        }}
      />
    </>
  )
}

describe('overlay focus management', () => {
  it('returns focus to the opener when the content autofocuses a field', async () => {
    const user = userEvent.setup()
    render(<Page />)
    const opener = screen.getByRole('button', { name: 'Configure' })
    await user.click(opener)
    expect(screen.getByRole('dialog', { name: 'Art board' })).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Price' }))
    expect(document.body.style.overflow).toBe('hidden')

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
    expect(document.body.style.overflow).toBe('')
  })

  it('handles a confirm nested over a drawer: Escape closes only the top, discard returns to the page', async () => {
    const user = userEvent.setup()
    render(<Page />)
    const opener = screen.getByRole('button', { name: 'Configure' })
    await user.click(opener)
    const price = screen.getByRole('textbox', { name: 'Price' })
    await user.type(price, '12')

    await user.keyboard('{Escape}')
    expect(screen.getAllByRole('dialog')).toHaveLength(2)
    const confirm = screen.getByRole('dialog', { name: 'Close without saving?' })
    expect(confirm.contains(document.activeElement)).toBe(true)

    // Tab stays inside the top overlay.
    for (let i = 0; i < 6; i++) {
      await user.tab()
      expect(confirm.contains(document.activeElement)).toBe(true)
    }

    await user.keyboard('{Escape}')
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(document.activeElement).toBe(price)
    expect((price as HTMLInputElement).value).toBe('12')
    expect(document.body.style.overflow).toBe('hidden')

    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
    expect(document.body.style.overflow).toBe('')
  })
})
