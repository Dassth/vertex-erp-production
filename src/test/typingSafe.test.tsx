// @vitest-environment jsdom
/* Fast typing and paste keep every character, even while the form is redrawn with an older value. */
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useRef, useState } from 'react'
import { Input, Textarea } from '../components/ui'
import { NumberInput } from '../components/page'

afterEach(() => cleanup())

/** A form whose saved copy keeps arriving while someone types (autosave, server refresh). */
function Form({ kind }: { kind: 'input' | 'textarea' | 'upper' }) {
  const [value, setValue] = useState('')
  const [fighting, setFighting] = useState(true)
  const stale = useRef('')
  useEffect(() => {
    if (!fighting) return
    // Every few milliseconds an older copy of the form is written back — what dropped letters before.
    const t = setInterval(() => setValue(stale.current), 3)
    const s = setInterval(() => (stale.current = value), 25)
    return () => {
      clearInterval(t)
      clearInterval(s)
    }
  })
  const props = { 'aria-label': 'Field', value, onChange: (e: { target: { value: string } }) => setValue(kind === 'upper' ? e.target.value.toUpperCase() : e.target.value) }
  return (
    <>
      {kind === 'textarea' ? <Textarea {...props} /> : <Input {...props} />}
      <output data-testid="saved">{value}</output>
      <button type="button" onClick={() => setFighting(false)}>
        elsewhere
      </button>
    </>
  )
}

describe('typing in a field that is redrawn underneath', () => {
  for (const kind of ['input', 'textarea'] as const) {
    it(`keeps every typed and pasted character (${kind})`, async () => {
      const user = userEvent.setup({ delay: 1 })
      render(<Form kind={kind} />)
      const field = screen.getByLabelText('Field') as HTMLInputElement
      await user.click(field)
      await user.type(field, 'Rigid magnet box with ribbon wrap')
      await user.paste(' — 2 magnets, 1.5 mm board')
      expect(field.value).toBe('Rigid magnet box with ribbon wrap — 2 magnets, 1.5 mm board')
      // Leaving the field: the typed text is sent to the form again, so the form holds exactly it.
      await user.click(screen.getByRole('button', { name: 'elsewhere' }))
      await act(() => new Promise((r) => setTimeout(r, 30)))
      expect(screen.getByTestId('saved').textContent).toBe('Rigid magnet box with ribbon wrap — 2 magnets, 1.5 mm board')
      expect(field.value).toBe('Rigid magnet box with ribbon wrap — 2 magnets, 1.5 mm board')
    })
  }

  it('still shows the form’s own answer at once (GSTIN upper-cased)', async () => {
    const user = userEvent.setup()
    render(<Form kind="upper" />)
    const field = screen.getByLabelText('Field') as HTMLInputElement
    await user.click(field)
    await user.type(field, '33aaaaa0000a1z5')
    expect(field.value).toBe('33AAAAA0000A1Z5')
  })

  it('shows a value changed elsewhere while the field is not being typed in', async () => {
    function Outside() {
      const [v, setV] = useState('old')
      return (
        <>
          <Input aria-label="Field" value={v} onChange={(e) => setV(e.target.value)} />
          <button type="button" onClick={() => setV('new value')}>
            load
          </button>
        </>
      )
    }
    const user = userEvent.setup()
    render(<Outside />)
    await user.click(screen.getByRole('button', { name: 'load' }))
    expect((screen.getByLabelText('Field') as HTMLInputElement).value).toBe('new value')
  })

  it('keeps a number being typed', async () => {
    function Num() {
      const [v, setV] = useState<number | null>(null)
      useEffect(() => {
        const t = setInterval(() => setV(null), 3)
        return () => clearInterval(t)
      }, [])
      return <NumberInput aria-label="Rate" value={v} onChange={setV} />
    }
    const user = userEvent.setup({ delay: 1 })
    render(<Num />)
    const field = screen.getByLabelText('Rate') as HTMLInputElement
    await user.click(field)
    await user.type(field, '1234.56')
    expect(field.value).toBe('1234.56')
  })
})
