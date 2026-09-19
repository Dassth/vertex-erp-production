import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Wrench,
  Bell,
  Building2,
  Calculator,
  CalendarRange,
  Check,
  ChevronDown,
  CircleDot,
  Download,
  Clock,
  Database,
  Factory,
  FileStack,
  Info,
  ListChecks,
  LogOut,
  Menu,
  ReceiptText,
  RotateCcw,
  ScrollText,
  ShieldCheck,
  Truck,
  UserCog,
  Users,
  X,
} from 'lucide-react'
import { format } from 'date-fns'
import { useStore } from '../store/store'
import { remote } from '../store/remote'
import { EXPORT_FORMAT, browserExport, downloadJson, summariseDataset } from '../lib/exportData'
import { cx, fromNow } from '../lib/format'
import { currentShift } from '../lib/workhours'
import { isVisibleTo, notificationsFor } from '../lib/notify'
import type { Capability } from '../lib/permissions'
import { describeAccess } from '../lib/permissions'
import { clearNotifications, markNotificationsRead } from '../domain/system'
import { Button, Drawer, IconButton } from './ui'
import { AuditTrail } from './AuditTrail'
import { AccountDialog, ClearDataDialog, CompanyProfileDialog } from './AdminDialogs'
import { SetupGuide } from './SetupGuide'

/* Hallmark · genre: modern-minimal · macrostructure: Bento Grid
 * nav: N5 Floating pill · footer: Ft2 Inline single line
 *
 * Modules follow the operational sequence left to right:
 *   Master → Planning → Costing → Production → Dispatch → Billing
 * Master opens a three-item menu; Master → Costing (shared prices) is labelled
 * distinctly from the main Costing module (one order's costing).
 */

interface NavChild {
  to: string
  label: string
  hint: string
}

interface NavItem {
  to: string
  label: string
  hint: string
  icon: typeof Calculator
  /** Any one of these lets the account see the module. */
  capabilities: Capability[]
  children?: NavChild[]
}

export const MASTER_SECTIONS: NavChild[] = [
  { to: '/master/products', label: 'Products', hint: 'Stages, processes and materials' },
  { to: '/master/costing', label: 'Costing', hint: 'Material prices and costing configuration' },
  { to: '/master/customers', label: 'Customers', hint: 'Billing, delivery and GST details' },
]

const NAV: NavItem[] = [
  { to: '/master', label: 'Master', hint: 'Shared definitions', icon: Database, capabilities: ['master'], children: MASTER_SECTIONS },
  { to: '/planning', label: 'Planning', hint: 'Allocate every process to a unit', icon: CalendarRange, capabilities: ['planning'] },
  { to: '/costing', label: 'Costing', hint: 'Cost and finalize a planned order', icon: Calculator, capabilities: ['costing'] },
  { to: '/production', label: 'Production', hint: 'Process progress by unit', icon: Factory, capabilities: ['production.monitor', 'production.work'] },
  { to: '/dispatch', label: 'Dispatch', hint: 'Ship completed orders', icon: Truck, capabilities: ['dispatch'] },
  { to: '/invoices', label: 'Invoices', hint: 'Order summaries and invoice downloads', icon: FileStack, capabilities: ['billing'] },
  { to: '/billing', label: 'Billing', hint: 'Sales invoices and purchase bills', icon: ReceiptText, capabilities: ['billing'] },
]

type Dialog = 'audit' | 'company' | 'account' | 'clear' | 'guide' | 'resources' | null

