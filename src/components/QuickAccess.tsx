import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CornerDownLeft, Search, Sparkles } from 'lucide-react'
import { useStore } from '../store/store'
import { cx } from '../lib/format'
import { places, rank, records, suggestions } from '../lib/quickAccess'
import type { ScoredTarget } from '../lib/quickAccess'
import type { Capability } from '../lib/permissions'
import { Modal } from './ui'

/* ---------------------------------------------------------------------------
 * "Type here to quick access": one box that reaches every screen, action and
 * record the account may open. It ranks what you type (see lib/quickAccess),
 * remembers what you pick on this computer, and suggests what needs attention
 * when the box is empty.
 * ------------------------------------------------------------------------- */

const USAGE_KEY = 'vx.quickAccess.usage'

function readUsage(): Record<string, number> {
  try {
    const raw = localStorage.getItem(USAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {}
  } catch {
    return {}
  }
}

function remember(id: string, usage: Record<string, number>): Record<string, number> {
  const next = { ...usage, [id]: (usage[id] ?? 0) + 1 }
  try {
    localStorage.setItem(USAGE_KEY, JSON.stringify(next))
  } catch {
    /* storage blocked — ranking simply does not learn on this computer */
  }
  return next
}

export function QuickAccessPanel({ variant, onDone }: { variant: 'page' | 'dialog'; onDone?: () => void }) {
  const { db, can } = useStore()
  const navigate = useNavigate()
  const listId = useId()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState(variant === 'dialog')
  const [usage, setUsage] = useState<Record<string, number>>(readUsage)
  const input = useRef<HTMLInputElement>(null)
  const box = useRef<HTMLDivElement>(null)

  const allowed = useMemo(() => {
    const permitted = (need?: Capability) => (!need ? true : can(need))
    return [...places(), ...records(db)].filter((t) => permitted(t.need))
  }, [db, can])

  // Today's real needs, so an empty box still helps.
  const hints = useMemo(() => suggestions(db, allowed, { usage }), [db, allowed, usage])
  const matches: ScoredTarget[] = useMemo(() => (query.trim() ? rank(allowed, query, { usage, limit: 8 }) : []), [allowed, query, usage])
  // A half-typed sentence ("I need to…") still shows today's work rather than a dead end.
  const showingHints = matches.length === 0
  const results: ScoredTarget[] = showingHints ? hints : matches

  useEffect(() => {
    if (variant === 'dialog') input.current?.focus()
  }, [variant])
  useEffect(() => {
    if (variant !== 'page') return
    const onClick = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [variant])

  const go = (target: ScoredTarget | undefined) => {
    if (!target) return
    setUsage((u) => remember(target.id, u))
    setQuery('')
    setOpen(false)
    onDone?.()
    navigate(target.to)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (results.length ? (e.key === 'ArrowDown' ? (i + 1) % results.length : (i - 1 + results.length) % results.length) : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      go(results[active])
    } else if (e.key === 'Escape') {
      if (query) setQuery('')
      else {
        setOpen(false)
        onDone?.()
      }
    }
  }

  const list = (
    <ul id={listId} role="listbox" aria-label="Quick access results" className={cx('max-h-80 overflow-y-auto overscroll-contain py-1', variant === 'page' && 'rounded-b-lg')}>
      {results.length === 0 ? (
        <li className="px-4 py-6 text-center text-sm text-muted">
          Nothing matches “{query.trim()}”. Try “purchase bill”, “GST report”, a customer name or an order ID.
        </li>
      ) : (
        results.map((r, i) => (
          <li key={r.id}>
            <button
              type="button"
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(r)}
              className={cx('flex w-full items-center gap-3 px-4 py-2.5 text-left', i === active ? 'bg-accent-wash' : 'hover:bg-surface-2')}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-medium text-ink">{r.title}</span>
                <span className="block truncate text-xs text-muted">{r.hint}</span>
              </span>
              {r.reason ? <span className="hidden shrink-0 text-2xs text-faint sm:block">{r.reason}</span> : <span className="shrink-0 text-2xs text-faint">{r.group}</span>}
              {i === active ? <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden="true" /> : null}
            </button>
          </li>
        ))
      )}
    </ul>
  )

  const field = (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden="true" />
      <input
        ref={input}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="Quick access"
        autoComplete="off"
        spellCheck={false}
        placeholder="Type here to quick access — “make a purchase bill”, “GST report”, a customer or order…"
        className="vx-input h-12 pl-10 pr-4 text-base"
      />
    </div>
  )

  if (variant === 'dialog')
    return (
      <div className="-mx-5 -my-5">
        <div className="border-b border-rule p-3">{field}</div>
        {showingHints ? (
          <p className="flex items-center gap-2 border-b border-rule px-4 py-2 text-2xs text-muted">
            <Sparkles className="h-3.5 w-3.5 text-faint" aria-hidden="true" />
            {query.trim() ? 'Keep typing — meanwhile, what needs you now' : 'Suggested for you right now'}
          </p>
        ) : null}
        {list}
      </div>
    )

  return (
    <div ref={box} className="relative">
      {field}
      {open ? (
        <div className="vx-anim-pop absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-rule-2 bg-surface" style={{ boxShadow: 'var(--shadow-pop)' }}>
          {showingHints ? (
            <p className="flex items-center gap-2 border-b border-rule px-4 py-2 text-2xs text-muted">
              <Sparkles className="h-3.5 w-3.5 text-faint" aria-hidden="true" />
              {query.trim() ? 'Keep typing — meanwhile, what needs you now' : 'Suggested for you right now'}
            </p>
          ) : null}
          {list}
        </div>
      ) : null}
    </div>
  )
}

/** The box itself, for the top of a page. */
export function QuickAccessBar() {
  return <QuickAccessPanel variant="page" />
}

/** The same box in a dialog, opened from the top bar or with Ctrl/⌘ + K. */
export function QuickAccessDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} size="md" title="Quick access" subtitle="Type what you want to do">
      {open ? <QuickAccessPanel variant="dialog" onDone={onClose} /> : null}
    </Modal>
  )
}
