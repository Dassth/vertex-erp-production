/* ---------------------------------------------------------------------------
 * Dataset export — the first step of any migration and a manual backup.
 *
 * Browser mode exports the stored database exactly, INCLUDING account password
 * hashes, so accounts can be moved to the server unchanged. Treat the file as
 * sensitive. Server mode exports without hashes (server backups hold those).
 * ------------------------------------------------------------------------- */

import type { VertexDB } from './types'
import { DB_KEY, parseStoredDB } from './db'

export const EXPORT_FORMAT = 'vertex-erp-export-v1'

export interface ExportFile {
  format: typeof EXPORT_FORMAT
  exportedAt: string
  source: 'browser' | 'server'
  revision: number | null
  summary: Record<string, number>
  db: VertexDB
  drafts?: { key: string; value: string }[]
}

export function summariseDataset(db: VertexDB): Record<string, number> {
  return {
    users: db.users.length,
    products: db.products.length,
    materials: db.materials.length,
    customers: db.customers.length,
    plans: db.plans.length,
    costings: db.costings.length,
    orders: db.orders.length,
    dispatches: db.dispatches.length,
    invoices: db.invoices.length,
  }
}

/** Read the committed browser dataset straight from storage (not from screen state). */
export function browserExport(storage: Storage, now = new Date()): ExportFile {
  const raw = storage.getItem(DB_KEY)
  // Validate with the normal loader, but export the stored JSON unchanged.
  const checked = parseStoredDB(raw)
  if (!raw || !checked) throw new Error('No readable dataset is stored in this browser.')
  const db = JSON.parse(raw) as VertexDB
  
  const drafts: { key: string; value: string }[] = []
  try {
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i)
      if (k?.startsWith('vertex-erp-draft-v1:')) {
        const v = storage.getItem(k)
        if (v) drafts.push({ key: k, value: v })
      }
    }
  } catch {
    /* ignore storage errors when iterating */
  }
  
  return { format: EXPORT_FORMAT, exportedAt: now.toISOString(), source: 'browser', revision: null, summary: summariseDataset(checked), db, drafts }
}

export function downloadJson(file: ExportFile) {
  const blob = new Blob([JSON.stringify(file, null, 1)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `vertex-erp-${file.source}-export-${file.exportedAt.replace(/[:.]/g, '-')}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