export function AppShell({ children }: { children: ReactNode }) {
  const { user, db, logout, can, storageMode } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [dialog, setDialog] = useState<Dialog>(null)

  useEffect(() => setSheetOpen(false), [location.pathname])

  // Navigation only ever lists modules this account may open (routes re-check).
  const items = useMemo(() => NAV.filter((n) => n.capabilities.some((c) => can(c))), [can])
  const unit = db.units.find((u) => u.id === user?.unitId)
  const isAdmin = user?.role === 'admin'

  return (
    <div className="flex min-h-[100dvh] flex-col bg-paper">
      <a
        href="#main"
        className="vx-no-print sr-only rounded-md bg-accent px-4 py-2 text-base font-medium text-accent-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[var(--z-toast)]"
      >
        Skip to content
      </a>

      <nav
        aria-label="Modules"
        className="vx-no-print fixed left-5 top-4 hidden items-center gap-0.5 rounded-full border border-rule-2 bg-surface/85 p-1 pl-3 backdrop-blur-xl lg:flex"
        style={{ zIndex: 'var(--z-sticky)', boxShadow: 'var(--shadow-pop)' }}
      >
        <span className="flex items-center gap-2 pr-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-accent" aria-hidden="true">
            <span className="font-display text-sm font-bold leading-none text-accent-ink">V</span>
          </span>
          <span className="vx-smallcaps hidden text-ink xl:inline" translate="no">
            Vertex
          </span>
        </span>
        <span className="h-5 w-px bg-rule-2" aria-hidden="true" />
        {items.map((item) =>
          item.children ? (
            <MasterMenu key={item.to} item={item} />
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cx(
                  'vx-press vx-focus flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-base font-medium',
                  isActive ? 'bg-surface-3 text-ink' : 'text-muted hover:bg-surface-2 hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cx('hidden h-4 w-4 shrink-0 xl:block', isActive ? 'text-accent-text' : 'text-faint')} aria-hidden="true" />
                  {item.label}
                </>
              )}
            </NavLink>
          ),
        )}
      </nav>

      <UtilityCluster
        onMenu={() => setSheetOpen(true)}
        scopeLabel={isAdmin ? 'All units' : (unit?.shortName ?? 'Unit')}
        open={(d) => (d === 'resources' ? navigate('/settings') : setDialog(d))}
        onLogout={() => {
          logout()
          navigate('/login')
        }}
      />

      <main id="main" className="mx-auto w-full min-w-0 max-w-[1600px] flex-1 px-4 pb-16 pt-20 sm:px-6 lg:px-10 lg:pt-24">
        {children}
      </main>

      <footer className="vx-no-print mx-auto w-full max-w-[1600px] px-4 pb-6 sm:px-6 lg:px-10">
        <p className="border-t border-rule pt-4 text-xs text-faint">
          {db.company.name} · Vertex ERP ·{' '}
          {storageMode === 'server' ? 'Data is stored on the Vertex server and shared by signed-in users' : 'Data is stored in this browser only and is not shared across devices'}
        </p>
      </footer>

      <MobileSheet open={sheetOpen} onClose={() => setSheetOpen(false)} items={items} />

      <Drawer open={dialog === 'audit'} onClose={() => setDialog(null)} title="Activity Log" subtitle="Every important action, attributed to the account that performed it" width="w-full max-w-2xl">
        <AuditTrail entries={db.audit} limit={300} />
      </Drawer>
      <SetupGuide open={dialog === 'guide'} onClose={() => setDialog(null)} />
      <CompanyProfileDialog open={dialog === 'company'} onClose={() => setDialog(null)} />
      <AccountDialog open={dialog === 'account'} onClose={() => setDialog(null)} />
      <ClearDataDialog
        open={dialog === 'clear'}
        onClose={() => setDialog(null)}
        onCleared={() => {
          setDialog(null)
          navigate('/master/products')
        }}
      />
    </div>
  )
}

/* ------------------------------ Master menu ------------------------------- */

