import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react'
import { remote } from '../store/remote'
import type { LicenceInfo } from '../store/remote'

/* ---------------------------------------------------------------------------
 * The licence lock of an installed (offline) copy. The server decides — see
 * server/licence.ts — and refuses every call while the licence is not active;
 * this screen only explains it and offers "Check again". Data is never touched.
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

export function LicenceGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LicenceInfo | null>(null)
  const [checking, setChecking] = useState(false)
  const [tried, setTried] = useState(false)

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
    const timer = window.setInterval(() => void load(), 60_000)
    const onLocked = () => void load()
    window.addEventListener('vertex:licence', onLocked)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('vertex:licence', onLocked)
    }
  }, [load])

  const locked = !!state && state.managed && !state.active
  const heading = TITLE[state?.reason ?? 'unknown'] ?? TITLE.unknown
  // The tab says what the window shows.
  useEffect(() => {
    if (!locked) return
    const before = document.title
    document.title = `${heading} · Vertex ERP`
    return () => {
      document.title = before
    }
  }, [locked, heading])

  if (!state || !locked) return <>{children}</>

  const checkAgain = async () => {
    setChecking(true)
    await load(true)
    setChecking(false)
    setTried(true)
  }

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

        <p className="mt-4 flex gap-2 rounded-md bg-ok-wash px-3.5 py-3 text-sm leading-relaxed text-ok ring-1 ring-inset ring-ok-edge">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Your data is safe. Nothing has been deleted, and backups keep running — everything opens again as soon as the licence is active.
        </p>

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

        {tried && state.lastError ? (
          <p className="mt-4 rounded-md bg-surface-2 px-3.5 py-2.5 text-sm text-muted">Could not reach the licence service: {state.lastError}</p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void checkAgain()}
            disabled={checking}
            className="vx-btn vx-focus inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-base font-medium text-accent-ink disabled:opacity-60"
          >
            <RefreshCw className={checking ? 'h-4 w-4 animate-spin motion-reduce:animate-none' : 'h-4 w-4'} aria-hidden="true" />
            {checking ? 'Checking…' : 'Check again'}
          </button>
          <span className="text-sm text-muted">
            Back Moon Devs · <a className="vx-focus rounded-xs underline" href="tel:+918940095659">89400&nbsp;95659</a>
          </span>
        </div>
      </section>
    </main>
  )
}
