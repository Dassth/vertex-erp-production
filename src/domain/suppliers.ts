import type { Supplier, VertexDB } from '../lib/types'
import { isValidGstin } from '../lib/billing'
import type { Ctx } from './common'
import { audit, command, docCode, fail, hasFieldErrors, nextSeq, ok, requireCapability, sameText, stampNew, stampUpdate, staleRecord, validationFailure } from './common'
import type { Op } from './common'

/* ---------------------------------------------------------------------------
 * Suppliers: who sells us materials and how to reach them. Only the name is
 * required — the rest can be filled any time. A supplier named on a material
 * or a purchase bill is added here by itself, so it is never typed twice.
 * ------------------------------------------------------------------------- */

export interface SupplierDraft {
  id: string
  name: string
  contactPerson: string
  phone: string
  email: string
  address: string
  gstin: string
  notes: string
  expectedUpdatedAt?: string | null
}

export const blankSupplier = (name = ''): SupplierDraft => ({ id: '', name, contactPerson: '', phone: '', email: '', address: '', gstin: '', notes: '' })

export function validateSupplier(d: SupplierDraft, suppliers: Supplier[]): Record<string, string> {
  const e: Record<string, string> = {}
  if (!d.name.trim()) e.name = 'Enter the supplier name.'
  else if (suppliers.some((s) => s.id !== d.id && sameText(s.name, d.name))) e.name = 'A supplier with this name already exists.'
  if (d.gstin.trim() && !isValidGstin(d.gstin.trim().toUpperCase())) e.gstin = 'A GSTIN has 15 characters and starts with the 2-digit state code.'
  if (d.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) e.email = 'Enter an email like name@company.com.'
  return e
}

const fieldsOf = (d: SupplierDraft) => ({
  name: d.name.trim(),
  contactPerson: d.contactPerson.trim(),
  phone: d.phone.trim(),
  email: d.email.trim(),
  address: d.address.trim(),
  gstin: d.gstin.trim().toUpperCase(),
  notes: d.notes.trim(),
})

export const saveSupplier = command(
  'saveSupplier',
  (draft: SupplierDraft): Op<Supplier> =>
    (db, ctx) => {
      const denied = requireCapability(ctx, 'master')
      if (denied) return denied
      const list = db.suppliers ?? []
      const current = draft.id ? list.find((s) => s.id === draft.id) : undefined
      if (draft.id && !current) return fail('This supplier no longer exists.')
      const errors = validateSupplier(draft, list)
      if (hasFieldErrors(errors)) return validationFailure(errors)
      if (current) {
        const stale = staleRecord(current.name, current, draft.expectedUpdatedAt)
        if (stale) return stale
        const updated: Supplier = stampUpdate({ ...current, ...fieldsOf(draft) }, ctx)
        let next: VertexDB = { ...db, suppliers: list.map((s) => (s.id === current.id ? updated : s)) }
        // A renamed supplier stays linked to its materials.
        if (updated.name !== current.name)
          next = { ...next, materials: next.materials.map((m) => (sameText(m.supplier, current.name) ? { ...m, supplier: updated.name } : m)) }
        next = audit(next, ctx, { action: 'Supplier edited', entity: 'Supplier', entityId: updated.id, entityLabel: `${updated.code} — ${updated.name}` })
        return ok(next, updated)
      }
      const [counted, s] = addSupplier(db, ctx, fieldsOf(draft))
      return ok(audit(counted, ctx, { action: 'Supplier added', entity: 'Supplier', entityId: s.id, entityLabel: `${s.code} — ${s.name}` }), s)
    },
)

export const setSupplierActive = command(
  'setSupplierActive',
  (id: string, active: boolean): Op<Supplier> =>
    (db, ctx) => {
      const denied = requireCapability(ctx, 'master')
      if (denied) return denied
      const current = (db.suppliers ?? []).find((s) => s.id === id)
      if (!current) return fail('This supplier no longer exists.')
      const updated = stampUpdate({ ...current, active }, ctx)
      const next = audit({ ...db, suppliers: db.suppliers.map((s) => (s.id === id ? updated : s)) }, ctx, {
        action: active ? 'Supplier reactivated' : 'Supplier deactivated',
        entity: 'Supplier',
        entityId: id,
        entityLabel: `${current.code} — ${current.name}`,
      })
      return ok(next, updated)
    },
)

function addSupplier(db: VertexDB, ctx: Ctx, fields: ReturnType<typeof fieldsOf>): [VertexDB, Supplier] {
  const [counted, seq] = nextSeq(db, 'supplier')
  const supplier: Supplier = { id: ctx.newId('SUP'), code: docCode('SUP', seq), ...fields, active: true, ...stampNew(ctx) }
  return [{ ...counted, suppliers: [...(counted.suppliers ?? []), supplier] }, supplier]
}

/**
 * A supplier named on a material or a purchase bill: added to the list when
 * new; an existing one only has its empty GSTIN / address filled.
 */
export function rememberSupplier(db: VertexDB, ctx: Ctx, name: string, extra: { gstin?: string; address?: string } = {}): VertexDB {
  const n = name.trim()
  if (!n) return db
  const list = db.suppliers ?? []
  const found = list.find((s) => sameText(s.name, n))
  if (!found) return addSupplier(db, ctx, { ...fieldsOf(blankSupplier(n)), gstin: (extra.gstin ?? '').trim().toUpperCase(), address: (extra.address ?? '').trim() })[0]
  const gstin = !found.gstin && extra.gstin?.trim() ? extra.gstin.trim().toUpperCase() : found.gstin
  const address = !found.address && extra.address?.trim() ? extra.address.trim() : found.address
  if (gstin === found.gstin && address === found.address) return db
  return { ...db, suppliers: list.map((s) => (s.id === found.id ? { ...s, gstin, address } : s)) }
}
