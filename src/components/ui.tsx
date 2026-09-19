import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from 'react'
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Info, Loader2, Search, X, XCircle } from 'lucide-react'
import { cx } from '../lib/format'
import { useStore } from '../store/store'

/* --------------------------------- Button --------------------------------- */

type Variant =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'ghost'
  | 'outline'
  | 'inverse'
  | 'danger'
  | 'danger-outline'
  | 'success'
  | 'dark'
type Size = 'sm' | 'md' | 'lg' | 'xl'

/* Linear's four-variant button set. One lavender fill for the primary action;
   every other variant is a charcoal panel behind a hairline. No gradients, no
   pill CTAs — 8px corners on all of them, the source system's single radius.

   Every variant ships all EIGHT states: default · hover · focus · active ·
   disabled · loading · error · success. Hover sits behind @media (hover: hover)
   so a touch tap does not leave the control stuck in its hover skin. */
const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-ink hover:bg-accent-hover active:bg-accent-focus',
  secondary:
    'bg-surface text-ink border border-rule-2 hover:bg-surface-2 hover:border-hairline-tertiary active:bg-surface-3',
  /* Tertiary is the plain text button from the source spec — canvas ground,
     no border. It replaces the places that reached for a bordered button when
     nothing needed bordering. */
  tertiary: 'bg-transparent text-ink hover:bg-surface-2 active:bg-surface-3',
  outline:
    'bg-transparent text-accent-text border border-accent-edge hover:bg-accent-wash hover:border-accent active:bg-accent-wash',
  ghost: 'bg-transparent text-muted hover:bg-surface-2 hover:text-ink active:bg-surface-3',
  /* The inverse CTA — white on dark. Reserved for the single loudest action on
     a screen; it outshouts the lavender, so at most one per view. */
  inverse: 'bg-ink text-canvas hover:bg-ink-2 active:bg-ink-2',
  /* Bright semantic fills take dark ink, not white — white on #f76c6c is 2.9:1. */
  danger: 'bg-risk text-canvas hover:brightness-110 active:brightness-95',
  'danger-outline':
    'bg-surface text-risk border border-risk-edge hover:bg-risk-wash hover:border-risk active:bg-risk-wash',
  success: 'bg-ok text-canvas hover:brightness-110 active:brightness-95',
  dark: 'bg-surface-2 text-ink border border-rule hover:bg-surface-3 active:bg-surface-4',
}

/* The transient states are variant-independent: they override the ground so the
   signal reads the same wherever the button lives. */
const STATE_SKIN: Record<'error' | 'success', string> = {
  error: 'bg-risk-wash text-risk border border-risk-edge',
  success: 'bg-ok-wash text-ok border border-ok-edge',
}

/* Linear's compact button spec is 8px vertical / 14px horizontal padding. Sizes
   step the height, never the radius. Coarse pointers get 44px via the base layer.
   Input height tracks md exactly — a page with 36px buttons and 40px inputs
   reads untuned. */
const SIZES: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-sm gap-1.5 rounded-md',
  md: 'h-9 px-3.5 text-base gap-2 rounded-md',
  lg: 'h-10 px-4 text-base gap-2 rounded-md',
  xl: 'h-12 px-5 text-md gap-2.5 rounded-md font-semibold',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  loading?: boolean
  block?: boolean
  /* Transient result states. They skin the button and announce politely; they
     do not replace its label, because a button that renames itself mid-action
     loses the user's place. */
  state?: 'idle' | 'error' | 'success'
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  block,
  state = 'idle',
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const skinned = state !== 'idle'
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-live={skinned ? 'polite' : undefined}
      data-state={state === 'idle' ? undefined : state}
      className={cx(
        'vx-btn vx-focus inline-flex select-none items-center justify-center whitespace-nowrap font-medium',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45',
        skinned ? STATE_SKIN[state] : VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
    >
      {/* The glyph slot never collapses, so swapping icon → spinner → check
          cannot reflow the label. */}
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : state === 'error' ? (
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        ) : state === 'success' ? (
          <Check className="h-4 w-4" aria-hidden="true" />
        ) : (
          icon
        )}
      </span>
      {children}
    </button>
  )
}

/** Button skin for elements that must stay links (navigation) or labels. */
export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', className?: string): string {
  return cx(
    'vx-btn vx-focus inline-flex select-none items-center justify-center whitespace-nowrap font-medium',
    VARIANTS[variant],
    SIZES[size],
    className,
  )
}

