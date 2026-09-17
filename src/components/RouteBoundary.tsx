import { Component } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { RotateCcw } from 'lucide-react'
import { Button } from './ui'

/* ---------------------------------------------------------------------------
 * Screens are code-split, so opening one fetches a file at that moment. That
 * fetch can fail — the network dropped, or the app was redeployed and the old
 * file is gone. A failure like that must not take down the whole app: the shell
 * and navigation stay, only the screen area reports the problem.
 *
 * React.lazy remembers a rejected import, so retrying in place would fail again
 * without re-fetching. Reloading the page is the honest recovery: it picks up
 * the current build. Saved records are unaffected — each change is already
 * persisted when it is made.
 * ------------------------------------------------------------------------- */

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error(error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="flex justify-center py-10">
        <div role="alert" className="vx-card max-w-lg p-6 text-center">
          <p className="vx-eyebrow">Screen not loaded</p>
          <h2 className="mt-2 font-display text-lg font-semibold text-ink">This screen could not be loaded</h2>
          <p className="mt-2 text-base text-muted">
            Part of the application could not be downloaded. Your saved records are safe — every change is stored as soon as it is made.
            Reload the page to try again; if it keeps happening, check your connection.
          </p>
          <Button className="mt-5" icon={<RotateCcw className="h-4 w-4" />} onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </div>
      </div>
    )
  }
}

/** Keyed by path so a failure on one screen does not stick when the user navigates away. */
export function RouteBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return <Boundary key={pathname}>{children}</Boundary>
}
