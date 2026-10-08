import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { History, RotateCcw, Trash2 } from 'lucide-react'
import { useStore } from '../store/store'
import { discardUnfinished, listUnfinished } from '../lib/unfinished'
import type { DraftScope, Unfinished } from '../lib/unfinished'
import { fmtDateTime, uid } from '../lib/format'
import { Button, Card, CardHead, ConfirmDialog } from './ui'

/* ---------------------------------------------------------------------------
 * Unfinished new products and plans: "New …" reopens the latest one where it
 * was left (unless "Start a new one" was chosen), and the lists show every one
 * of them with Resume and Discard.
 * ------------------------------------------------------------------------- */

/**
 * The ?draft= id for a NEW record's editor. Without one: the latest unfinished
 * form is reopened (?resumed=1), or — with ?fresh=1, or when there is none — a
 * new id is made. Returns null while deciding.
 */
export function useNewDraftId<T>(scope: DraftScope, isNew: boolean, hasContent: (d: T) => boolean): string | null {
  const { user, storageMode } = useStore()
  const [params, setParams] = useSearchParams()
  const current = params.get('draft')
  const fresh = params.get('fresh') === '1'
  useEffect(() => {
    if (!isNew || current || !user) return
    let cancelled = false
    const pick = async () => {
      const latest = fresh ? undefined : (await listUnfinished<T>(user.id, scope, storageMode === 'server', hasContent))[0]
      if (cancelled) return
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('fresh')
          next.set('draft', latest ? latest.id : uid('new'))
          if (latest) next.set('resumed', '1')
          return next
        },
        { replace: true },
      )
    }
    void pick()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, current, fresh, user?.id, scope, storageMode])
  return isNew ? current : null
}

/** Shown on a NEW record's editor when it reopened earlier unfinished work. */
export function ResumedNotice({ savedAt, newHref, onDiscard }: { savedAt: string | null; newHref: string; onDiscard: () => void }) {
  return (
    <div className="vx-anim-up flex flex-wrap items-center gap-3 rounded-md bg-accent-wash px-4 py-3 text-sm text-accent-text ring-1 ring-inset ring-accent-edge" role="status">
      <History className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">Continuing where you left off{savedAt ? ` (kept ${fmtDateTime(savedAt)})` : ''}. Nothing was lost.</span>
      <Link to={newHref} className="vx-focus rounded-xs font-medium underline-offset-2 hover:underline">
        Start a new one instead
      </Link>
      <Button size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={onDiscard}>
        Discard this draft…
      </Button>
    </div>
  )
}

/** Every unfinished new record of one kind, with Resume and Discard. Renders nothing when there is none. */
export function UnfinishedCard<T>({
  scope,
  title,
  hasContent,
  describe,
  hrefFor,
}: {
  scope: DraftScope
  title: string
  hasContent: (d: T) => boolean
  describe: (d: T) => { name: string; detail?: string }
  hrefFor: (id: string) => string
}) {
  const { user, storageMode, pushToast } = useStore()
  const [items, setItems] = useState<Unfinished<T>[]>([])
  const [pending, setPending] = useState<Unfinished<T> | null>(null)
  const server = storageMode === 'server'

  useEffect(() => {
    if (!user) return
    let cancelled = false
    void listUnfinished<T>(user.id, scope, server, hasContent).then((list) => !cancelled && setItems(list))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, scope, server])

  if (!items.length) return null
  return (
    <Card className="vx-anim-up overflow-hidden">
      <CardHead title={title} subtitle="Started and not saved yet — kept as drafts. Resume to continue exactly where you left off." icon={<History className="h-4 w-4" />} />
      <ul className="divide-y divide-rule">
        {items.map((u) => {
          const d = describe(u.data)
          return (
            <li key={u.key} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{d.name || '(no name yet)'}</p>
                <p className="text-xs text-muted">
                  {d.detail ? `${d.detail} · ` : ''}kept {fmtDateTime(u.savedAt)}
                </p>
              </div>
              <Link to={hrefFor(u.id)} className="vx-btn vx-focus inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 font-medium text-accent-ink">
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Resume
              </Link>
              <Button size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setPending(u)} aria-label={`Discard ${d.name || 'unnamed draft'}`}>
                Discard…
              </Button>
            </li>
          )
        })}
      </ul>
      <ConfirmDialog
        open={!!pending}
        tone="danger"
        title="Discard this draft?"
        body={`“${pending ? describe(pending.data).name || 'Unnamed' : ''}” has not been saved. Discarding removes what was typed; it cannot be brought back.`}
        confirmLabel="Discard draft"
        onCancel={() => setPending(null)}
        onConfirm={async () => {
          if (!pending) return
          await discardUnfinished(pending.key, server)
          setItems((xs) => xs.filter((x) => x.key !== pending.key))
          setPending(null)
          pushToast({ title: 'Draft discarded', level: 'info' })
        }}
      />
    </Card>
  )
}
