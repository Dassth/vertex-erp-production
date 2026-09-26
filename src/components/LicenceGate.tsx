import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { LockKeyhole, PhoneCall, RefreshCw, ShieldCheck, X } from 'lucide-react'
import { remote } from '../store/remote'
import type { LicenceInfo } from '../store/remote'

/* ---------------------------------------------------------------------------
 * The licence of an installed (offline) copy. The server decides — see
 * server/licence.ts — and refuses what the licence does not allow; this only
 * explains it.
 *
 *   Suspended   pages still open, but pressing any button shows the suspension
 *               notice ("make the payment, call Back Moon Devs"). Navigation
 *               (sidebar, account menu) keeps working.
 *   Other locks the whole window is the lock screen.
 * Data is never touched.
 * ------------------------------------------------------------------------- */

const TITLE: Record<string, string> = {
  suspended: 'Vertex ERP is suspended',
  deactivated: 'Vertex ERP is deactivated',
  unverified: 'Activate Vertex ERP',
  expired: 'Connect to the internet',
  clock: 'Check the date and time',
  unknown: 'Licence not recognised',
}

const when = (iso: string | null) => (iso ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : 'never')

/** Clicks that change something, as opposed to moving around. */
const ACTION = 'button, [role="button"], input[type="submit"], input[type="button"], input[type="checkbox"], input[type="radio"], input[type="file"], select'

export function LicenceGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LicenceInfo | null>(null)
  const [checking, setChecking] = useState(false)
  const [tried, setTried] = useState(false)
  const [notice, setNotice] = useState(false)

  const load = useCallback(async (checkNow = false) => {
    try {
      const r = checkNow ? await remote.licenceCheck() : await remote.licence()
      if (r.status === 200 && r.body.ok) setState(r.body)
    } catch {
      // Server not reachable: the app itself shows that it is offline.
    }
  }, [])

  useEffect(() => {
    void load()
    // Every 10 s while the window is in view, and at once when it comes back into view,
    // so a suspension made while someone is signed in shows within seconds.
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, 10_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }
    const onLocked = () => {
      void load()
      setNotice(true)
    }
    window.addEventListener('vertex:licence', onLocked)
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('vertex:licence', onLocked)
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  const managed = !!state?.managed
  const viewOnly = managed && !state?.active && state?.mode === 'view-only'
  const locked = managed && !state?.active && !viewOnly
  const heading = TITLE[state?.reason ?? 'unknown'] ?? TITLE.unknown

  // While suspended, any button press anywhere shows the notice instead of acting.
  useEffect(() => {
    if (!viewOnly) {
      setNotice(false)
      return
    }
    const stop = (e: Event) => {
      const target = e.target instanceof Element ? e.target : null
      if (!target || target.closest('[data-licence-allow]')) return
      if (e.type === 'click' && !target.closest(ACTION)) return
      e.preventDefault()
      e.stopPropagation()
      setNotice(true)
    }
    document.addEventListener('click', stop, true)
    document.addEventListener('submit', stop, true)
    return () => {
      document.removeEventListener('click', stop, true)
      document.removeEventListener('submit', stop, true)
    }
  }, [viewOnly])

  // The tab says what the window shows.
  useEffect(() => {
    if (!locked) return
    const before = document.title
    document.title = `${heading} · Vertex ERP`
    return () => {
      document.title = before
    }
  }, [locked, heading])

  const checkAgain = async () => {
    setChecking(true)
    await load(true)
    setChecking(false)
    setTried(true)
  }

  if (!state || (!locked && !viewOnly)) return <>{children}</>

  if (viewOnly)
    return (
      <>
        {children}
        {notice ? <SuspendedNotice state={state} checking={checking} tried={tried} onCheck={checkAgain} onClose={() => setNotice(false)} /> : null}
      </>
    )

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-paper px-4 py-10">
      <section className="vx-card w-full max-w-lg p-6 sm:p-8" aria-labelledby="licence-title">
        <span className="flex h-11 w-11 items-center justify-center rounded-md bg-warn-wash text-warn ring-1 ring-inset ring-warn-edge">
          <LockKeyhole className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 id="licence-title" className="mt-4 font-display text-2xl font-semibold tracking-headline text-ink">
          {heading}
        </h1>
        <p className="mt-2 text-base leading-relaxed text-ink-2" role="status" aria-live="polite">
          {state.message}
        </p>
        <SafeNote />
        <Details state={state} />
        {tried && state.lastError ? <p className="mt-4 rounded-md bg-surface-2 px-3.5 py-2.5 text-sm text-muted">Could not reach the licence service: {state.lastError}</p> : null}
        <Actions checking={checking} onCheck={checkAgain} />
      </section>
    </main>
  )
}

