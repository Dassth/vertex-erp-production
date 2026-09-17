/* ---------------------------------------------------------------------------
 * Client for the Vertex server API (server storage mode).
 *
 * Enabled at build time with VITE_VERTEX_STORAGE=server. VITE_VERTEX_API sets
 * the API origin; blank = same origin (the server also serves the built app).
 * ------------------------------------------------------------------------- */

import type { VertexDB } from '../lib/types'
import { fromWire, toWire } from '../lib/wire'
import type { CommandCall, OpFailure } from '../domain/common'

export const SERVER_MODE = import.meta.env.VITE_VERTEX_STORAGE === 'server'
const API = (import.meta.env.VITE_VERTEX_API as string | undefined)?.replace(/\/$/, '') ?? ''

export interface RemoteResponse<T> {
  status: number
  body: T
}

export class NetworkError extends Error {}

async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<RemoteResponse<T>> {
  let res: Response
  try {
    res = await fetch(`${API}${path}`, {
      method: init.method ?? 'GET',
      credentials: 'include',
      headers: { 'content-type': 'application/json', 'x-vertex-request': '1' },
      body: init.body === undefined ? undefined : toWire(init.body),
    })
  } catch (err) {
    throw new NetworkError(err instanceof Error ? err.message : String(err))
  }
  const text = await res.text()
  let body: T
  try {
    body = (text ? fromWire<T>(text) : {}) as T
  } catch {
    body = { ok: false, error: `Unexpected server response (${res.status}).` } as T
  }
  return { status: res.status, body }
}

export interface PublicAccount {
  id: string
  name: string
  email: string
  role: 'admin' | 'unit'
  unitId: string | null
  adminTier: 'full' | 'operations' | 'billing' | null
  designation: string
  initials: string
  active: boolean
  hasPassword: boolean
}

type Failure = { ok: false; error: string; fieldErrors?: Record<string, string>; conflict?: boolean; issues?: OpFailure['issues'] }

export const remote = {
  accounts: () => api<{ accounts: PublicAccount[]; company: string }>('/api/accounts'),
  session: () => api<{ ok: true; userId: string } | Failure>('/api/session'),
  state: (since?: number) => api<({ ok: true; revision: number; db?: VertexDB; unchanged?: boolean }) | Failure>(`/api/state${since ? `?since=${since}` : ''}`),
  command: (call: CommandCall) => api<({ ok: true; revision: number; value: unknown; db: VertexDB }) | Failure>('/api/commands', { method: 'POST', body: call }),
  login: (userId: string, password: string) => api<({ ok: true; user: PublicAccount }) | Failure>('/api/auth/login', { method: 'POST', body: { userId, password } }),
  firstPassword: (userId: string, password: string, confirm: string) =>
    api<({ ok: true; user: PublicAccount }) | Failure>('/api/auth/first-password', { method: 'POST', body: { userId, password, confirm } }),
  changePassword: (current: string, next: string, confirm: string) => api<{ ok: true } | Failure>('/api/auth/change-password', { method: 'POST', body: { current, next, confirm } }),
  logout: () => api<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
  getDraft: (key: string) => api<({ ok: true; rev: number; data: string; updatedAt: string }) | Failure>(`/api/drafts/${encodeURIComponent(key)}`),
  putDraft: (key: string, knownRev: number, data: unknown) =>
    api<({ ok: true; rev: number }) | { ok: false; current: { rev: number; data: string; updatedAt: string } }>(`/api/drafts/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: { knownRev, data },
    }),
  deleteDraft: (key: string) => api<{ ok: true }>(`/api/drafts/${encodeURIComponent(key)}`, { method: 'DELETE' }),
  exportData: () => api<({ ok: true; revision: number; db: VertexDB }) | Failure>('/api/export'),
  backupStatus: () => api<BackupStatusResponse | Failure>('/api/backup/status'),
  backupRun: () => api<({ ok: true; name: string; exportedAt: string; revision: number; credentials: string }) | Failure>('/api/backup/run', { method: 'POST' }),
  async validateBackup(file: File): Promise<RemoteResponse<BackupValidation | Failure>> {
    const res = await fetch(`${API}/api/backup/validate`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/zip', 'x-vertex-request': '1' },
      body: file,
    })
    return { status: res.status, body: fromWire(await res.text()) }
  },
  backupFileUrl: (name: string) => `${API}/api/backup/file/${encodeURIComponent(name)}`,
  freshBackupUrl: () => `${API}/api/backup/fresh`,
}

export interface BackupStatusResponse {
  ok: true
  configured: boolean
  location?: string
  schedule?: string
  keep?: number
  passphraseConfigured?: boolean
  currentRevision: number
  status: {
    lastSuccessAt: string | null
    lastSuccessRevision: number | null
    lastSuccessName: string | null
    lastFailureAt: string | null
    lastFailure: string | null
    credentials: string | null
  } | null
  backups: Array<{ name: string; size: number; exportedAt: string | null; revision: number | null }>
}

export type BackupValidation =
  | { ok: true; valid: false; error: string }
  | {
      ok: true
      valid: true
      manifest: { exportedAt: string; revision: number; schemaVersion: number; notice: string; legacy: boolean }
      warnings: string[]
      preview: {
        destination: { kind: string; schema: string; empty: boolean; revision: number | null; counts: Record<string, number> | null }
        archive: { exportedAt: string; revision: number; counts: Record<string, number>; credentials: string; notice: string }
        warnings: string[]
        blockers: string[]
      }
    }
