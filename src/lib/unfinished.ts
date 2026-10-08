/* ---------------------------------------------------------------------------
 * Unfinished work: forms for a NEW product or plan that were started and not
 * yet saved. Every editor keeps its form as a draft (in the database on an
 * installed copy, and in this browser), so leaving a screen never loses it:
 * "New product" / "New plan" reopens the latest one where it was left, and the
 * lists show all of them with Resume and Discard.
 * ------------------------------------------------------------------------- */

import { DRAFT_PREFIX, listDraftKeys, readDraft, removeDraft } from './drafts'
import { remote } from '../store/remote'
import { fromWire } from './wire'

export type DraftScope = 'product' | 'plan'

export interface Unfinished<T> {
  key: string
  /** The id after `new:` — the value of the editor's ?draft= parameter. */
  id: string
  savedAt: string
  data: T
}

const prefixFor = (userId: string, scope: DraftScope) => `${DRAFT_PREFIX}${userId}:${scope}:new:`

function browserLocal(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** Unfinished new-record drafts of one kind, newest first; `hasContent` drops forms left blank. */
export async function listUnfinished<T>(userId: string, scope: DraftScope, server: boolean, hasContent: (d: T) => boolean): Promise<Unfinished<T>[]> {
  const prefix = prefixFor(userId, scope)
  const found = new Map<string, Unfinished<T>>()
  const storage = browserLocal()
  for (const key of listDraftKeys(storage, userId, scope)) {
    if (!key.startsWith(prefix) || !storage) continue
    const d = readDraft<T>(storage, key)
    if (d) found.set(key, { key, id: key.slice(prefix.length), savedAt: d.savedAt, data: d.data })
  }
  if (server) {
    try {
      const r = await remote.listDrafts(prefix)
      if (r.body.ok)
        for (const d of r.body.drafts) {
          const local = found.get(d.key)
          if (!local || local.savedAt < d.updatedAt) found.set(d.key, { key: d.key, id: d.key.slice(prefix.length), savedAt: d.updatedAt, data: fromWire<T>(d.data) })
        }
    } catch {
      // Server not reachable: the copies in this browser are still listed.
    }
  }
  return [...found.values()].filter((u) => u.data && hasContent(u.data)).sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

/** Remove an unfinished draft everywhere it is kept. */
export async function discardUnfinished(key: string, server: boolean): Promise<void> {
  const storage = browserLocal()
  if (storage) removeDraft(storage, key)
  if (server) await remote.deleteDraft(key).catch(() => {})
}
