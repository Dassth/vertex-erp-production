/* ---------------------------------------------------------------------------
 * Vertex ERP HTTP API as a standard fetch handler (Request → Response).
 * Used by the Node server (server/http.ts) and by the Cloudflare Worker
 * (server/worker.ts), so both deployments enforce exactly the same rules.
 * ------------------------------------------------------------------------- */

import { fromWire, toWire } from '../src/lib/wire'
import { can } from '../src/lib/permissions'
import type { VertexService } from './service'
import { SESSION_HOURS, publicAccounts, publicState } from './service'
import type { BackupStore } from './backup'
import { ARCHIVE_NAME, archiveName, buildArchive, previewRestore, runBackup, verifyArchive } from './backup'
import type { LicenceState } from './licence'

export const SESSION_COOKIE = 'vx_session'
const MAX_BODY = 8 * 1024 * 1024
const MAX_ARCHIVE = 64 * 1024 * 1024

export interface ApiOptions {
  /** Mark the session cookie Secure (behind HTTPS). */
  secureCookies?: boolean
  /** Extra origins allowed to call the API with credentials (e.g. a Vite dev server). */
  allowedOrigins?: string[]
  /** Where backups go; omitted = backups not configured. */
  backup?: { store: BackupStore; passphrase?: string; appVersion?: string; keep: number; schedule: string }
  /** Where this deployment runs (shown to Administrator 1). */
  deployment?: string
  /** An installed copy's licence; when it is not active every call except the licence check is refused (423). */
  licence?: { state(): Promise<LicenceState>; check(): Promise<LicenceState> }
}

class HttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function cookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return undefined
}

async function bytes(req: Request, limit: number): Promise<Uint8Array> {
  const declared = Number(req.headers.get('content-length') ?? 0)
  if (declared > limit) throw new HttpError(413, 'Request too large.')
  const buf = new Uint8Array(await req.arrayBuffer())
  if (buf.length > limit) throw new HttpError(413, 'Request too large.')
  return buf
}

async function body(req: Request): Promise<Record<string, unknown>> {
  const text = new TextDecoder().decode(await bytes(req, MAX_BODY))
  if (!text) return {}
  try {
    return fromWire(text)
  } catch {
    throw new HttpError(400, 'Invalid JSON body.')
  }
}

