import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Plus, Search } from 'lucide-react'
import { cx } from '../lib/format'
import { buttonClasses } from './ui'

/* ---------------------------------------------------------------------------
 * The one way to choose a supplier, customer, product or material anywhere in
 * the app: click the box and the whole list drops down, type to narrow it,
 * pick with mouse or arrows + Enter. A "New …" button sits beside the box to
 * create one on the spot. The list floats over the form (on <body>), so it is
 * never clipped by a table or a scrolling dialog and never mixes with the
 * fields below it.
 * ------------------------------------------------------------------------- */

export interface PickOption<T> {
  id: string
  label: string
  /** Shown on the right of the row, e.g. "sheet · ₹42" or a phone number. */
  detail?: string
  /** Extra words that match a search (code, GSTIN, …) without being shown. */
  keywords?: string
  item: T
}

/** Lower-case, trimmed; tolerant of a blank name in old data. */
const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()

export function Picker<T>({
  noun,
  value,
  options,
  onPick,
  onText,
  onNew,
  newLabel = `New ${noun}`,
  placeholder,
  emptyHint,
  name,
  invalid,
  disabled,
  compact,
  'aria-label': ariaLabel,
}: {
  /** "supplier", "customer", "material", "product" — used in the button and messages. */
  noun: string
  /** The text in the box: the chosen name, or what was typed (free text). */
  value: string
  options: Array<PickOption<T>>
  onPick: (o: PickOption<T>) => void
  /** Free text: anything typed is kept (a supplier not in the list yet). Leave out to allow only list choices. */
  onText?: (text: string) => void
  /** Show the "New …" button; it receives what was typed so the new record can start with it. */
  onNew?: (typed: string) => void
  newLabel?: string
  placeholder?: string
  /** Shown in the list when there is nothing to choose yet. */
  emptyHint?: string
  name?: string
  invalid?: boolean
  disabled?: boolean
  /** Icon-only "New" button, for table cells. */
  compact?: boolean
  'aria-label'?: string
}) {
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  // Focus comes back to the box when the "New …" dialog closes; do not pop the list open then.
  const quietFocus = useRef(false)
  const [open, setOpen] = useState(false)
  // What is being typed for a search; null = showing the chosen value and the whole list.
  const [typing, setTyping] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const [place, setPlace] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number } | null>(null)

  const shown = typing ?? value ?? ''
  const term = (typing ?? '').trim().toLowerCase()
  const matches = useMemo(
    () => (term ? options.filter((o) => norm(`${o.label ?? ''} ${o.detail ?? ''} ${o.keywords ?? ''}`).includes(term)) : options).slice(0, 100),
    [options, term],
  )
  const chosen = norm(value)

  const place_ = useCallback(() => {
    const box = boxRef.current
    if (!box) return
    const r = box.getBoundingClientRect()
    const below = window.innerHeight - r.bottom - 8
    const above = r.top - 8
    const width = Math.max(r.width, 260)
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8))
    // Open upwards only when there is clearly more room above.
    if (below < 220 && above > below) setPlace({ left, width, bottom: window.innerHeight - r.top + 4, maxHeight: Math.min(320, above - 4) })
    else setPlace({ left, width, top: r.bottom + 4, maxHeight: Math.min(320, Math.max(140, below - 4)) })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    place_()
    const on = () => place_()
    window.addEventListener('resize', on)
    // Capture: any scrolling parent (a dialog body, a table) moves the box.
    window.addEventListener('scroll', on, true)
    return () => {
      window.removeEventListener('resize', on)
      window.removeEventListener('scroll', on, true)
    }
  }, [open, place_])

  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const openList = () => {
    if (disabled || open) return
    // Start on the chosen row, so the list opens where the user already is.
    const at = options.findIndex((o) => norm(o.label) === chosen)
    setActive(at >= 0 ? at : 0)
    setOpen(true)
  }
  const close = () => {
    setOpen(false)
    setTyping(null)
  }
  const pick = (o: PickOption<T>) => {
    onText?.(o.label)
    onPick(o)
    close()
  }
  const startNew = () => {
    const typed = (typing ?? (onText ? value : '') ?? '').trim()
    close()
    quietFocus.current = true
    onNew?.(typed)
  }

  return (
    <div className="flex min-w-0 items-stretch gap-2">
      <div ref={boxRef} className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden="true" />
        <input
          ref={inputRef}
          name={name}
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && matches[active] ? `${listId}-${active}` : undefined}
          aria-invalid={invalid || undefined}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          className="vx-input pl-9"
          value={shown}
          placeholder={placeholder}
          onFocus={() => {
            if (!quietFocus.current) openList()
          }}
          onClick={() => {
            quietFocus.current = false
            openList()
          }}
          onBlur={close}
          onChange={(e) => {
            const t = e.target.value
            quietFocus.current = false
            setTyping(t)
            setActive(0)
            setOpen(true)
            if (onText) {
              onText(t)
              // Typing a known name exactly counts as choosing it (fills its details).
              const hit = options.find((o) => norm(o.label) === norm(t))
              if (hit) onPick(hit)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              if (!open) return openList()
              setActive((i) => Math.min(i + 1, Math.max(0, matches.length - 1)))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Enter' && open) {
              // Only swallow Enter when a row is actually chosen; otherwise the form may submit.
              if (matches[active] && (typing !== null || !onText)) {
                e.preventDefault()
                pick(matches[active])
              } else close()
            } else if (e.key === 'Escape' && open) {
              e.stopPropagation()
              close()
            }
          }}
        />
        {open && place
          ? createPortal(
              <ul
                ref={listRef}
                id={listId}
                role="listbox"
                aria-label={`${noun[0].toUpperCase()}${noun.slice(1)}s`}
                className="vx-no-print vx-anim-pop fixed overflow-y-auto overscroll-contain rounded-md border border-rule-2 bg-surface py-1 text-sm"
                style={{ left: place.left, width: place.width, top: place.top, bottom: place.bottom, maxHeight: place.maxHeight, zIndex: 'calc(var(--z-modal) + 50)', boxShadow: 'var(--shadow-overlay)' }}
                // Keep focus in the box while clicking inside the list.
                onMouseDown={(e) => e.preventDefault()}
              >
                {matches.map((o, i) => {
                  const isChosen = !!chosen && norm(o.label) === chosen
                  return (
                    <li
                      key={o.id}
                      id={`${listId}-${i}`}
                      data-index={i}
                      role="option"
                      aria-selected={i === active}
                      className={cx('flex min-h-9 cursor-pointer items-center gap-2 px-3 py-1.5', i === active ? 'bg-accent-wash' : 'hover:bg-surface-2')}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => pick(o)}
                    >
                      <Check className={cx('h-3.5 w-3.5 shrink-0 text-accent-text', !isChosen && 'invisible')} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-ink">{o.label}</span>
                      {o.detail ? <span className="max-w-[45%] shrink-0 truncate text-xs text-muted">{o.detail}</span> : null}
                    </li>
                  )
                })}
                {!matches.length ? (
                  <li className="px-3 py-2 text-muted" role="presentation">
                    {term ? `No ${noun} matches “${typing?.trim()}”.` : (emptyHint ?? `No ${noun}s yet.`)}
                    {onNew ? ` Use “${newLabel}”.` : onText && term ? ' It is kept as typed.' : ''}
                  </li>
                ) : null}
              </ul>,
              document.body,
            )
          : null}
      </div>
      {onNew ? (
        <button
          type="button"
          disabled={disabled}
          aria-label={compact ? newLabel : undefined}
          title={compact ? newLabel : undefined}
          className={cx(buttonClasses('secondary', 'md'), 'h-auto min-h-9 shrink-0 gap-1.5', compact && 'w-9 px-0', 'disabled:pointer-events-none disabled:opacity-45')}
          // Do not steal focus first: a blur would close the list mid-click.
          onMouseDown={(e) => e.preventDefault()}
          onClick={startNew}
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
          {compact ? null : <span>{newLabel}</span>}
        </button>
      ) : null}
    </div>
  )
}
