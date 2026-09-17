import { createContext } from 'react'
import type { User, VertexDB } from '../lib/types'
import type { Capability } from '../lib/permissions'
import type { Op, OpResult } from '../domain/common'

export interface Toast {
  id: string
  title: string
  message?: string
  level: 'info' | 'success' | 'warn' | 'danger'
}

export type AuthResult = { ok: true; user: User } | { ok: false; error: string }

/** Where committed data lives: this browser only, or the Vertex server. */
export type StorageMode = 'browser' | 'server'

export interface StoreValue {
  db: VertexDB
  user: User | null
  ready: boolean
  /** True when this tab cannot save (no cross-tab coordination and another tab is editing). */
  readOnly: boolean
  storageMode: StorageMode
  toasts: Toast[]
  /** First enforcement layer: what this account may see and do. */
  can: (capability: Capability) => boolean
  pushToast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: string) => void
  run: <T>(op: Op<T>) => Promise<OpResult<T>>
  signIn: (userId: string, password: string) => Promise<AuthResult>
  createFirstPassword: (userId: string, password: string, confirm: string) => Promise<AuthResult>
  changePassword: (current: string, next: string, confirm: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => Promise<void>
}

export const StoreContext = createContext<StoreValue | null>(null)