export function IconButton({
  className,
  children,
  label,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...rest}
      title={label}
      aria-label={label}
      className={cx(
        'vx-btn vx-focus relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted',
        'hover:bg-surface-2 hover:text-ink active:bg-surface-3',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45',
        className,
      )}
    >
      {children}
    </button>
  )
}

/* ---------------------------------- Card ---------------------------------- */

export function Card({
  className,
  children,
  ...rest
}: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cx('vx-card', className)}>
      {children}
    </div>
  )
}

export function CardHead({
  title,
  subtitle,
  icon,
  actions,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cx(
        'flex flex-wrap items-center justify-between gap-3 border-b border-rule px-4 py-3',
        className,
      )}
    >
      {/* S4 · the head emerges from the flow as small caps. The accent tick that
          used to sit on the left edge of every single one is gone: repeated on
          twenty cards it stopped being a signal and became a stripe. */}
      <div className="flex min-w-0 items-center gap-2.5">
        {icon ? <span className="shrink-0 text-faint">{icon}</span> : null}
        <div className="min-w-0">
          <h3 className="vx-smallcaps text-ink">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs leading-snug text-muted">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">{actions}</div> : null}
    </div>
  )
}

/* --------------------------------- Badges --------------------------------- */

export type Tone =
  | 'slate'
  | 'indigo'
  | 'violet'
  | 'green'
  | 'amber'
  | 'red'
  | 'blue'
  | 'white'

/* The source system's status badge is quiet: one lifted surface, muted ink, no
   ring. The old set gave every badge a tinted fill AND a coloured ring AND
   coloured text — three channels for one fact, which is why a board of twelve
   jobs read as confetti. Colour now lives in the dot; the pill stays neutral,
   except for the two states an operator must never miss. */
const TONES: Record<Tone, string> = {
  slate: 'bg-surface-2 text-ink-2',
  indigo: 'bg-surface-2 text-accent-text',
  violet: 'bg-surface-2 text-chart-6',
  green: 'bg-surface-2 text-ok',
  amber: 'bg-warn-wash text-warn',
  red: 'bg-risk-wash text-risk',
  blue: 'bg-surface-2 text-live',
  white: 'bg-surface-3 text-ink-2',
}

const DOTS: Record<Tone, string> = {
  slate: 'bg-faint',
  indigo: 'bg-accent-hover',
  violet: 'bg-chart-6',
  green: 'bg-ok',
  amber: 'bg-warn',
  red: 'bg-risk',
  blue: 'bg-live',
  white: 'bg-ink-2',
}

export function Badge({
  tone = 'slate',
  children,
  className,
  dot,
}: {
  tone?: Tone
  children: ReactNode
  className?: string
  dot?: boolean
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-2xs font-medium uppercase tracking-[0.06em]',
        TONES[tone],
        className,
      )}
    >
      {dot ? (
        <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', DOTS[tone])} aria-hidden="true" />
      ) : null}
      {children}
    </span>
  )
}

/* --------------------------------- Inputs --------------------------------- */

export function Field({
  label,
  hint,
  error,
  children,
  className,
  required,
  as = 'label',
}: {
  label: string
  hint?: ReactNode
  error?: string
  children: ReactNode
  className?: string
  required?: boolean
  /* Use `div` when the field wraps several controls (a group), so one label
     element does not swallow clicks meant for the second control. */
  as?: 'label' | 'div'
}) {
  const Tag = as
  return (
    <Tag className={cx('block min-w-0', className)}>
      <span className="vx-label">
        {label}
        {required ? <span className="ml-0.5 text-risk" aria-hidden="true">*</span> : null}
      </span>
      {children}
      {/* The helper slot holds one line of height even when empty, so an
          appearing error cannot push the rest of the form down. */}
      <span className={cx('vx-help mt-1', error && 'font-medium text-risk')} aria-live="polite">
        {error ?? hint}
      </span>
    </Tag>
  )
}

export function Input({ className, ...rest }: ComponentProps<'input'>) {
  return <input {...rest} className={cx('vx-input', className)} />
}

export function Select({
  className,
  children,
  ...rest
}: ComponentProps<'select'>) {
  return (
    <select
      {...rest}
      className={cx(
        'vx-input cursor-pointer appearance-none bg-[url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 20 20%27 fill=%27%238a8f98%27><path d=%27M5.5 7.5 10 12l4.5-4.5z%27/></svg>")] bg-[length:20px_20px] bg-[right_0.6rem_center] bg-no-repeat pr-9',
        className,
      )}
    >
      {children}
    </select>
  )
}

