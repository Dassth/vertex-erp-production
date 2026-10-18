import { lazy } from 'react'
import type { ComponentType } from 'react'

/* ---------------------------------------------------------------------------
 * Screens are separate files fetched when first opened. After an update (old
 * file names gone) or a brief network drop that fetch can fail. Each screen
 * retries once by itself; if it fails again the page reloads ONCE to pick up
 * the current build (guarded so it can never loop); after that the screen
 * shows "could not be loaded" with a Reload button.
 * ------------------------------------------------------------------------- */

const GUARD = 'vertex-chunk-reload'

export function isChunkError(e: unknown): boolean {
  const m = e instanceof Error ? `${e.name} ${e.message}` : String(e)
  return /ChunkLoadError|Loading chunk|dynamically imported module|Importing a module script failed|error loading dynamically imported|Failed to load module script|MIME type|Failed to fetch/i.test(m)
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Load a screen, retrying once; on a second chunk failure reload the page once. */
export async function loadWithRetry<T>(load: () => Promise<T>, opts: { delayMs?: number; reload?: () => void; storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null } = {}): Promise<T> {
  const storage = opts.storage === undefined ? safeSession() : opts.storage
  try {
    const m = await load()
    storage?.removeItem(GUARD)
    return m
  } catch (first) {
    if (!isChunkError(first)) throw first
    await wait(opts.delayMs ?? 600)
    try {
      const m = await load()
      storage?.removeItem(GUARD)
      return m
    } catch (second) {
      if (isChunkError(second) && storage && !storage.getItem(GUARD)) {
        storage.setItem(GUARD, String(Date.now()))
        ;(opts.reload ?? (() => window.location.reload()))()
        // The page is reloading; keep the screen in its loading state meanwhile.
        return new Promise<T>(() => {})
      }
      throw second
    }
  }
}

function safeSession(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

/** React.lazy with the retry above. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyRetry<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(() => loadWithRetry(load))
}
