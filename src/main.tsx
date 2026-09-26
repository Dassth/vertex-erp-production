import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createBrowserRouter, useRouteError } from 'react-router-dom'
import './index.css'
import App from './App'
import { StoreProvider } from './store/store'
import { SERVER_MODE } from './store/remote'
import { LicenceGate } from './components/LicenceGate'
import { UpdateBanner } from './components/UpdateBanner'

/* Last-resort screen: an unexpected render error must never leave a dead end.
   Data is already persisted per action, so reloading is safe. */
function CrashScreen() {
  const error = useRouteError()
  const message = error instanceof Error ? error.message : 'Unknown error'
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-paper px-4">
      <div className="vx-card w-full max-w-lg p-6">
        <p className="vx-eyebrow">Something went wrong</p>
        <h1 className="mt-2 font-display text-xl font-semibold text-ink">This screen could not be displayed</h1>
        <p className="mt-2 text-base text-muted">
          Your saved records are safe — every change is stored as soon as it is made. Reload the page or go back to Production.
        </p>
        <p className="vx-code mt-3 break-words rounded-md bg-surface-2 px-3 py-2 text-xs text-ink-2">{message}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="vx-btn vx-focus h-9 rounded-md bg-accent px-3.5 text-base font-medium text-accent-ink" onClick={() => window.location.reload()}>
            Reload
          </button>
          <a href="/production" className="vx-btn vx-focus inline-flex h-9 items-center rounded-md border border-rule-2 bg-surface px-3.5 text-base font-medium text-ink">
            Go to Production
          </a>
        </div>
      </div>
    </div>
  )
}

/* A data router so screens can block navigation while they hold unsaved
   changes (useBlocker). App keeps its descendant <Routes>. */
const router = createBrowserRouter([
  {
    path: '*',
    element: SERVER_MODE ? (
      <>
        <UpdateBanner />
        <LicenceGate>
          <StoreProvider>
            <App />
          </StoreProvider>
        </LicenceGate>
      </>
    ) : (
      <StoreProvider>
        <App />
      </StoreProvider>
    ),
    errorElement: <CrashScreen />,
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