export function Textarea({ className, ...rest }: ComponentProps<'textarea'>) {
  return <textarea {...rest} className={cx('vx-input h-auto py-2.5 leading-relaxed', className)} />
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={cx('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="vx-input pl-9"
      />
      {value ? (
        <button
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="vx-press absolute right-2.5 top-1/2 -translate-y-1/2 rounded-xs p-1 text-muted hover:bg-surface-3 hover:text-ink-2"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  )
}

/* --------------------------------- Layout --------------------------------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: Array<{ value: T; label: string; count?: number }>
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div
      className={cx(
        'inline-flex flex-wrap items-center gap-0.5 rounded-full border border-rule bg-surface p-0.5',
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'vx-press inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium',
            'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus',
            value === o.value
              ? 'bg-surface-3 text-ink'
              : 'text-muted hover:bg-surface-2 hover:text-ink',
          )}
        >
          {o.label}
          {typeof o.count === 'number' ? (
            <span
              className={cx(
                'vx-code rounded-xs px-1 py-0.5 text-2xs font-medium',
                value === o.value ? 'bg-accent-wash text-accent-text' : 'bg-surface-2 text-muted',
              )}
            >
              {o.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  )
}

export function ProgressBar({
  value,
  tone = 'indigo',
  className,
  showLabel,
}: {
  value: number
  tone?: 'indigo' | 'green' | 'amber' | 'red' | 'blue'
  className?: string
  showLabel?: boolean
}) {
  const colors: Record<string, string> = {
    indigo: 'bg-accent',
    green: 'bg-ok',
    amber: 'bg-warn',
    red: 'bg-risk',
    blue: 'bg-live',
  }
  return (
    <div className={cx('flex items-center gap-2', className)}>
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-xs bg-surface-3"
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {/* Scale, not width — width animation forces layout on every frame. */}
        <div
          className={cx('h-full w-full origin-left rounded-xs', colors[tone])}
          style={{
            transform: `scaleX(${Math.max(0.02, Math.min(100, value) / 100)})`,
            transition: 'transform var(--dur-long) var(--ease-out)',
          }}
        />
      </div>
      {showLabel ? (
        <span className="vx-code w-9 shrink-0 text-right text-xs font-medium text-ink-2">
          {Math.round(value)}%
        </span>
      ) : null}
    </div>
  )
}

/* --------------------------------- Modal ---------------------------------- */

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/* APG dialog behaviour for every overlay (Modal, Drawer, ConfirmDialog).
   Overlays can nest — a confirm dialog over a drawer — so they share a stack:
   only the TOP overlay reacts to Escape and traps Tab, the page scroll lock is
   reference-counted (closing the inner overlay keeps the outer one locked), and
   focus returns to the element that opened each overlay if it still exists. */
const overlayStack: symbol[] = []
let scrollLocks = 0

/* Recently focused elements. The opener cannot be read from document.activeElement when the
   overlay's effect runs: React applies `autoFocus` inside the new content during commit, before
   effects, so activeElement is already inside the overlay by then. */
const focusHistory: HTMLElement[] = []
if (typeof document !== 'undefined') {
  document.addEventListener(
    'focusin',
    (e) => {
      if (!(e.target instanceof HTMLElement)) return
      focusHistory.push(e.target)
      if (focusHistory.length > 20) focusHistory.shift()
    },
    true,
  )
}

