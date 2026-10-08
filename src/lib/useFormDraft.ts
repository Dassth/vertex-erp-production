import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useStore } from '../store/store'
import { remote } from '../store/remote'
import { draftKey, readDraft, removeDraft, writeDraft } from './drafts'
import { fromWire } from './wire'
import { uid } from './format'

/* ---------------------------------------------------------------------------
 * Keep a form as a draft while it is being filled: in this browser at once,
 * and in the database on an installed copy. Opening the same form again (the
 * same record, or the same ?draft= id for a new one) brings it back exactly as
 * it was left. The draft is removed only when the record is saved or the user
 * discards it.
 * ------------------------------------------------------------------------- */

function browserLocal(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export interface FormDraft<T> {
  draft: T
  setDraft: Dispatch<SetStateAction<T>>
  dirty: boolean
  /** When a kept draft was brought back: when it was last saved. */
  restoredAt: string | null
  /** Last time the draft copy was written. */
  keptAt: string | null
  /** After the record itself was saved: forget the draft, `value` is the new clean state. */
  saved: (value: T) => void
  /** Throw the draft away and go back to `fresh`. */
  discard: (fresh: T) => void
  /** Write the draft now (e.g. before leaving). */
  flush: () => void
}

export function useFormDraft<T>(scope: string, scopeId: string, initial: T, options: { enabled: boolean; baseUpdatedAt: string | null }): FormDraft<T> {
  const { user, storageMode } = useStore()
  const storage = useMemo(() => browserLocal(), [])
  const key = draftKey(user?.id ?? 'anonymous', scope, scopeId)
  const tabId = useMemo(() => uid('tab'), [])
  const [recovered] = useState(() => (options.enabled && storage ? readDraft<T>(storage, key) : null))
  const knownRev = useRef(recovered?.rev ?? 0)
  const serverRev = useRef(0)
  // Bumped when the draft is forgotten, so a server write still in flight is undone.
  const generation = useRef(0)
  const [draft, setDraft] = useState<T>(() => recovered?.data ?? initial)
  const [baseline, setBaseline] = useState(() => JSON.stringify(initial))
  const [restoredAt, setRestoredAt] = useState<string | null>(recovered?.savedAt ?? null)
  const [keptAt, setKeptAt] = useState<string | null>(recovered?.savedAt ?? null)
  const dirty = options.enabled && JSON.stringify(draft) !== baseline
  const server = storageMode === 'server'

  const write = (value: T) => {
    if (!options.enabled || !user) return
    if (storage) {
      const r = writeDraft(storage, key, value, { userId: user.id, tabId, knownRev: knownRev.current, baseUpdatedAt: options.baseUpdatedAt })
      if (r.ok) {
        knownRev.current = r.rev
        setKeptAt(r.savedAt)
      } else if (r.reason === 'newer') knownRev.current = r.current.rev
    }
    if (server) {
      const gen = generation.current
      void remote
        .putDraft(key, serverRev.current, value)
        .then((r) => {
          if (gen !== generation.current) return void remote.deleteDraft(key).catch(() => {})
          if (r.body.ok) serverRev.current = r.body.rev
          else if ('current' in r.body && r.body.current) serverRev.current = r.body.current.rev
          setKeptAt(new Date().toISOString())
        })
        .catch(() => {})
    }
  }

  // No copy in this browser: bring back the one kept in the database.
  useEffect(() => {
    if (!options.enabled || !server || recovered) return
    let cancelled = false
    remote
      .getDraft(key)
      .then((r) => {
        if (cancelled || !r.body.ok) return
        serverRev.current = r.body.rev
        setDraft(fromWire<T>(r.body.data))
        setRestoredAt(r.body.updatedAt)
        setKeptAt(r.body.updatedAt)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, server, options.enabled])

  const draftRef = useRef(draft)
  const dirtyRef = useRef(dirty)
  useEffect(() => {
    draftRef.current = draft
    dirtyRef.current = dirty
    if (!dirty) return
    const t = window.setTimeout(() => write(draft), 400)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, dirty])

  // Leaving the screen, hiding or closing the window: write what is there.
  useEffect(() => {
    const flush = () => {
      if (dirtyRef.current) write(draftRef.current)
    }
    const onHide = () => document.visibilityState === 'hidden' && flush()
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      flush()
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onHide)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const forget = () => {
    generation.current++
    if (storage) removeDraft(storage, key)
    if (server) void remote.deleteDraft(key).catch(() => {})
    knownRev.current = 0
    serverRev.current = 0
    setRestoredAt(null)
    setKeptAt(null)
  }

  return {
    draft,
    setDraft,
    dirty,
    restoredAt,
    keptAt,
    saved: (value) => {
      forget()
      dirtyRef.current = false
      setDraft(value)
      setBaseline(JSON.stringify(value))
    },
    discard: (fresh) => {
      forget()
      dirtyRef.current = false
      setDraft(fresh)
      setBaseline(JSON.stringify(fresh))
    },
    flush: () => {
      if (dirtyRef.current) write(draftRef.current)
    },
  }
}
