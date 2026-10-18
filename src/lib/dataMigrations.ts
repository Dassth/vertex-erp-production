/* ---------------------------------------------------------------------------
 * Data migrations that change saved records. Each runs once (recorded in
 * `db.migrations`), never deletes anything, and writes what it changed to the
 * Activity log. On the installed server a backup is taken before the first
 * start of a new version saves them (server/serve.ts).
 *
 *   gst-state-split-v1
 *     • company State filled from its GSTIN (else a state named in its address);
 *     • each customer's Place of supply stored as the 2-digit GST state code
 *       ("Tamil Nadu", "tamilnadu", "TN", "33" → 33); a registered customer's
 *       comes from the GSTIN; text that matches no state is kept as it is and
 *       the customer shows as "Incomplete details";
 *     • issued invoices whose CGST / SGST / IGST split was missing or wrong get
 *       only that split recomputed — quantity, rate, taxable value, tax and
 *       total stay exactly as issued. Invoices whose tax type was set by hand
 *       are left alone.
 * ------------------------------------------------------------------------- */

import type { AuditEntry, Invoice, VertexDB } from './types'
import { gstinState } from './billing'
import { buyerState, sellerState, splitRupees, stateInText, supplyBetween } from './gst'
import { stateCodeFrom, stateLabel } from './gstStates'

export const MIGRATION_GST_STATE_SPLIT = 'gst-state-split-v1'

/** Migrations not yet applied to this database. */
export function pendingDataMigrations(db: Pick<VertexDB, 'migrations'>): string[] {
  return [MIGRATION_GST_STATE_SPLIT].filter((m) => !(db.migrations ?? []).includes(m))
}

const rupees = (n: number | null) => (n === null ? '—' : n.toFixed(2))
const splitText = (i: Pick<Invoice, 'cgst' | 'sgst' | 'igst'>) =>
  i.igst !== null ? `IGST ${rupees(i.igst)}` : i.cgst !== null ? `CGST ${rupees(i.cgst)} + SGST ${rupees(i.sgst)}` : 'not split'

function entry(now: Date, n: number, action: string, entity: AuditEntry['entity'], entityId: string, entityLabel: string, extra: Partial<AuditEntry> = {}): AuditEntry {
  return { id: `aud-mig-gst-${now.getTime().toString(36)}-${n}`, at: now.toISOString(), userId: 'system', user: 'System (update)', role: 'system', action, entity, entityId, entityLabel, ...extra }
}

export function migrateGstStateSplit(db: VertexDB, now: Date = new Date()): VertexDB {
  if ((db.migrations ?? []).includes(MIGRATION_GST_STATE_SPLIT)) return db
  const log: AuditEntry[] = []
  let n = 0

  // Company State.
  const companyState = db.company.stateCode ? stateCodeFrom(db.company.stateCode) : (gstinState(db.company.gstin) ?? stateInText(db.company.address))
  const company = companyState && companyState !== db.company.stateCode ? { ...db.company, stateCode: companyState } : db.company
  if (company !== db.company) log.push(entry(now, n++, 'Company State set', 'System', 'company', db.company.name || 'Company', { field: 'State', newValue: stateLabel(companyState) }))

  // Customers' Place of supply as a state code.
  const customers = db.customers.map((c) => {
    const code = (c.unregistered ? null : gstinState(c.gstin)) ?? stateCodeFrom(c.placeOfSupply)
    if (!code || code === c.placeOfSupply) return c
    log.push(entry(now, n++, 'Place of supply set as a state code', 'Customer', c.id, `${c.code} — ${c.company}`, { field: 'Place of supply', oldValue: c.placeOfSupply || '(blank)', newValue: stateLabel(code) }))
    return { ...c, placeOfSupply: code }
  })

  // Issued invoices: only the split, only where it was missing or wrong.
  const invoices = db.invoices.map((inv) => {
    if (inv.editedAt || (inv.supplyType && inv.supplyType !== 'auto') || !(inv.taxAmount > 0)) return inv
    const live = customers.find((c) => c.id === inv.customer.id)
    const supply = supplyBetween(
      sellerState(inv.company) ?? sellerState(company),
      buyerState({ gstin: inv.customer.gstin, placeOfSupply: inv.customer.placeOfSupply || live?.placeOfSupply, deliveryAddress: inv.deliveryAddress }),
    )
    if (!supply) return inv
    const right = splitRupees(inv.taxAmount, supply)
    const sums = Math.round(((inv.cgst ?? 0) + (inv.sgst ?? 0) + (inv.igst ?? 0)) * 100) === Math.round(inv.taxAmount * 100)
    const ok = sums && (supply === 'inter' ? inv.igst !== null && inv.cgst === null : inv.cgst !== null && inv.sgst !== null && inv.igst === null)
    if (ok) return inv
    const fixed: Invoice = { ...inv, ...right, cgstPct: right.cgst === null ? null : inv.taxPct / 2, sgstPct: right.sgst === null ? null : inv.taxPct / 2 }
    log.push(
      entry(now, n++, 'Invoice GST split corrected', 'Invoice', inv.id, `${inv.number} — ${inv.customer.company}`, {
        field: 'GST split',
        oldValue: splitText(inv),
        newValue: `${splitText(fixed)} (taxable ${inv.taxableValue.toFixed(2)} and total ${inv.total.toFixed(2)} unchanged)`,
      }),
    )
    return fixed
  })

  // A database with nothing to change (e.g. a new one) just records that the step ran.
  if (log.length) log.push(entry(now, n++, 'Update applied', 'System', 'database', MIGRATION_GST_STATE_SPLIT, { newValue: `GST state codes and invoice tax split checked — ${log.length} change(s).` }))
  return {
    ...db,
    company,
    customers,
    invoices,
    audit: [...log.reverse(), ...db.audit],
    migrations: [...(db.migrations ?? []), MIGRATION_GST_STATE_SPLIT],
  }
}

/** Every data migration, in order. Idempotent. */
export function applyDataMigrations(db: VertexDB, now: Date = new Date()): VertexDB {
  return migrateGstStateSplit(db, now)
}