function useOverlay(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLElement>(null)
  const closeRef = useRef(onClose)

  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const id = Symbol('overlay')
    overlayStack.push(id)
    if (scrollLocks++ === 0) document.body.style.overflow = 'hidden'

    const root = ref.current
    // Most recent focus outside this overlay first; older ones are fallbacks if the opener unmounts.
    const current = document.activeElement instanceof HTMLElement ? [document.activeElement] : []
    const openers = [...focusHistory, ...current]
      .filter((el, i, all) => el !== document.body && !root?.contains(el) && all.lastIndexOf(el) === i)
      .reverse()
      .slice(0, 5)
    const visible = () =>
      Array.from(root?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((el) => el.getClientRects().length > 0)
    // Start inside the content (first field or action) rather than on the Close button.
    const body = root?.querySelector<HTMLElement>('[data-overlay-body]')
    const initial =
      root?.querySelector<HTMLElement>('[autofocus]') ??
      Array.from(body?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).find((el) => el.getClientRects().length > 0) ??
      visible()[0]
    initial?.focus()

    const isTop = () => overlayStack[overlayStack.length - 1] === id
    const onKey = (e: KeyboardEvent) => {
      if (!isTop() || !root) return
      if (e.key === 'Escape') {
        e.preventDefault()
        closeRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = visible()
      if (!items.length) {
        e.preventDefault()
        return
      }
      const active = document.activeElement
      if (!root.contains(active)) {
        e.preventDefault()
        items[0].focus()
        return
      }
      const edge = e.shiftKey ? items[0] : items[items.length - 1]
      if (active === edge) {
        e.preventDefault()
        ;(e.shiftKey ? items[items.length - 1] : items[0]).focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      overlayStack.splice(overlayStack.indexOf(id), 1)
      if (--scrollLocks === 0) document.body.style.overflow = ''
      openers.find((el) => el.isConnected)?.focus()
    }
  }, [open])

  return ref
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  icon,
  pinnedFooter = false,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  icon?: ReactNode
  /** Keep the header and footer actions on screen; only the body scrolls. */
  pinnedFooter?: boolean
}) {
  const trapRef = useOverlay(open, onClose)
  const titleId = useId()

  if (!open) return null
  const widths = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' }
  // Rendered on <body>: an animated or transformed ancestor would otherwise
  // become the containing block and trap the "fixed" overlay inside it.
  return createPortal(
    <div
      className="vx-no-print fixed inset-0 flex items-start justify-center overflow-y-auto overscroll-contain bg-scrim/70 p-4 sm:p-8"
      style={{ zIndex: 'var(--z-modal)' }}
    >
      <div
        ref={trapRef as React.RefObject<HTMLDivElement>}
        className={cx('vx-anim-pop my-auto w-full rounded-lg border border-rule-2 bg-surface', pinnedFooter && 'flex max-h-[calc(100dvh-2rem)] flex-col sm:max-h-[calc(100dvh-4rem)]', widths[size])}
        style={{ boxShadow: 'var(--shadow-overlay)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-rule px-5 py-4">
          <div className="flex items-start gap-3">
            {icon ? <span className="mt-0.5 shrink-0 text-faint" aria-hidden="true">{icon}</span> : null}
            <div>
              <h2 id={titleId} className="vx-smallcaps text-ink">{title}</h2>
              {subtitle ? <p className="mt-0.5 text-base text-muted">{subtitle}</p> : null}
            </div>
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X className="h-4.5 w-4.5" />
          </IconButton>
        </div>
        <div className={cx('px-5 py-5', pinnedFooter && 'min-h-0 flex-1 overflow-y-auto overscroll-contain')} data-overlay-body>
          {children}
        </div>
        {footer ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 rounded-b-lg border-t border-rule px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
}: {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
  title: string
  body: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'primary' | 'danger' | 'success'
}) {
  const icons = {
    primary: <Info className="h-5 w-5" />,
    danger: <AlertTriangle className="h-5 w-5" />,
    success: <Check className="h-5 w-5" />,
  }
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      icon={icons[tone]}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'primary' ? 'primary' : tone} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-ink-2">{body}</div>
    </Modal>
  )
}

/* --------------------------------- Drawer --------------------------------- */

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = 'w-full max-w-xl',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  width?: string
}) {
  const trapRef = useOverlay(open, onClose)
  const titleId = useId()

  if (!open) return null
  return createPortal(
    <div
      className="vx-no-print fixed inset-0 flex justify-end overscroll-contain bg-scrim/70"
      style={{ zIndex: 'var(--z-modal)' }}
    >
      {/* Pointer-only backdrop: keyboard users close with Escape or the Close button. */}
      <div className="flex-1 cursor-default" aria-hidden="true" onClick={onClose} />
      <aside
        ref={trapRef as React.RefObject<HTMLElement>}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx('vx-anim-in flex h-full flex-col border-l border-rule-2 bg-surface', width)}
        style={{ boxShadow: 'var(--shadow-drawer)' }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-rule px-5 py-4">
          <div className="flex items-start gap-2.5">
            <div>
              <h2 id={titleId} className="vx-smallcaps text-ink">{title}</h2>
              {subtitle ? <p className="mt-0.5 text-base text-muted">{subtitle}</p> : null}
            </div>
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X className="h-4.5 w-4.5" />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4" data-overlay-body>
          {children}
        </div>
      </aside>
    </div>,
    document.body,
  )
}

