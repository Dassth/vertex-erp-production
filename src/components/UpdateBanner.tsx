import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { APP_BUILD } from '../lib/build'
import { remote } from '../store/remote'

/* ---------------------------------------------------------------------------
 * A window keeps the program it opened with. After a new version is installed
 * (setup run again), an open window would go on showing the old screens; this
 * notices the server's newer build and asks to reload. Unsaved typing is kept
 * by the app's drafts, but the reload is still the person's choice.
 * ------------------------------------------------------------------------- */

/** "vertex-erp@2026.09.26.1405" → "2026.09.26.1405" */
const buildOf = (version: string | null | undefined) => (version ?? '').replace(/^.*@/, '')

export function UpdateBanner() {
  const [newer, setNewer] = useState<string | null>(null)

  useEffect(() => {
    if (APP_BUILD === 'dev') return
    const check = async () => {
      try {
        const r = await remote.health()
        const server = buildOf(r.body.version)
        if (r.status === 200 && server && server !== APP_BUILD) setNewer(server)
      } catch {
        // Server unreachable: the app shows that it is offline.
      }
    }
    void check()
    const timer = window.setInterval(() => void check(), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  if (!newer) return null
  return (
    <div
      data-licence-allow
      role="status"
      className="fixed inset-x-0 top-0 flex flex-wrap items-center justify-center gap-3 bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink"
      style={{ zIndex: 'var(--z-toast)', paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}
    >
      <span>
        Vertex ERP has been updated to version {newer}. Reload to use it (this window has {APP_BUILD}).
      </span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="vx-focus inline-flex h-8 items-center gap-1.5 rounded-md bg-surface px-3 text-sm font-semibold text-ink"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        Reload now
      </button>
    </div>
  )
}