export function createApiHandler(service: VertexService, options: ApiOptions = {}) {
  const allowed = new Set(options.allowedOrigins ?? [])

  const json = (status: number, payload: unknown, headers: Record<string, string> = {}) =>
    new Response(toWire(payload), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } })

  const sessionCookie = (token: string | null) =>
    `${SESSION_COOKIE}=${token ? encodeURIComponent(token) : ''}; Path=/; HttpOnly; SameSite=Strict${options.secureCookies ? '; Secure' : ''}; Max-Age=${token ? SESSION_HOURS * 3600 : 0}`

  async function route(req: Request, path: string): Promise<Response> {
    const method = req.method
    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-methods': 'GET,POST,PUT,DELETE', 'access-control-allow-headers': 'content-type,x-vertex-request' } })
    // Mutations must come from this app: a custom header cannot be sent cross-site without CORS approval.
    if (method !== 'GET' && req.headers.get('x-vertex-request') !== '1') throw new HttpError(403, 'Missing request header.')
    const token = cookie(req, SESSION_COOKIE)

    if (path === '/api/licence' && method === 'GET') return json(200, { ok: true, managed: !!options.licence, ...(options.licence ? await options.licence.state() : { active: true }) })
    if (path === '/api/licence/check' && method === 'POST') return json(200, { ok: true, managed: !!options.licence, ...(options.licence ? await options.licence.check() : { active: true }) })
    if (options.licence && path !== '/api/health') {
      const lic = await options.licence.state()
      if (!lic.active) return json(423, { ok: false, locked: true, reason: lic.reason, error: lic.message })
    }

    if (path === '/api/health' && method === 'GET') {
      const s = await service.state()
      return json(200, { ok: true, database: service.db.kind, schema: service.db.schema, revision: s.revision, deployment: options.deployment ?? null })
    }
    if (path === '/api/accounts' && method === 'GET') {
      const s = await service.state()
      return json(200, { accounts: publicAccounts(s.db), company: s.db.company.name })
    }
    if (path === '/api/auth/login' && method === 'POST') {
      const b = await body(req)
      const r = await service.login(String(b.userId ?? ''), String(b.password ?? ''))
      if (!r.ok) return json(r.status, r)
      return json(200, { ok: true, user: r.user }, { 'set-cookie': sessionCookie(r.token) })
    }
    if (path === '/api/auth/first-password' && method === 'POST') {
      const b = await body(req)
      const r = await service.createFirstPassword(String(b.userId ?? ''), String(b.password ?? ''), String(b.confirm ?? ''))
      if (!r.ok) return json(r.status, r)
      return json(200, { ok: true, user: r.user }, { 'set-cookie': sessionCookie(r.token) })
    }
    if (path === '/api/auth/logout' && method === 'POST') {
      await service.logout(token)
      return json(200, { ok: true }, { 'set-cookie': sessionCookie(null) })
    }

    const user = await service.sessionUser(token)
    // "Am I signed in?" is a normal question, not an error.
    if (path === '/api/session' && method === 'GET') return json(200, user ? { ok: true, userId: user.id } : { ok: false, error: 'Not signed in.' })
    if (!user) return json(401, { ok: false, error: 'Your session has ended. Sign in again.' })

    if (path === '/api/auth/change-password' && method === 'POST') {
      const b = await body(req)
      const r = await service.changePassword(user.id, String(b.current ?? ''), String(b.next ?? ''), String(b.confirm ?? ''))
      return r.ok ? json(200, r, { 'set-cookie': sessionCookie(null) }) : json(r.status, r)
    }
    if (path === '/api/state' && method === 'GET') {
      const s = await service.state()
      const since = Number(new URL(req.url).searchParams.get('since'))
      if (Number.isFinite(since) && since === s.revision) return json(200, { ok: true, revision: s.revision, unchanged: true })
      return json(200, { ok: true, revision: s.revision, db: publicState(s.db) })
    }
    if (path === '/api/commands' && method === 'POST') {
      const b = await body(req)
      const r = await service.command(token, String(b.name ?? ''), (b.args as unknown[]) ?? [])
      return json(r.ok ? 200 : r.status, r)
    }
    if (path === '/api/export' && method === 'GET') {
      if (!can(user, 'administration')) return json(403, { ok: false, error: 'Only Administrator 1 can export the dataset.' })
      const s = await service.state()
      return json(200, { ok: true, revision: s.revision, db: publicState(s.db) })
    }

    if (path.startsWith('/api/backup/')) {
      if (!can(user, 'administration')) return json(403, { ok: false, error: 'Only Administrator 1 can manage backups.' })
      const cfg = options.backup
      if (path === '/api/backup/status' && method === 'GET') {
        const s = await service.state()
        if (!cfg) return json(200, { ok: true, configured: false, currentRevision: s.revision, backups: [], status: null })
        return json(200, {
          ok: true,
          configured: true,
          location: cfg.store.label,
          schedule: cfg.schedule,
          keep: cfg.keep,
          passphraseConfigured: !!cfg.passphrase,
          currentRevision: s.revision,
          status: await cfg.store.readStatus(),
          backups: await cfg.store.list(),
        })
      }
      // A fresh archive built on request and streamed straight to Administrator 1 (nothing is stored).
      if (path === '/api/backup/fresh' && method === 'GET') {
        const { buffer, manifest } = await buildArchive(service.db, { passphrase: cfg?.passphrase, appVersion: cfg?.appVersion })
        return new Response(buffer as unknown as BodyInit, {
          status: 200,
          headers: {
            'content-type': 'application/zip',
            'content-disposition': `attachment; filename="${archiveName(new Date(manifest.exportedAt))}"`,
            'cache-control': 'no-store',
            'x-vertex-revision': String(manifest.database.revision),
            'x-vertex-credentials': manifest.credentials,
          },
        })
      }
      if (!cfg) return json(409, { ok: false, error: 'Stored backups are not configured for this deployment.' })
      if (path === '/api/backup/run' && method === 'POST') {
        try {
          const { name, manifest } = await runBackup(service.db, cfg.store, { passphrase: cfg.passphrase, appVersion: cfg.appVersion, keep: cfg.keep })
          return json(200, { ok: true, name, exportedAt: manifest.exportedAt, revision: manifest.database.revision, credentials: manifest.credentials, counts: manifest.counts })
        } catch (e) {
          return json(500, { ok: false, error: `Backup failed: ${(e as Error).message}` })
        }
      }
      const file = /^\/api\/backup\/file\/([^/]+)$/.exec(path)
      if (file && method === 'GET') {
        const name = decodeURIComponent(file[1])
        if (!ARCHIVE_NAME.test(name)) return json(400, { ok: false, error: 'Invalid backup name.' })
        const data = await cfg.store.get(name)
        if (!data) return json(404, { ok: false, error: 'Backup not found.' })
        return new Response(data as unknown as BodyInit, {
          status: 200,
          headers: { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store' },
        })
      }
      if (path === '/api/backup/validate' && method === 'POST') {
        const check = verifyArchive(Buffer.from(await bytes(req, MAX_ARCHIVE)), { passphrase: cfg.passphrase })
        if (!check.ok) return json(200, { ok: true, valid: false, error: check.error })
        const preview = await previewRestore(service.db, check.content)
        return json(200, {
          ok: true,
          valid: true,
          manifest: {
            exportedAt: check.content.manifest.exportedAt,
            revision: check.content.manifest.database.revision,
            schemaVersion: check.content.manifest.schemaVersion,
            notice: check.content.manifest.notice,
            legacy: !!check.content.legacy,
          },
          warnings: check.warnings,
          preview,
        })
      }
    }

    const draft = /^\/api\/drafts\/(.+)$/.exec(path)
    if (draft) {
      const key = decodeURIComponent(draft[1])
      if (method === 'GET') {
        const d = await service.getDraft(user.id, key)
        return json(200, d ? { ok: true, ...d } : { ok: false, missing: true, error: 'No draft.' })
      }
      if (method === 'PUT') {
        const b = await body(req)
        const r = await service.putDraft(user.id, key, Number(b.knownRev ?? 0), toWire(b.data ?? null))
        return json(r.ok ? 200 : 409, r)
      }
      if (method === 'DELETE') {
        await service.deleteDraft(user.id, key)
        return json(200, { ok: true })
      }
    }
    throw new HttpError(404, 'Not found.')
  }

  return async function handle(req: Request): Promise<Response> {
    const path = new URL(req.url).pathname
    let res: Response
    try {
      res = await route(req, path)
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500
      if (status === 500) console.error(err)
      res = json(status, { ok: false, error: status === 500 ? 'The server could not complete the request. Nothing was saved.' : (err as Error).message })
    }
    const origin = req.headers.get('origin')
    if (origin && allowed.has(origin)) {
      res.headers.set('access-control-allow-origin', origin)
      res.headers.set('access-control-allow-credentials', 'true')
      res.headers.set('vary', 'origin')
    }
    return res
  }
}
