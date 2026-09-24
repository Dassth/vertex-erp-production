import { useMemo, useRef, useState } from 'react'
import { POWERED_BY } from '../lib/brand'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Calculator,
  CalendarRange,
  Database,
  Eye,
  EyeOff,
  Factory,
  KeyRound,
  Lock,
  ReceiptText,
  ShieldCheck,
  Truck,
} from 'lucide-react'
import { format } from 'date-fns'
import { useStore } from '../store/store'
import { Button, Field, Input } from '../components/ui'
import { useDocumentTitle } from '../components/page'
import { MIN_PASSWORD_LENGTH } from '../lib/auth'
import { cx } from '../lib/format'

const MODULES = [
  { icon: Database, label: 'Master', detail: 'Products, material prices and customers — defined once', span: true },
  { icon: CalendarRange, label: 'Planning', detail: 'Order, quantity and a unit for every stage' },
  { icon: Calculator, label: 'Costing', detail: 'Yield, cost, profit and final price' },
  { icon: Factory, label: 'Production', detail: 'Stage work per unit, live progress' },
  { icon: Truck, label: 'Dispatch', detail: 'Full or partial shipments' },
  { icon: ReceiptText, label: 'Billing', detail: 'An invoice for every dispatch, as PDF', span: true },
]

export function LoginPage() {
  useDocumentTitle('Sign in')
  const { db, signIn, createFirstPassword, pushToast, storageMode } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const accounts = useMemo(() => db.users.filter((u) => u.active), [db.users])
  const [userId, setUserId] = useState(accounts[0]?.id ?? '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const passwordRef = useRef<HTMLInputElement>(null)

  const selected = accounts.find((u) => u.id === userId)
  const firstTime = !!selected && !selected.passwordHash

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected || busy) return
    setError('')
    setBusy(true)
    const res = firstTime ? await createFirstPassword(selected.id, password, confirm) : await signIn(selected.id, password)
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      passwordRef.current?.focus()
      return
    }
    pushToast({ title: `Signed in as ${res.user.name}`, level: 'success' })
    const from = (location.state as { from?: string } | null)?.from
    navigate(from && from !== '/login' ? from : '/production', { replace: true })
  }

  const groups = [{ title: 'Administrators', list: accounts.filter((u) => u.role === 'admin') }]

  return (
    <div className="flex min-h-[100dvh] bg-paper">
      <div className="relative hidden w-[46%] max-w-2xl flex-col justify-between border-r border-rule bg-canvas p-10 text-ink lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-accent">
            <span className="font-display text-lg font-bold text-accent-ink">V</span>
          </div>
          <div>
            <p className="font-display text-lg font-semibold tracking-tight" translate="no">
              Vertex ERP
            </p>
            <p className="vx-eyebrow text-accent-text">{db.company.name}</p>
          </div>
        </div>

        <div className="max-w-lg">
          <h1 className="font-display text-3xl font-semibold leading-[1.05] tracking-display">
            From product master to invoice, in order.
          </h1>
          <p className="mt-4 max-w-[52ch] text-md leading-relaxed text-muted">
            Define products and prices once, plan each order stage by stage, finalize its costing, follow it through
            the units, then dispatch and bill — fully or in parts.
          </p>
          <dl className="mt-9 grid gap-2.5 sm:grid-cols-2">
            {MODULES.map((f) => (
              <div key={f.label} className={cx('vx-tile min-w-0 px-4 py-3', f.span && 'sm:col-span-2')}>
                <dt className="flex items-center gap-2.5">
                  <f.icon className="h-4 w-4 shrink-0 text-accent-text" aria-hidden="true" />
                  <span className="vx-smallcaps text-ink">{f.label}</span>
                </dt>
                <dd className="mt-1.5 text-sm leading-snug text-muted">{f.detail}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="vx-code text-2xs text-faint">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-surface px-5 py-10 sm:px-10">
        <div className="vx-anim-up w-full max-w-[440px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent">
              <span className="font-display text-md font-bold text-accent-ink">V</span>
            </div>
            <p className="font-display text-md font-semibold tracking-tight text-ink" translate="no">
              Vertex ERP
            </p>
          </div>

          <h2 className="font-display text-xl font-semibold tracking-headline text-ink">Sign in</h2>
          <p className="mt-1.5 text-base text-muted">Choose your account. Each account is recorded separately in the activity log.</p>

          <form onSubmit={submit} className="mt-6 space-y-5" noValidate>
            <fieldset>
              <legend className="vx-label">Account</legend>
              <div className="space-y-4">
                {groups.map((g) => (
                  <div key={g.title}>
                    <p className="mb-1.5 text-xs font-medium text-muted">{g.title}</p>
                    <div className="grid gap-1.5 sm:grid-cols-2" role="radiogroup" aria-label={g.title}>
                      {g.list.map((u) => (
                        <label
                          key={u.id}
                          className={cx(
                            'vx-press flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus',
                            userId === u.id ? 'border-accent bg-accent-wash' : 'border-rule hover:border-rule-2 hover:bg-surface-2',
                          )}
                        >
                          <input
                            type="radio"
                            name="account"
                            value={u.id}
                            checked={userId === u.id}
                            onChange={() => {
                              setUserId(u.id)
                              setPassword('')
                              setConfirm('')
                              setError('')
                            }}
                            className="sr-only"
                          />
                          <span
                            className={cx(
                              'vx-code flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border text-sm font-medium',
                              userId === u.id ? 'border-accent-edge bg-surface text-accent-text' : 'border-rule-2 bg-surface-2 text-muted',
                            )}
                            aria-hidden="true"
                          >
                            {u.initials}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-ink">{u.name}</span>
                            <span className="block truncate text-2xs text-muted">{u.passwordHash ? u.email : 'Password not set'}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>

            {firstTime ? (
              <p className="flex gap-2 rounded-md bg-accent-wash px-3.5 py-3 text-sm leading-relaxed text-accent-text ring-1 ring-inset ring-accent-edge">
                <KeyRound className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                First sign-in for {selected?.name}. Choose a password of at least {MIN_PASSWORD_LENGTH} characters — it is
                stored only as a hash in this browser.
              </p>
            ) : null}

            <Field label={firstTime ? 'New password' : 'Password'} required>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden="true" />
                <Input
                  ref={passwordRef}
                  type={show ? 'text' : 'password'}
                  name="password"
                  autoComplete={firstTime ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={!!error || undefined}
                  className="pl-10 pr-11"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                  className="vx-press vx-focus absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-faint hover:bg-surface-3 hover:text-ink-2"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            {firstTime ? (
              <Field label="Confirm password" required>
                <Input type={show ? 'text' : 'password'} name="confirm-password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </Field>
            ) : null}

            {error ? (
              <p role="alert" className="rounded-sm bg-risk-wash px-3.5 py-2.5 text-base font-medium text-risk ring-1 ring-inset ring-risk-edge">
                {error}
              </p>
            ) : null}

            <Button type="submit" size="lg" block loading={busy} icon={<ArrowRight className="h-4 w-4" />}>
              {firstTime ? 'Create password & sign in' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-6 flex gap-2 text-xs leading-relaxed text-muted">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {storageMode === 'server'
              ? 'Accounts and data are stored on the Vertex server. Passwords are checked by the server.'
              : 'Accounts and data are stored in this browser only. They are not shared with other computers.'}
          </p>

          <p className="mt-6 select-none border-t border-rule pt-4 text-center text-[9px] uppercase leading-none tracking-[0.22em] text-faint/45" translate="no">
            {POWERED_BY}
          </p>
        </div>
      </div>
    </div>
  )
}
