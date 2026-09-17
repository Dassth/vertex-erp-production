/* ---------------------------------------------------------------------------
 * Cloudflare Worker: serves the server-mode app (static assets) and the Vertex
 * API, backed by the same PostgreSQL database (Supabase) as the Node server.
 *
 * Bindings (wrangler.jsonc):
 *   ASSETS                    built client (dist-app-server)
 *   HYPERDRIVE                Hyperdrive binding to Supabase (session pooler, port 5432)
 *   DATABASE_URL              secret — fallback when HYPERDRIVE is not bound
 *   DATABASE_SCHEMA           optional var (default public)
 *   VERTEX_BACKUP_PASSPHRASE  optional secret — encrypts password hashes in backups
 *   BACKUPS                   optional R2 bucket for scheduled / on-demand backups
 *
 * Workers cannot keep database connections between requests, so each request
 * opens one connection and closes it when the response is done.
 * ------------------------------------------------------------------------- */

import { openPostgres } from './storage'
import type { Database } from './storage'
import { VertexService } from './service'
import { databaseHasher } from './passwords'
import { createApiHandler } from './api'
import type { BackupStatus, BackupStore } from './backup'
import { ARCHIVE_NAME, EMPTY_STATUS, runBackup } from './backup'

interface R2ObjectLike {
  key: string
  size: number
  customMetadata?: Record<string, string>
  arrayBuffer(): Promise<ArrayBuffer>
  text(): Promise<string>
}
interface R2BucketLike {
  put(key: string, value: ArrayBuffer | Uint8Array | string, options?: { customMetadata?: Record<string, string>; httpMetadata?: Record<string, string> }): Promise<unknown>
  get(key: string): Promise<R2ObjectLike | null>
  list(options?: { prefix?: string; include?: string[]; limit?: number }): Promise<{ objects: R2ObjectLike[] }>
  delete(key: string): Promise<void>
}

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> }
  /** Hyperdrive in front of Supabase; preferred over DATABASE_URL when bound. */
  HYPERDRIVE?: { connectionString: string }
  DATABASE_URL?: string
  DATABASE_SCHEMA?: string
  VERTEX_BACKUP_PASSPHRASE?: string
  BACKUPS?: R2BucketLike
  BACKUP_KEEP?: string
  APP_VERSION?: string
}

interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void
}

const PREFIX = 'archives/'
const STATUS_KEY = 'backup-status.json'
const SCHEDULE = 'hourly (Cloudflare Cron Trigger)'

function r2Store(bucket: R2BucketLike): BackupStore {
  return {
    label: 'Cloudflare R2 bucket vertex-erp-backups',
    async put(name, data, meta) {
      if (!ARCHIVE_NAME.test(name)) throw new Error('Invalid backup name.')
      await bucket.put(PREFIX + name, data, { customMetadata: { exportedAt: meta.exportedAt, revision: String(meta.revision) }, httpMetadata: { contentType: 'application/zip' } })
    },
    async get(name) {
      const obj = await bucket.get(PREFIX + name)
      return obj ? new Uint8Array(await obj.arrayBuffer()) : null
    },
    async list() {
      const { objects } = await bucket.list({ prefix: PREFIX, include: ['customMetadata'], limit: 1000 })
      return objects
        .map((o) => ({
          name: o.key.slice(PREFIX.length),
          size: o.size,
          exportedAt: o.customMetadata?.exportedAt ?? null,
          revision: o.customMetadata?.revision ? Number(o.customMetadata.revision) : null,
        }))
        .filter((o) => ARCHIVE_NAME.test(o.name))
        .sort((a, b) => b.name.localeCompare(a.name))
    },
    async remove(name) {
      await bucket.delete(PREFIX + name)
    },
    async readStatus(): Promise<BackupStatus> {
      const obj = await bucket.get(STATUS_KEY)
      return obj ? { ...EMPTY_STATUS, ...JSON.parse(await obj.text()) } : { ...EMPTY_STATUS }
    },
    async writeStatus(status) {
      await bucket.put(STATUS_KEY, JSON.stringify(status, null, 1), { httpMetadata: { contentType: 'application/json' } })
    },
  }
}

async function openDb(env: Env): Promise<Database> {
  // Direct pg sockets from a Worker drop large writes (the full state document),
  // so production connects through Hyperdrive.
  const url = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL
  if (!url) throw new Error('Neither HYPERDRIVE nor DATABASE_URL is configured for this Worker.')
  return openPostgres(url, { schema: env.DATABASE_SCHEMA || undefined, migrate: false, max: 1 })
}

const unavailable = (message: string) =>
  new Response(JSON.stringify({ ok: false, error: message }), { status: 503, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContextLike): Promise<Response> {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request)
    let db: Database
    try {
      db = await openDb(env)
    } catch (err) {
      console.error('database unavailable', err)
      // Never fall back to anything else: the app shows the server as offline.
      return unavailable('The database is not reachable right now. Nothing was saved.')
    }
    try {
      const service = new VertexService(db, undefined, databaseHasher(db))
      const api = createApiHandler(service, {
        secureCookies: url.protocol === 'https:',
        deployment: 'Cloudflare Worker',
        backup: env.BACKUPS
          ? { store: r2Store(env.BACKUPS), passphrase: env.VERTEX_BACKUP_PASSPHRASE || undefined, appVersion: env.APP_VERSION, keep: Number(env.BACKUP_KEEP ?? 168), schedule: SCHEDULE }
          : undefined,
      })
      return await api(request)
    } finally {
      ctx.waitUntil(db.close())
    }
  },

  async scheduled(_event: unknown, env: Env, ctx: ExecutionContextLike): Promise<void> {
    const db = await openDb(env)
    const job = (async () => {
      try {
        await new VertexService(db).sweep()
        if (env.BACKUPS) {
          const { name, manifest } = await runBackup(db, r2Store(env.BACKUPS), {
            passphrase: env.VERTEX_BACKUP_PASSPHRASE || undefined,
            appVersion: env.APP_VERSION,
            keep: Number(env.BACKUP_KEEP ?? 168),
          })
          console.log(`backup ${name} revision ${manifest.database.revision}`)
        }
      } catch (err) {
        console.error('scheduled job failed', err)
      } finally {
        await db.close()
      }
    })()
    ctx.waitUntil(job)
    await job
  },
}