function MasterMenu({ item }: { item: NavItem }) {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [focusFirst, setFocusFirst] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const active = location.pathname.startsWith('/master')

  useEffect(() => setOpen(false), [location.pathname])

  useEffect(() => {
    if (!open) return
    if (focusFirst) menu.current?.querySelector<HTMLElement>('a')?.focus()
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      // Return focus only when it was in the menu; never pull it back from elsewhere on the page.
      if (wrap.current?.contains(document.activeElement)) button.current?.focus()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, focusFirst])

  const moveFocus = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const links = Array.from(menu.current?.querySelectorAll<HTMLElement>('a') ?? [])
    const idx = links.indexOf(document.activeElement as HTMLElement)
    const next = e.key === 'ArrowDown' ? (idx + 1) % links.length : (idx - 1 + links.length) % links.length
    links[next]?.focus()
  }

  return (
    <div
      className="relative"
      ref={wrap}
      onBlur={(e) => {
        // Tabbing past the last item (or anywhere outside) closes the menu.
        if (e.relatedTarget && !wrap.current?.contains(e.relatedTarget as Node)) setOpen(false)
      }}
    >
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls="master-menu"
        onClick={() => {
          setFocusFirst(false)
          setOpen((v) => !v)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setFocusFirst(true)
            setOpen(true)
          }
        }}
        className={cx(
          'vx-press vx-focus flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-base font-medium',
          active || open ? 'bg-surface-3 text-ink' : 'text-muted hover:bg-surface-2 hover:text-ink',
        )}
      >
        <item.icon className={cx('hidden h-4 w-4 shrink-0 xl:block', active ? 'text-accent-text' : 'text-faint')} aria-hidden="true" />
        {item.label}
        <ChevronDown className="h-3.5 w-3.5 text-faint" aria-hidden="true" />
      </button>
      {open ? (
        <div
          id="master-menu"
          ref={menu}
          onKeyDown={moveFocus}
          className="vx-anim-pop absolute left-0 top-11 w-80 overflow-hidden rounded-lg border border-rule-2 bg-surface p-1.5"
          style={{ zIndex: 'var(--z-dropdown)', boxShadow: 'var(--shadow-pop)' }}
        >
          <p className="vx-mono-label px-2.5 pb-1 pt-1.5">Master data</p>
          {item.children!.map((c) => (
            <NavLink
              key={c.to}
              to={c.to}
              className={({ isActive }) =>
                cx('vx-press vx-focus block rounded-md px-2.5 py-2', isActive ? 'bg-accent-wash' : 'hover:bg-surface-2')
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cx('block text-base font-medium', isActive ? 'text-accent-text' : 'text-ink')}>{c.label}</span>
                  <span className="block text-xs text-muted">{c.hint}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------ Mobile sheet ------------------------------ */

function MobileSheet({ open, onClose, items }: { open: boolean; onClose: () => void; items: NavItem[] }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  const link = (to: string, label: string, hint: string, icon?: ReactNode, nested?: boolean) => (
    <NavLink
      key={to}
      to={to}
      className={({ isActive }) =>
        cx('vx-press vx-focus flex items-center gap-3 rounded-md px-3 py-2.5', nested && 'pl-10', isActive ? 'bg-surface-3 text-ink' : 'text-ink-2 hover:bg-surface-2')
      }
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-medium leading-tight">{label}</span>
        <span className="mt-0.5 block truncate text-2xs text-muted">{hint}</span>
      </span>
    </NavLink>
  )
  return (
    <div className="vx-no-print fixed inset-0 overscroll-contain bg-scrim/70 lg:hidden" style={{ zIndex: 'var(--z-modal)' }} role="dialog" aria-modal="true" aria-label="Modules">
      <button className="absolute inset-0 cursor-default" aria-label="Close menu" onClick={onClose} />
      <div className="vx-anim-pop relative m-3 max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-lg border border-rule-2 bg-surface">
        <div className="flex items-center justify-between border-b border-rule px-4 py-3">
          <span className="vx-smallcaps text-ink">Vertex ERP</span>
          <IconButton label="Close menu" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <nav aria-label="Modules" className="p-2">
          {items.map((item) =>
            item.children ? (
              <div key={item.to}>
                <p className="flex items-center gap-3 px-3 pb-1 pt-2 text-base font-medium text-ink">
                  <item.icon className="h-[18px] w-[18px] text-faint" aria-hidden="true" />
                  {item.label}
                </p>
                {item.children.map((c) => link(c.to, c.label, c.hint, undefined, true))}
              </div>
            ) : (
              link(item.to, item.label, item.hint, <item.icon className="h-[18px] w-[18px] shrink-0 text-faint" aria-hidden="true" />)
            ),
          )}
        </nav>
      </div>
    </div>
  )
}

/* ---------------------------- Utility cluster ----------------------------- */

function UtilityCluster({
  onMenu,
  scopeLabel,
  open,
  onLogout,
}: {
  onMenu: () => void
  scopeLabel: string
  open: (d: Dialog) => void
  onLogout: () => void
}) {
  const { user, db, run, can, storageMode, pushToast } = useStore()
  const [bellOpen, setBellOpen] = useState(false)

  const exportData = async () => {
    try {
      if (storageMode === 'server') {
        const r = await remote.exportData()
        if (!r.body.ok) throw new Error(r.body.error)
        downloadJson({ format: EXPORT_FORMAT, exportedAt: new Date().toISOString(), source: 'server', revision: r.body.revision, summary: summariseDataset(r.body.db), db: r.body.db })
      } else {
        downloadJson(browserExport(window.localStorage))
      }
      pushToast({ title: 'Data exported', message: storageMode === 'server' ? 'Server dataset downloaded (without password hashes).' : 'Browser dataset downloaded, including account password hashes — keep the file private.', level: 'success' })
    } catch (err) {
      pushToast({ title: 'Export failed', message: err instanceof Error ? err.message : String(err), level: 'danger' })
    }
  }
  const [profileOpen, setProfileOpen] = useState(false)
  const [clock, setClock] = useState(() => new Date())
  const bellRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = window.setInterval(() => setClock(new Date()), 30_000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false)
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setBellOpen(false)
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  // Alerts follow the same permission table as the modules they come from.
  const visible = (n: { audience: string; unitId?: string; topic?: string }) =>
    isVisibleTo(n as Parameters<typeof isVisibleTo>[0], user)
  const list = useMemo(() => notificationsFor(db.notifications, user), [db.notifications, user])
  const unread = list.filter((n) => !n.read).length

  const levelIcon = {
    info: <Info className="h-4 w-4 text-live" aria-label="Information" />,
    success: <Check className="h-4 w-4 text-ok" aria-label="Success" />,
    warn: <AlertTriangle className="h-4 w-4 text-warn" aria-label="Warning" />,
    danger: <AlertTriangle className="h-4 w-4 text-risk" aria-label="Alert" />,
  }

  const menuItem = (label: string, icon: ReactNode, onClick: () => void, danger?: boolean) => (
    <button
      type="button"
      onClick={() => {
        setProfileOpen(false)
        onClick()
      }}
      className={cx(
        'vx-press vx-focus flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-base font-medium',
        danger ? 'text-risk hover:bg-risk-wash' : 'text-ink-2 hover:bg-surface-2',
      )}
    >
      {icon}
      {label}
    </button>
  )

  return (
    <div className="vx-no-print fixed inset-x-3 top-3 flex items-center gap-2 lg:inset-x-auto lg:right-5 lg:top-4" style={{ zIndex: 'var(--z-sticky)' }}>
      <div className="flex items-center gap-2 rounded-full border border-rule-2 bg-surface/85 p-1 backdrop-blur-xl lg:hidden">
        <IconButton label="Open menu" onClick={onMenu} className="rounded-full">
          <Menu className="h-[18px] w-[18px]" />
        </IconButton>
        <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-accent" aria-hidden="true">
          <span className="font-display text-sm font-bold leading-none text-accent-ink">V</span>
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1 rounded-full border border-rule-2 bg-surface/85 p-1 backdrop-blur-xl" style={{ boxShadow: 'var(--shadow-pop)' }}>
        <span className="hidden items-center gap-2 rounded-full px-3 py-1 2xl:flex">
          <Clock className="h-3.5 w-3.5 text-faint" aria-hidden="true" />
          <span className="vx-code text-sm font-medium text-ink">{format(clock, 'EEE dd MMM')}</span>
          <span className="vx-code text-sm text-muted">{format(clock, 'HH:mm')}</span>
          <span className="inline-flex items-center gap-1 font-mono text-2xs uppercase tracking-[0.08em] text-ok">
            <CircleDot className="h-3 w-3" aria-hidden="true" />
            {currentShift(clock)}
          </span>
        </span>

        {can('planning') ? (
          <Button size="sm" variant="ghost" icon={<ListChecks className="h-4 w-4" />} onClick={() => open('guide')} className="rounded-full" aria-label="Workflow guide">
            <span className="hidden sm:inline">Guide</span>
          </Button>
        ) : null}

        <span className="hidden items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-2xs uppercase tracking-[0.06em] text-accent-text md:inline-flex">
          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
          {scopeLabel}
        </span>

        <div className="relative" ref={bellRef}>
          <button
            type="button"
            onClick={() => setBellOpen((v) => !v)}
            aria-label={`Notifications, ${unread} unread`}
            aria-expanded={bellOpen}
            className={cx('vx-press vx-focus relative flex h-9 w-9 items-center justify-center rounded-full text-muted', bellOpen ? 'bg-surface-3 text-ink' : 'hover:bg-surface-2 hover:text-ink')}
          >
            <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
            {unread > 0 ? (
              <span className="vx-alert-dot vx-code absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-risk px-1 text-2xs font-medium text-canvas" aria-hidden="true">
                {unread > 99 ? '99+' : unread}
              </span>
            ) : null}
          </button>
          {bellOpen ? (
            <div className="vx-anim-pop absolute right-0 top-11 w-[min(92vw,420px)] overflow-hidden rounded-lg border border-rule-2 bg-surface" style={{ zIndex: 'var(--z-dropdown)', boxShadow: 'var(--shadow-pop)' }}>
              <div className="flex items-center justify-between border-b border-rule px-4 py-3">
                <div>
                  <p className="vx-smallcaps text-ink">Notifications</p>
                  <p className="mt-0.5 text-xs text-muted">{unread} unread</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => run(markNotificationsRead('all', visible))}>
                  Mark all read
                </Button>
              </div>
              <div className="max-h-[min(60vh,420px)] overflow-y-auto overscroll-contain">
                {list.length === 0 ? (
                  <p className="px-4 py-8 text-center text-base text-muted">Nothing to report.</p>
                ) : (
                  list.slice(0, 80).map((n) => (
                    <button
                      type="button"
                      key={n.id}
                      onClick={() => run(markNotificationsRead([n.id], visible))}
                      className={cx('vx-press flex w-full items-start gap-3 border-b border-rule px-4 py-3 text-left last:border-b-0 hover:bg-surface-2', !n.read && 'bg-accent-wash')}
                    >
                      <span className="mt-0.5 shrink-0">{levelIcon[n.level]}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-medium text-ink">{n.title}</span>
                        <span className="mt-0.5 block break-words text-sm leading-snug text-muted">{n.message}</span>
                        <span className="mt-1 block text-2xs text-faint">{fromNow(n.createdAt)}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
              {list.length > 0 ? (
                <div className="border-t border-rule px-4 py-2">
                  <Button size="sm" variant="ghost" onClick={() => run(clearNotifications(visible))}>
                    Clear all
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen((v) => !v)}
            aria-label={`Account — ${user?.name ?? ''}`}
            aria-expanded={profileOpen}
            className={cx('vx-press vx-focus flex items-center gap-2 rounded-full p-0.5 pr-1', profileOpen && 'bg-surface-3')}
          >
            <span className="vx-code flex h-8 w-8 items-center justify-center rounded-full bg-accent-wash text-sm font-medium text-accent-text ring-1 ring-inset ring-accent-edge">
              {user?.initials}
            </span>
          </button>
          {profileOpen ? (
            <div className="vx-anim-pop absolute right-0 top-11 w-72 overflow-hidden rounded-lg border border-rule-2 bg-surface" style={{ zIndex: 'var(--z-dropdown)', boxShadow: 'var(--shadow-pop)' }}>
              <div className="border-b border-rule px-4 py-3">
                <p className="truncate text-base font-semibold text-ink">{user?.name}</p>
                <p className="truncate text-xs text-muted">{user?.email}</p>
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent-wash px-2 py-0.5 font-mono text-2xs uppercase tracking-[0.06em] text-accent-text ring-1 ring-inset ring-accent-edge">
                  {user?.designation}
                </p>
                <p className="mt-1.5 text-2xs text-muted">{describeAccess(user)}</p>
              </div>
              <div className="border-b border-rule py-1">
                {/* Every account keeps its own personal actions. */}
                {menuItem('My account', <UserCog className="h-4 w-4 text-faint" aria-hidden="true" />, () => open('account'))}
                {can('administration') ? (
                  <>
                    {menuItem('Company profile…', <Building2 className="h-4 w-4 text-faint" aria-hidden="true" />, () => open('company'))}
                    {menuItem('Units, people & machines', <Wrench className="h-4 w-4 text-faint" aria-hidden="true" />, () => open('resources'))}
                    {menuItem('Activity log', <ScrollText className="h-4 w-4 text-faint" aria-hidden="true" />, () => open('audit'))}
                    {menuItem('Accounts', <Users className="h-4 w-4 text-faint" aria-hidden="true" />, () => open('account'))}
                    {menuItem('Export data (JSON)', <Download className="h-4 w-4 text-faint" aria-hidden="true" />, () => void exportData())}
                    {menuItem('Clear business data…', <RotateCcw className="h-4 w-4 text-faint" aria-hidden="true" />, () => open('clear'))}
                  </>
                ) : null}
              </div>
              {menuItem('Sign out', <LogOut className="h-4 w-4" aria-hidden="true" />, onLogout, true)}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
