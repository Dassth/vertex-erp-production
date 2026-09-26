import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import type { ReactNode } from 'react'
import { useStore } from './store/store'
import { AppShell } from './components/AppShell'
import { PageSkeleton, ToastViewport } from './components/ui'
import { RouteBoundary } from './components/RouteBoundary'
import { ComputerEntry, LoginPage } from './pages/LoginPage'
import { SERVER_MODE } from './store/remote'
import { MasterLayout } from './features/master/MasterLayout'
// Production is where most accounts land (and the only module unit users use): keep it in the main chunk.
import { ProductionPage } from './features/production/ProductionPage'
import type { Capability } from './lib/permissions'
import { canOpenPath, landingPath } from './lib/permissions'

/* Administrator modules are split into their own chunks and fetched on first visit. */
const ProductsPage = lazy(() => import('./features/master/products/ProductsPage').then((m) => ({ default: m.ProductsPage })))
const ProductEditorPage = lazy(() => import('./features/master/products/ProductEditor').then((m) => ({ default: m.ProductEditorPage })))
const MasterCostingPage = lazy(() => import('./features/master/costing/MasterCostingPage').then((m) => ({ default: m.MasterCostingPage })))
const CustomersPage = lazy(() => import('./features/master/customers/CustomersPage').then((m) => ({ default: m.CustomersPage })))
const PlanningPage = lazy(() => import('./features/planning/PlanningPage').then((m) => ({ default: m.PlanningPage })))
const PlanEditorPage = lazy(() => import('./features/planning/PlanEditor').then((m) => ({ default: m.PlanEditorPage })))
const CostingListPage = lazy(() => import('./features/costing/CostingListPage').then((m) => ({ default: m.CostingListPage })))
const OrderCostingPage = lazy(() => import('./features/costing/OrderCostingPage').then((m) => ({ default: m.OrderCostingPage })))
const DispatchPage = lazy(() => import('./features/dispatch/DispatchPage').then((m) => ({ default: m.DispatchPage })))
const InvoicesPage = lazy(() => import('./features/invoices/InvoicesPage').then((m) => ({ default: m.InvoicesPage })))
const UnitsMonitorPage = lazy(() => import('./features/units/UnitsMonitorPage').then((m) => ({ default: m.UnitsMonitorPage })))
const UnitMonitorDetailPage = lazy(() => import('./features/units/UnitsMonitorPage').then((m) => ({ default: m.UnitMonitorDetailPage })))
const AdminHomePage = lazy(() => import('./features/home/AdminHomePage').then((m) => ({ default: m.AdminHomePage })))
const CustomerHistoryPage = lazy(() => import('./features/customers/CustomerHistoryPage').then((m) => ({ default: m.CustomerHistoryPage })))
const ReportsPage = lazy(() => import('./features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })))
const BillingPage = lazy(() => import('./features/billing/BillingPage').then((m) => ({ default: m.BillingPage })))
const AccountsPage = lazy(() => import('./features/accounts/AccountsPage').then((m) => ({ default: m.AccountsPage })))
const SettingsPage = lazy(() => import('./features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })))

function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useStore()
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  return <>{children}</>
}

/** Where an account belongs: Admin 1 and 2 → Production, Admin 3 → Billing, units → their process work. */
function Landing() {
  const { user } = useStore()
  return <Navigate to={landingPath(user)} replace />
}

/** After signing in, return to the requested page only if this account may open it. */
function AfterSignIn() {
  const { user } = useStore()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  const allowed = from && !from.startsWith('/login') && canOpenPath(user, from.split('?')[0])
  return <Navigate to={allowed ? from : landingPath(user)} replace />
}

/**
 * First enforcement layer. The guard answers before the screen renders, so a
 * restricted module is never briefly visible and its chunk is never fetched.
 * Recovery always targets a page the account may open, so it cannot loop.
 */
function RequirePermission({ capability, children }: { capability?: Capability; children: ReactNode }) {
  const { user, can } = useStore()
  const location = useLocation()
  const allowed = capability ? can(capability) : canOpenPath(user, location.pathname)
  if (!allowed) return <Navigate to={landingPath(user)} replace />
  return <>{children}</>
}

/* One boundary per route, so surrounding chrome (shell, Master sub-nav) stays put while a page loads. */
const page = (el: ReactNode) => (
  <RouteBoundary>
    <Suspense fallback={<PageSkeleton />}>{el}</Suspense>
  </RouteBoundary>
)

const guarded = (capability: Capability, el: ReactNode) => <RequirePermission capability={capability}>{page(el)}</RequirePermission>

export default function App() {
  const { user } = useStore()
  return (
    <>
      <Routes>
        {/* Each computer has its own address: /admin1 on the main computer, /admin2 on the second. */}
        <Route path="/admin1" element={user ? <AfterSignIn /> : <LoginPage only="USR-ADM1" />} />
        <Route path="/admin2" element={user ? <AfterSignIn /> : <LoginPage only="USR-ADM2" />} />
        <Route path="/login" element={user ? <AfterSignIn /> : SERVER_MODE ? <ComputerEntry /> : <LoginPage />} />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <AppShell>
                <Routes>
                  <Route index element={<Landing />} />
                  <Route
                    path="master"
                    element={
                      <RequirePermission capability="master">
                        <MasterLayout />
                      </RequirePermission>
                    }
                  >
                    <Route index element={<Navigate to="products" replace />} />
                    <Route path="products" element={page(<ProductsPage />)} />
                    <Route path="products/:productId" element={page(<ProductEditorPage />)} />
                    <Route path="costing" element={page(<MasterCostingPage />)} />
                    <Route path="customers" element={page(<CustomersPage />)} />
                  </Route>
                  <Route path="planning" element={guarded('planning', <PlanningPage />)} />
                  <Route path="planning/:planId" element={guarded('planning', <PlanEditorPage />)} />
                  <Route path="costing" element={guarded('costing', <CostingListPage />)} />
                  <Route path="costing/:planId" element={guarded('costing', <OrderCostingPage />)} />
                  <Route
                    path="production"
                    element={
                      <RequirePermission>
                        <ProductionPage />
                      </RequirePermission>
                    }
                  />
                  <Route path="dispatch" element={guarded('dispatch', <DispatchPage />)} />
                  <Route path="invoices" element={guarded('billing', <InvoicesPage />)} />
                  <Route path="billing" element={guarded('billing', <BillingPage />)} />
                  <Route path="accounts" element={guarded('billing', <AccountsPage />)} />
                  <Route path="reports" element={guarded('billing', <ReportsPage />)} />
                  <Route path="customers" element={guarded('billing', <CustomerHistoryPage />)} />
                  <Route path="home" element={<RequirePermission>{page(<AdminHomePage />)}</RequirePermission>} />
                  <Route path="units" element={guarded('units.monitor', <UnitsMonitorPage />)} />
                  <Route path="units/:unitId" element={guarded('units.monitor', <UnitMonitorDetailPage />)} />
                  <Route path="settings" element={guarded('administration', <SettingsPage />)} />
                  <Route path="*" element={<Landing />} />
                </Routes>
              </AppShell>
            </RequireAuth>
          }
        />
      </Routes>
      <ToastViewport />
    </>
  )
}