/* ------------------------------ State displays ---------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-xs bg-surface-3', className)} />
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cx('h-8 flex-1', c === 0 && 'max-w-[140px]')} />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Route-level loading placeholder shaped like PageHeader + StatStrip + a table card. */
export function PageSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="pb-6" aria-hidden="true">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-3 h-7 w-64 max-w-full" />
        <Skeleton className="mt-3 h-4 w-full max-w-[68ch]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="vx-tile flex flex-col gap-3 px-4 py-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-16" />
          </div>
        ))}
      </div>
      <div className="vx-card overflow-hidden" aria-hidden="true">
        <TableSkeleton />
      </div>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  message,
  action,
  className,
}: {
  icon: ReactNode
  title: string
  message: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cx('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-sm border border-rule-2 text-muted">
        {icon}
      </span>
      <h4 className="font-display text-md font-semibold text-ink">{title}</h4>
      <p className="mt-1.5 max-w-sm text-base leading-relaxed text-muted">{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

/* ------------------------------- Pagination ------------------------------- */

export function Pagination({
  page,
  pageCount,
  total,
  onChange,
  label = 'records',
}: {
  page: number
  pageCount: number
  total: number
  onChange: (p: number) => void
  label?: string
}) {
  if (pageCount <= 1) {
    return (
      <div className="flex items-center justify-between border-t border-rule px-4 py-3 text-xs text-muted">
        <span>
          {total} {label}
        </span>
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule px-4 py-3">
      <span className="text-xs text-muted">
        Page {page} of {pageCount} · {total} {label}
      </span>
      <div className="flex items-center gap-1">
        <IconButton label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </IconButton>
        {Array.from({ length: pageCount })
          .map((_, i) => i + 1)
          .filter((p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1)
          .map((p, idx, arr) => (
            <span key={p} className="flex items-center">
              {idx > 0 && p - arr[idx - 1] > 1 ? (
                <span className="px-1 text-xs text-muted">…</span>
              ) : null}
              <button
                onClick={() => onChange(p)}
                aria-current={p === page ? 'page' : undefined}
                className={cx(
                  'vx-press vx-code h-8 min-w-8 rounded-xs px-2 text-sm font-medium',
                  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus',
                  p === page ? 'bg-accent text-accent-ink' : 'text-ink-2 hover:bg-surface-2',
                )}
              >
                {p}
              </button>
            </span>
          ))}
        <IconButton
          label="Next page"
          disabled={page >= pageCount}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  )
}

/* --------------------------------- Toasts --------------------------------- */

const TOAST_STYLE = {
  info: { bar: 'bg-live', icon: <Info className="h-4 w-4 text-live" /> },
  success: { bar: 'bg-ok', icon: <Check className="h-4 w-4 text-ok" /> },
  warn: { bar: 'bg-warn', icon: <AlertTriangle className="h-4 w-4 text-warn" /> },
  danger: { bar: 'bg-risk', icon: <XCircle className="h-4 w-4 text-risk" /> },
}

export function ToastViewport() {
  const { toasts, dismissToast } = useStore()
  return (
    <div
      className="vx-no-print pointer-events-none fixed bottom-5 right-5 flex w-[min(92vw,380px)] flex-col gap-2"
      style={{ zIndex: 'var(--z-toast)' }}
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const s = TOAST_STYLE[t.level]
        return (
          <div
            key={t.id}
            className="vx-anim-in pointer-events-auto flex overflow-hidden rounded-sm border border-rule-2 bg-surface"
            style={{ boxShadow: 'var(--shadow-lift)' }}
          >
            <span className={cx('w-0.5 shrink-0', s.bar)} />
            <div className="flex flex-1 items-start gap-2.5 p-3.5">
              <span className="mt-0.5">{s.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-ink">{t.title}</p>
                {t.message ? (
                  <p className="mt-0.5 text-sm leading-relaxed text-muted">{t.message}</p>
                ) : null}
              </div>
              <IconButton label="Dismiss" className="h-6 w-6" onClick={() => dismissToast(t.id)}>
                <X className="h-3.5 w-3.5" />
              </IconButton>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------ Misc helpers ------------------------------ */

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="vx-mono-label">{label}</dt>
      <dd className="mt-1 truncate text-base font-medium text-ink">{value}</dd>
    </div>
  )
}

export function useAutoFocus<T extends HTMLElement>(active = true) {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (active) ref.current?.focus()
  }, [active])
  return ref
}

export function useDomId(prefix: string) {
  const id = useId()
  return `${prefix}${id}`
}