function SafeNote() {
  return (
    <p className="mt-4 flex gap-2 rounded-md bg-ok-wash px-3.5 py-3 text-sm leading-relaxed text-ok ring-1 ring-inset ring-ok-edge">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      Your data is safe. Nothing has been deleted, and backups keep running — everything works again as soon as the licence is active.
    </p>
  )
}

function Details({ state }: { state: LicenceInfo }) {
  return (
    <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
      <dt className="text-muted">Licence</dt>
      <dd className="vx-code text-ink" translate="no">
        {state.licenceId}
      </dd>
      {state.customer ? (
        <>
          <dt className="text-muted">Customer</dt>
          <dd className="text-ink">{state.customer}</dd>
        </>
      ) : null}
      <dt className="text-muted">Last confirmed</dt>
      <dd className="text-ink">{when(state.checkedAt)}</dd>
    </dl>
  )
}

function Actions({ checking, onCheck, extra }: { checking: boolean; onCheck: () => void; extra?: ReactNode }) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onCheck}
        disabled={checking}
        className="vx-btn vx-focus inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-base font-medium text-accent-ink disabled:opacity-60"
      >
        <RefreshCw className={checking ? 'h-4 w-4 animate-spin motion-reduce:animate-none' : 'h-4 w-4'} aria-hidden="true" />
        {checking ? 'Checking…' : 'Check again'}
      </button>
      <a className="vx-btn vx-focus inline-flex h-10 items-center gap-2 rounded-md border border-rule-2 bg-surface px-4 text-base font-medium text-ink" href="tel:+918940095659">
        <PhoneCall className="h-4 w-4" aria-hidden="true" />
        Call 89400&nbsp;95659
      </a>
      {extra}
    </div>
  )
}

/** Shown when a button is pressed while suspended. */
function SuspendedNotice({ state, checking, tried, onCheck, onClose }: { state: LicenceInfo; checking: boolean; tried: boolean; onCheck: () => void; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    close.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div data-licence-allow className="fixed inset-0 flex items-center justify-center overscroll-contain bg-scrim/70 px-4" style={{ zIndex: 'var(--z-modal)' }}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="suspended-title" aria-describedby="suspended-message" className="vx-card vx-anim-pop relative w-full max-w-lg p-6 sm:p-8">
        <button ref={close} type="button" onClick={onClose} aria-label="Close" className="vx-focus absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-ink">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="flex h-11 w-11 items-center justify-center rounded-md bg-warn-wash text-warn ring-1 ring-inset ring-warn-edge">
          <LockKeyhole className="h-5 w-5" aria-hidden="true" />
        </span>
        <h2 id="suspended-title" className="mt-4 font-display text-2xl font-semibold tracking-headline text-ink">
          Vertex ERP is suspended
        </h2>
        <p id="suspended-message" className="mt-2 text-base leading-relaxed text-ink-2">
          {state.message}
        </p>
        <p className="mt-2 text-sm text-muted">You can still open and read every page. Nothing can be added, changed, printed or downloaded until the licence is active again.</p>
        <SafeNote />
        {tried && state.lastError ? <p className="mt-4 rounded-md bg-surface-2 px-3.5 py-2.5 text-sm text-muted">Could not reach the licence service: {state.lastError}</p> : null}
        <Actions checking={checking} onCheck={onCheck} />
      </section>
    </div>
  )
}
