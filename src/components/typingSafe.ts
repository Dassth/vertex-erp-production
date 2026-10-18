import { useLayoutEffect, useRef, useState } from 'react'
import type { ChangeEvent, FocusEvent, Ref } from 'react'

/* ---------------------------------------------------------------------------
 * Text that is being typed is never overwritten from outside.
 *
 * Forms are redrawn while someone types — draft autosave, a server copy being
 * brought back, other computers' changes arriving every few seconds, Edge's
 * text suggestions. A plain controlled input then takes whatever value arrives,
 * and fast typing loses characters ("magnet" → "agnet").
 *
 * Here the field keeps its own text:
 *   • its own changes reach the form at once, and the form's answer to them
 *     (e.g. GSTIN upper-cased, or a refused character) is shown at once;
 *   • a value arriving from elsewhere is shown only while the field is NOT
 *     focused; while it is, the typed text stays, and on leaving the field
 *     the typed text is sent to the form again so the two agree.
 * ------------------------------------------------------------------------- */

type El = HTMLInputElement | HTMLTextAreaElement

const PLAIN = new Set(['checkbox', 'radio', 'file', 'range', 'color'])

interface SafeProps<E extends El> {
  value?: unknown
  type?: string
  onChange?: (e: ChangeEvent<E>) => void
  onFocus?: (e: FocusEvent<E>) => void
  onBlur?: (e: FocusEvent<E>) => void
  ref?: Ref<E>
}

/** The same props, with value / change / focus / blur / ref taken over for a controlled text field. */
export function useTypingSafe<E extends El, P extends SafeProps<E>>(props: P): P {
  const controlled = props.value !== undefined && props.value !== null && !PLAIN.has(props.type ?? '')
  const outside = controlled ? String(props.value) : ''
  const [text, setText] = useState(outside)
  const node = useRef<E | null>(null)
  const focused = useRef(false)
  // Set by this field's own change until the form has answered it in the next render.
  const answering = useRef(false)

  useLayoutEffect(() => {
    if (!controlled) return
    if (answering.current) {
      // The form's answer to our own keystroke — possibly changed (upper-cased) or refused.
      answering.current = false
      if (outside !== text) setText(outside)
      return
    }
    // Someone else changed it: show it now unless the field is being typed in.
    if (!focused.current && outside !== text) setText(outside)
  })

  if (!controlled) return props

  const setRef = (el: E | null) => {
    node.current = el
    const r = props.ref
    if (typeof r === 'function') r(el)
    else if (r && typeof r === 'object') (r as { current: E | null }).current = el
  }

  return {
    ...props,
    ref: setRef as Ref<E>,
    value: text,
    onFocus: (e: FocusEvent<E>) => {
      focused.current = true
      props.onFocus?.(e)
    },
    onChange: (e: ChangeEvent<E>) => {
      answering.current = true
      setText(e.target.value)
      props.onChange?.(e)
    },
    onBlur: (e: FocusEvent<E>) => {
      focused.current = false
      // A value that arrived while typing was held back: the typed text wins, and the form gets it.
      if (outside !== text && props.onChange && node.current) {
        answering.current = true
        props.onChange({ ...e, target: node.current, currentTarget: node.current } as unknown as ChangeEvent<E>)
      }
      props.onBlur?.(e)
    },
  } as P
}
