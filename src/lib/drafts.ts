/* ---------------------------------------------------------------------------
 * Recoverable form drafts.
 *
 * An editor keeps a copy of its unsaved form in browser storage, scoped to the
 * signed-in account and the record (or new-record draft id). The copy holds the
 * RAW form state — including half-typed numbers (NaN) that the saved record
 * cannot represent — so nothing the user typed is lost on a refresh, a failed
 * submit or navigation.
 *
 * Each write carries a revision. A tab only overwrites a stored draft whose
 * revision it has already seen, so an older tab cannot silently replace a newer
 * draft written by another tab.
 *
 * The draft is removed only after the record itself was saved, or when the user
 * confirms a discard.
 * ------------------------------------------------------------------------- */

import type { StorageLike } from './db'

export const DRAFT_PREFIX = 'vertex-erp-draft-v1:'

export interface StoredDraft<T> {
  key: string
  userId: string
  rev: number
  tabId: string
  savedAt: string
  /** `updatedAt` of the saved record the draft was started from (null for a new record). */
  baseUpdatedAt: string | null
  data: T
}

export type DraftWrite =
  | { ok: true; rev: number; savedAt: string }
  | { ok: false; reason: 'newer'; current: StoredDraft<unknown> }
  | { ok: false; reason: 'storage'; error: string }

export function draftKey(userId: string, scope: string, id: string): string {
  return `${DRAFT_PREFIX}${userId}:${scope}:${id}`
}

const NON_FINITE = '$nonFinite'

function encode(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (typeof v === 'number' && !Number.isFinite(v) ? { [NON_FINITE]: String(v) } : v))
}

function decode<T>(raw: string): T {
  return JSON.parse(raw, (_k, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && NON_FINITE in v) return Number(v[NON_FINITE])
    return v
  }) as T
}

export function readDraft<T>(storage: StorageLike, key: string): StoredDraft<T> | null {
  try {
    const raw = storage.getItem(key)
    return raw ? decode<StoredDraft<T>>(raw) : null
  } catch {
    return null
  }
}

/**
 * Save a draft. `knownRev` is the revision this tab last read or wrote (0 when
 * it has never seen one); a stored draft with a higher revision from another tab
 * is left untouched and returned instead.
 */
export function writeDraft<T>(
  storage: StorageLike,
  key: string,
  data: T,
  meta: { userId: string; tabId: string; knownRev: number; baseUpdatedAt: string | null; now?: Date },
): DraftWrite {
  const current = readDraft<unknown>(storage, key)
  if (current && current.rev > meta.knownRev && current.tabId !== meta.tabId) return { ok: false, reason: 'newer', current }
  const rev = Math.max(meta.knownRev, current?.rev ?? 0) + 1
  const savedAt = (meta.now ?? new Date()).toISOString()
  const record: StoredDraft<T> = { key, userId: meta.userId, rev, tabId: meta.tabId, savedAt, baseUpdatedAt: meta.baseUpdatedAt, data }
  try {
    const text = encode(record)
    storage.setItem(key, text)
    // Read back: a quota or privacy failure can drop the write silently.
    if (storage.getItem(key) !== text) return { ok: false, reason: 'storage', error: 'The browser did not keep the draft copy.' }
    return { ok: true, rev, savedAt }
  } catch (err) {
    return { ok: false, reason: 'storage', error: err instanceof Error ? err.message : String(err) }
  }
}

export function removeDraft(storage: StorageLike, key: string): void {
  try {
    storage.removeItem(key)
  } catch {
    /* nothing to do — a stale draft is offered again and can be discarded */
  }
}

/** Keys of all drafts of one scope for one account (e.g. every unsaved new product). */
export function listDraftKeys(storage: Storage | null, userId: string, scope: string): string[] {
  if (!storage) return []
  const prefix = `${DRAFT_PREFIX}${userId}:${scope}:`
  const out: string[] = []
  try {
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i)
      if (k?.startsWith(prefix)) out.push(k)
    }
  } catch {
    return []
  }
  return out
}
