import { GST_STATES, stateCodeFrom } from '../lib/gstStates'
import { Select } from './ui'

/**
 * A GST state / union territory with its code ("33 — Tamil Nadu"). The value
 * is the 2-digit code. A value stored earlier as text that cannot be matched
 * is still shown, marked, so nothing typed before is hidden.
 */
export function StateSelect({
  value,
  onChange,
  placeholder = 'Choose a state…',
  invalid,
  disabled,
  name,
  'aria-label': ariaLabel,
}: {
  value: string | null | undefined
  onChange: (code: string) => void
  placeholder?: string
  invalid?: boolean
  disabled?: boolean
  name?: string
  'aria-label'?: string
}) {
  const raw = (value ?? '').trim()
  const code = stateCodeFrom(raw)
  return (
    <Select name={name} aria-label={ariaLabel} aria-invalid={invalid || undefined} disabled={disabled} value={code ?? (raw ? '__unknown' : '')} onChange={(e) => onChange(e.target.value === '__unknown' ? raw : e.target.value)}>
      <option value="">{placeholder}</option>
      {raw && !code ? <option value="__unknown">“{raw}” — not recognised, choose a state</option> : null}
      {GST_STATES.map((s) => (
        <option key={s.code} value={s.code}>
          {s.code} — {s.name}
        </option>
      ))}
    </Select>
  )
}
