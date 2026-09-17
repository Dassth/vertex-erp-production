import { useEffect, useRef, useState } from 'react'
import { Building2, KeyRound, RotateCcw, UserCog } from 'lucide-react'
import { useStore } from '../store/store'
import { CLEAR_CONFIRMATION, clearBusinessData, resetPassword, saveCompanyProfile, updateDisplayName, validateCompany } from '../domain/system'
import type { CompanyDraft } from '../domain/system'
import { MIN_PASSWORD_LENGTH } from '../lib/auth'
import { fmtDateTime } from '../lib/format'
import { Badge, Button, ConfirmDialog, Field, Input, Modal, Textarea } from './ui'
import { ConflictNotice, focusFirstInvalid } from './page'

/* ----------------------------- Company profile ---------------------------- */

export function CompanyProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { can } = useStore()
  // Only Administrator 1 may edit the company identity; the domain op enforces the same rule.
  if (!can('administration')) return null
  return <CompanyProfileEditor open={open} onClose={onClose} />
}

const COMPANY_FORM_ID = 'company-profile-form'

function CompanyProfileEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, run, pushToast } = useStore()
  const [draft, setDraft] = useState<CompanyDraft>(() => ({ ...db.company }))
  const [baseUpdatedAt, setBaseUpdatedAt] = useState(db.company.updatedAt)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [conflict, setConflict] = useState('')
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)

  const loadLatest = () => {
    setDraft({ ...db.company })
    setBaseUpdatedAt(db.company.updatedAt)
    setErrors({})
    setConflict('')
    setFormError('')
  }

  useEffect(() => {
    if (open) loadLatest()
    // Only reset when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const set = (patch: Partial<CompanyDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const showFieldErrors = (fieldErrors: Record<string, string>) => {
    setErrors(fieldErrors)
    focusFirstInvalid(formRef.current)
  }

  const save = async () => {
    if (submitting.current) return
    setConflict('')
    setFormError('')
    // Check locally first so errors appear beside the fields and entered values stay.
    const local = validateCompany(draft)
    if (Object.keys(local).length) return showFieldErrors(local)
    setErrors({})
    submitting.current = true
    setBusy(true)
    try {
      const r = await run(saveCompanyProfile({ ...draft, expectedUpdatedAt: baseUpdatedAt }))
      if (!r.ok) {
        if (r.conflict) setConflict(r.error)
        else if (r.fieldErrors && Object.keys(r.fieldErrors).length) showFieldErrors(r.fieldErrors)
        else {
          setFormError(r.error)
          pushToast({ title: 'Company details not saved', message: r.error, level: 'danger' })
        }
        return
      }
      pushToast({ title: 'Company details saved', message: 'New invoices will use these details. Issued invoices keep their original details.', level: 'success' })
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setFormError(`Unexpected error — nothing was saved. ${message}`)
      pushToast({ title: 'Company details not saved', message, level: 'danger' })
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      pinnedFooter
      title="Company profile"
      subtitle="Identity printed on invoices and order statements"
      icon={<Building2 className="h-5 w-5" />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={COMPANY_FORM_ID} loading={busy}>
            Save company details
          </Button>
        </>
      }
    >
      {conflict ? <ConflictNotice message={conflict} onReload={loadLatest} /> : null}
      {formError ? (
        <p role="alert" className="mb-4 rounded-md bg-risk-wash px-3 py-2 text-sm text-risk ring-1 ring-inset ring-risk-edge">
          {formError}
        </p>
      ) : null}
      <form
        id={COMPANY_FORM_ID}
        ref={formRef}
        noValidate
        className="grid gap-x-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Field label="Company name" required error={errors.name} className="sm:col-span-2">
          <Input name="organization" autoComplete="organization" value={draft.name} onChange={(e) => set({ name: e.target.value })} aria-invalid={!!errors.name || undefined} />
        </Field>
        <Field label="Address" hint="Required before the first invoice." className="sm:col-span-2">
          <Textarea rows={3} name="street-address" autoComplete="street-address" value={draft.address} onChange={(e) => set({ address: e.target.value })} />
        </Field>
        <Field label="Phone">
          <Input type="tel" name="tel" autoComplete="tel" value={draft.phone} onChange={(e) => set({ phone: e.target.value })} />
        </Field>
        <Field label="Email" error={errors.email}>
          <Input type="email" name="email" autoComplete="email" spellCheck={false} value={draft.email} onChange={(e) => set({ email: e.target.value })} aria-invalid={!!errors.email || undefined} />
        </Field>
        <Field label="GSTIN" error={errors.gstin} hint="15 characters, e.g. 33AAACV1234C1ZW. Required when tax is charged.">
          <Input name="gstin" spellCheck={false} autoComplete="off" maxLength={15} value={draft.gstin} onChange={(e) => set({ gstin: e.target.value.toUpperCase() })} aria-invalid={!!errors.gstin || undefined} />
        </Field>
        <Field label="Invoice number prefix" error={errors.invoicePrefix} hint="INV → INV/2026-27/0001">
          <Input name="invoice-prefix" spellCheck={false} value={draft.invoicePrefix} onChange={(e) => set({ invoicePrefix: e.target.value })} aria-invalid={!!errors.invoicePrefix || undefined} />
        </Field>
        <Field label="Bank details" className="sm:col-span-2">
          <Textarea rows={2} value={draft.bankDetails} onChange={(e) => set({ bankDetails: e.target.value })} placeholder="Account name, number, IFSC…" />
        </Field>
        <Field label="Invoice terms" className="sm:col-span-2">
          <Textarea rows={2} value={draft.invoiceTerms} onChange={(e) => set({ invoiceTerms: e.target.value })} />
        </Field>
      </form>
      {db.company.updatedAt ? (
        <p className="text-xs text-muted">
          Last updated {fmtDateTime(db.company.updatedAt)} by {db.company.updatedBy}
        </p>
      ) : null}
    </Modal>
  )
}

/* ------------------------------ Account dialog ---------------------------- */

export function AccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, user, run, changePassword, pushToast, can } = useStore()
  const [name, setName] = useState(user?.name ?? '')
  const [nameError, setNameError] = useState('')
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [pwError, setPwError] = useState('')
  const [busy, setBusy] = useState(false)
  const [resetId, setResetId] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(user?.name ?? '')
      setNameError('')
      setPw({ current: '', next: '', confirm: '' })
      setPwError('')
    }
  }, [open, user?.name])

  if (!user) return null
  const target = db.users.find((u) => u.id === resetId)
  const unitName = (id: string | null) => db.units.find((u) => u.id === id)?.shortName ?? '—'

  return (
    <>
      <Modal open={open} onClose={onClose} title="Accounts" subtitle="Your identity and password" icon={<UserCog className="h-5 w-5" />} size="lg">
        <div className="grid gap-6 md:grid-cols-2">
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              const r = await run(updateDisplayName(name))
              if (!r.ok) setNameError(r.fieldErrors?.name ?? r.error)
              else {
                setNameError('')
                pushToast({ title: 'Display name updated', message: 'New activity is recorded under this name.', level: 'success' })
              }
            }}
          >
            <h3 className="vx-smallcaps text-ink">Display name</h3>
            <p className="mt-1 text-sm text-muted">Shown in the activity log for every action you take.</p>
            <Field label="Name" error={nameError} className="mt-3">
              <Input name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!nameError || undefined} />
            </Field>
            <Button type="submit" variant="secondary">
              Save name
            </Button>
          </form>

          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setBusy(true)
              const r = await changePassword(pw.current, pw.next, pw.confirm)
              setBusy(false)
              if (!r.ok) setPwError(r.error ?? 'Could not change password.')
              else {
                setPwError('')
                setPw({ current: '', next: '', confirm: '' })
                pushToast({ title: 'Password changed', level: 'success' })
              }
            }}
          >
            <h3 className="vx-smallcaps text-ink">Change password</h3>
            <input type="text" name="username" autoComplete="username" value={user.email} readOnly hidden />
            <Field label="Current password" className="mt-3">
              <Input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
            </Field>
            <Field label="New password" hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}>
              <Input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
            </Field>
            <Field label="Confirm new password" error={pwError}>
              <Input type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} aria-invalid={!!pwError || undefined} />
            </Field>
            <Button type="submit" variant="secondary" loading={busy} icon={<KeyRound className="h-4 w-4" />}>
              Change password
            </Button>
          </form>
        </div>

        {/* Account administration belongs to the administration capability, not to
            every administrator: the other tiers see only their own identity above. */}
        {can('administration') ? (
          <div className="mt-6 border-t border-rule pt-5">
            <h3 className="vx-smallcaps text-ink">All accounts</h3>
            <p className="mt-1 text-sm text-muted">
              Administrators hold different access: Administrator 1 runs the whole workflow, Administrator 2 monitors production and
              operates dispatch and billing, Administrator 3 sees billing only. Unit users update only the processes allocated to their unit.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr>
                    <th className="vx-th">Account</th>
                    <th className="vx-th">Role</th>
                    <th className="vx-th">Password</th>
                    <th className="vx-th text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {db.users.map((u) => (
                    <tr key={u.id} className="vx-row">
                      <td className="vx-td">
                        <span className="block font-medium text-ink">{u.name}</span>
                        <span className="block text-2xs text-muted">{u.email}</span>
                      </td>
                      <td className="vx-td">{u.role === 'admin' ? 'Administrator' : `Unit user · ${unitName(u.unitId)}`}</td>
                      <td className="vx-td">{u.passwordHash ? <Badge tone="green" dot>Set</Badge> : <Badge tone="amber" dot>Not set</Badge>}</td>
                      <td className="vx-td text-right">
                        {u.id !== user.id && u.passwordHash ? (
                          <Button size="sm" variant="ghost" onClick={() => setResetId(u.id)}>
                            Reset password…
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={!!target}
        tone="danger"
        title={`Reset password for ${target?.name ?? ''}?`}
        body="Their current password stops working immediately. They will choose a new one at their next sign-in. The reset is recorded in the activity log."
        confirmLabel="Reset password"
        onCancel={() => setResetId(null)}
        onConfirm={async () => {
          if (target) {
            const r = await run(resetPassword(target.id))
            pushToast(r.ok ? { title: 'Password reset', level: 'success' } : { title: 'Could not reset', message: r.error, level: 'danger' })
          }
          setResetId(null)
        }}
      />
    </>
  )
}

/* --------------------------- Clear business data -------------------------- */

export function ClearDataDialog({ open, onClose, onCleared }: { open: boolean; onClose: () => void; onCleared: () => void }) {
  const { db, run, pushToast } = useStore()
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    if (open) {
      setText('')
      setError('')
    }
  }, [open])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Clear business data"
      size="sm"
      icon={<RotateCcw className="h-5 w-5" />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              const r = await run(clearBusinessData(text))
              if (!r.ok) {
                setError(r.error)
                return
              }
              pushToast({ title: 'Business data cleared', message: 'Master data and all documents were removed. Nothing was re-seeded.', level: 'warn' })
              onCleared()
            }}
          >
            Clear permanently
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm leading-relaxed text-ink-2">
        <p>
          Removes {db.products.length} products, {db.materials.length} materials, {db.customers.length} customers, {db.plans.length} plans,{' '}
          {db.orders.length} production orders, {db.dispatches.length} dispatches and {db.invoices.length} invoices from this browser.
        </p>
        <p>Accounts, the company profile, costing defaults, the activity log and document number counters are kept, so invoice numbers are never reused. No sample data is restored.</p>
        <Field label={`Type ${CLEAR_CONFIRMATION} to confirm`} error={error}>
          <Input value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} autoComplete="off" aria-invalid={!!error || undefined} />
        </Field>
      </div>
    </Modal>
  )
}
