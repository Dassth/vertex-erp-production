import { useEffect, useRef, useState } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { Link, NavLink, useBlocker } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Info } from 'lucide-react'
import type { CostingIssue } from '../lib/types'
import { cx } from '../lib/format'
import { ConfirmDialog, buttonClasses } from './ui'

/* ------------------------------ Document title ---------------------------- */

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Vertex ERP`
  }, [title])
}

/* ------------------------------- Page header ------------------------------ */

export function PageHeader({
  eyebrow = 'Module',
  title,
  subtitle,
  icon,
  actions,
}: {
  eyebrow?: string
  title: string
  subtitle: ReactNode
  icon: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="vx-anim-up flex flex-wrap items-end justify-between gap-5 pb-6">
      <div className="min-w-0">
        <span className="vx-eyebrow flex items-center gap-2">
          <span className="text-faint" aria-hidden="true">
            {icon}
          </span>
          {eyebrow}
        </span>
        <h1 className="mt-2 font-display text-xl font-semibold leading-tight tracking-headline text-ink">{title}</h1>
        <p className="mt-2 max-w-[68ch] text-base leading-relaxed text-muted">{subtitle}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

/* -------------------------------- Stat tiles ------------------------------ */

export function StatTile({
  label,
  value,
  icon,
  tone,
  hint,
  onClick,
  active,
  span,
}: {
  label: string
  value: string
  icon: ReactNode
  tone: 'indigo' | 'green' | 'amber' | 'red' | 'blue' | 'violet' | 'slate'
  hint?: string
  onClick?: () => void
  active?: boolean
  span?: boolean
}) {
  const dots: Record<string, string> = {
    indigo: 'bg-accent',
    green: 'bg-ok',
    amber: 'bg-warn',
    red: 'bg-risk',
    blue: 'bg-live',
    violet: 'bg-chart-6',
    slate: 'bg-faint',
  }
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      aria-pressed={onClick ? !!active : undefined}
      className={cx(
        'vx-tile relative flex min-w-0 flex-col gap-2 px-4 py-3 text-left',
        span && 'sm:col-span-2',
        onClick && 'vx-tile-interactive vx-press vx-focus',
        active && '!border-accent-edge !bg-accent-wash',
      )}
    >
      <span className="flex items-center gap-2">
        <span className={cx('h-2 w-2 shrink-0 rounded-full', dots[tone])} aria-hidden="true" />
        <span className="vx-mono-label !mb-0 truncate leading-tight">{label}</span>
        <span className="ml-auto shrink-0 text-faint" aria-hidden="true">
          {icon}
        </span>
      </span>
      <span className="vx-code block truncate font-display text-2xl font-semibold leading-none tracking-[-0.02em] text-ink">
        {value}
      </span>
      {hint ? <span className="block truncate text-xs leading-snug text-muted">{hint}</span> : null}
      {active ? <span className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" aria-hidden="true" /> : null}
    </Tag>
  )
}

export function StatStrip({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('vx-anim-up grid gap-3', className ?? 'sm:grid-cols-2 xl:grid-cols-4')}>{children}</div>
}

/* -------------------------------- Issue list ------------------------------ */

export function IssueList({
  issues,
  className,
  title,
}: {
  issues: CostingIssue[]
  className?: string
  title?: string
}) {
  if (!issues.length) return null
  const errors = issues.filter((i) => i.level === 'error')
  const warnings = issues.filter((i) => i.level === 'warning')
  return (
    <div className={cx('space-y-3', className)} role="status" aria-live="polite">
      {[
        { list: errors, tone: 'risk', label: title ?? `${errors.length} item${errors.length === 1 ? '' : 's'} must be fixed` },
        { list: warnings, tone: 'warn', label: `${warnings.length} warning${warnings.length === 1 ? '' : 's'}` },
      ]
        .filter((g) => g.list.length)
        .map((g) => (
          <div
            key={g.tone}
            className={cx(
              'rounded-md px-3.5 py-3 ring-1 ring-inset',
              g.tone === 'risk' ? 'bg-risk-wash ring-risk-edge' : 'bg-warn-wash ring-warn-edge',
            )}
          >
            <p className={cx('flex items-center gap-2 text-sm font-semibold', g.tone === 'risk' ? 'text-risk' : 'text-warn')}>
              {g.tone === 'risk' ? <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" /> : <Info className="h-4 w-4 shrink-0" aria-hidden="true" />}
              {g.label}
            </p>
            <ul className="mt-2 space-y-1.5">
              {g.list.map((i, idx) => (
                <li key={`${i.message}-${idx}`} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm text-ink-2">
                  <span className="min-w-0 break-words">{i.message}</span>
                  {i.fix ? (
                    <Link to={i.fix.to} className="vx-focus inline-flex shrink-0 items-center gap-1 rounded-xs font-medium text-accent-text hover:underline">
                      {i.fix.label}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
    </div>
  )
}

/* ------------------------------- Number input ----------------------------- */
/* A text field in decimal mode. It keeps the typed text (so "12." and "" are
   allowed mid-edit) and reports a number, `null` for empty, or NaN for text
   that is not a number — validation decides what to do with each. */

export function NumberInput({
  value,
  onChange,
  className,
  invalid,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number | null
  onChange: (v: number | null) => void
  invalid?: boolean
}) {
  const show = (v: number | null) => (v === null || Number.isNaN(v) ? '' : String(v))
  const [text, setText] = useState(() => show(value))
  const emitted = useRef<number | null>(value)

  useEffect(() => {
    const same = value === emitted.current || (Number.isNaN(value as number) && Number.isNaN(emitted.current as number))
    if (!same) {
      emitted.current = value
      setText(show(value))
    }
  }, [value])

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      aria-invalid={invalid || undefined}
      className={cx('vx-input tabular-nums', className)}
      value={text}
      onChange={(e) => {
        const t = e.target.value
        setText(t)
        const trimmed = t.trim().replace(/,/g, '')
        const parsed = trimmed === '' ? null : Number(trimmed)
        const out = parsed === null ? null : Number.isFinite(parsed) ? parsed : NaN
        emitted.current = out
        onChange(out)
      }}
    />
  )
}

/* ----------------------------- Unsaved changes ---------------------------- */

/**
 * Guards in-app navigation and tab close while `dirty`. Call `bypass()` right
 * before navigating away after a successful save — the blocker otherwise still
 * sees the dirty flag from the last render.
 */
export function useUnsavedChanges(dirty: boolean): { dialog: ReactNode; bypass: () => void } {
  const skip = useRef(false)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (skip.current) {
      skip.current = false
      return false
    }
    return dirty && currentLocation.pathname !== nextLocation.pathname
  })

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  return {
    bypass: () => {
      skip.current = true
    },
    dialog: (
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        tone="danger"
        title="Leave without saving?"
        body="You have unsaved changes on this screen. They will be lost if you leave now."
        confirmLabel="Discard changes"
        cancelLabel="Stay here"
        onCancel={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      />
    ),
  }
}

/** Move focus to the first field marked invalid, after React has committed it. A task rather than
    requestAnimationFrame, which never fires in hidden or non-painting documents. */
export function focusFirstInvalid(root: ParentNode | null = document) {
  window.setTimeout(() => {
    const el = root?.querySelector<HTMLElement>('[aria-invalid="true"]')
    el?.focus()
    el?.scrollIntoView({ block: 'center' })
  })
}

/* ---------------------------------- Sub-nav ------------------------------- */

export function SubNav({ label, items }: { label: string; items: Array<{ to: string; label: string; hint?: string }> }) {
  return (
    <nav aria-label={label} className="vx-anim-up -mt-2 mb-5 flex gap-1 overflow-x-auto border-b border-rule">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cx(
              'vx-press vx-focus relative flex shrink-0 flex-col px-3.5 py-2.5 text-left',
              isActive ? 'text-accent-text' : 'text-muted hover:text-ink',
            )
          }
        >
          {({ isActive }) => (
            <>
              <span className="text-base font-medium">{item.label}</span>
              {item.hint ? <span className="text-2xs text-faint">{item.hint}</span> : null}
              {isActive ? <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" aria-hidden="true" /> : null}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

/* ---------------------------- Conflict notice ----------------------------- */
/* Shown when a save is refused because another tab or admin changed the same
   record first. Reloading discards this screen's unsaved edits on purpose. */

export function ConflictNotice({ message, onReload }: { message: string; onReload: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  // Save buttons sit at the end of long forms, so bring the notice into view when it appears.
  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: 'nearest' })
  }, [message])
  const reload = () => {
    // The notice (and its focused button) unmounts on reload. Keep focus in the editor: the first
    // field after the notice, found in the nearest enclosing region that has one.
    // Resolve the target before reloading: the notice's own wrapper may unmount with it.
    const fields = 'input:not([type=hidden]):not(:disabled), textarea:not(:disabled), select:not(:disabled)'
    const notice = ref.current
    const chain: HTMLElement[] = []
    let target: HTMLElement | undefined
    for (let scope = notice?.parentElement ?? null; scope && !target; scope = scope.parentElement) {
      chain.push(scope)
      target = [...scope.querySelectorAll<HTMLElement>(fields)].find((el) => !!notice && !!(notice.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING))
      if (scope.matches('main, [data-overlay-body], [role=dialog]')) break
    }
    onReload()
    // A task, not requestAnimationFrame: rAF is paused in hidden or non-painting documents,
    // and React has already committed the reload by the time the task runs.
    window.setTimeout(() => {
      if (target?.isConnected) return target.focus()
      chain.find((scope) => scope.isConnected)?.querySelector<HTMLElement>(fields)?.focus()
    }, 0)
  }
  return (
    <div ref={ref} role="alert" className="mb-4 flex scroll-mt-20 flex-wrap items-center gap-3 rounded-md bg-warn-wash px-3.5 py-3 text-sm text-warn ring-1 ring-inset ring-warn-edge">
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{message}</span>
      <button type="button" onClick={reload} className={cx(buttonClasses('secondary', 'sm'), 'gap-1.5')}>
        Load latest version
      </button>
    </div>
  )
}

/* ------------------------------- Link button ------------------------------ */

export function LinkButton({
  to,
  children,
  icon,
  variant = 'primary',
  size = 'md',
  className,
}: {
  to: string
  children: ReactNode
  icon?: ReactNode
  variant?: Parameters<typeof buttonClasses>[0]
  size?: Parameters<typeof buttonClasses>[1]
  className?: string
}) {
  return (
    <Link to={to} className={cx(buttonClasses(variant, size), 'gap-2', className)}>
      {icon ? (
        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
    </Link>
  )
}

/* ------------------------------- Detail pair ------------------------------ */

export function Detail({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx('min-w-0', className)}>
      <dt className="vx-mono-label">{label}</dt>
      <dd className="mt-1 break-words text-base text-ink">{children}</dd>
    </div>
  )
}
