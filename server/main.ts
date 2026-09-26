/* ---------------------------------------------------------------------------
 * Vertex ERP server entry point and maintenance commands.
 *
 *   node dist-server/main.js serve
 *   node dist-server/main.js migrate
 *   node dist-server/main.js backup   [--dir backups]
 *   node dist-server/main.js verify   <archive.zip>
 *   node dist-server/main.js restore  <archive.zip> --into <postgres-url | pglite-dir> [--schema s]
 *                                     (--dry-run | --confirm <label>) [--replace] [--without-credentials]
 *   node dist-server/main.js import-browser <exported-dataset.json>
 *
 * Configuration (the one boundary for connection settings — see docs/server-storage.md):
 *   DATABASE_URL             PostgreSQL connection string (required unless --dev)
 *   DATABASE_SCHEMA          schema holding the Vertex tables (default public)
 *   PGLITE_DIR               embedded PostgreSQL data directory (development only)
 *   PORT                     HTTP port (default 8787)
 *   STATIC_DIR               built client to serve (default ./dist-app-server when present)
 *   BACKUP_DIR               backup directory — keep it on storage separate from the database
 *   BACKUP_INTERVAL_MIN      scheduled backup interval (default 60; 0 disables)
 *   BACKUP_KEEP              number of archives kept (default 72)
 *   VERTEX_BACKUP_PASSPHRASE encrypts account password hashes inside archives
 *   SECURE_COOKIES           "1" behind HTTPS
 *   ALLOWED_ORIGINS          comma-separated origins allowed to call the API (dev only)
 *   BACKUP_COPY_DIR          a second place that keeps one archive per day (another drive)
 *   LICENCE_ID               this installation's licence (required unless --dev)
 *   LICENCE_ENDPOINT         licence service (default: Back Moon Devs)
 *   VERTEX_LICENCE           "off" on development machines only
 *
 * Flags --data, --schema, --port, --static and --backup-dir override the matching variables.
 * A .env file in the working directory is read for variables not already set.
 * ------------------------------------------------------------------------- */

import { existsSync, readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { VertexDB } from '../src/lib/types'
import { migrate, openPostgres, schemaVersion } from './storage'
import { openPglite } from './storage-pglite'
import type { Database } from './storage'
import { VertexService } from './service'
import { previewRestore, restoreArchive, runBackup, verifyArchive } from './backup'
import { startServing } from './serve'
import { LICENCE_ENDPOINT, LicenceGuard, metaStore } from './licence'
import { fsBackupStore } from './backup-fs'

function loadEnvFile() {
  try {
    const text = readFileSync(resolve(process.cwd(), '.env'), 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq < 1) continue
      const key = trimmed.slice(0, eq).trim()
      let val = trimmed.slice(eq + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
      if (!(key in process.env)) process.env[key] = val
    }
  } catch {
    // No .env file — rely on the real environment.
  }
}
loadEnvFile()

const env = process.env
const flag = (name: string) => process.argv.includes(name)
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i > 0 ? process.argv[i + 1] : undefined
}
const DEV_MODE = flag('--dev') || env.VERTEX_DEV === '1'
const passphrase = () => env.VERTEX_BACKUP_PASSPHRASE || undefined
const appVersion = () => {
  try {
    const p = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'))
    return `${p.name}@${p.version}`
  } catch {
    return 'vertex-erp'
  }
}

async function openFrom(target: string, schema?: string): Promise<Database> {
  if (/^postgres(ql)?:\/\//.test(target)) return openPostgres(target, { schema })
  return openPglite(resolve(target))
}

/** Never falls back to an empty local database: a missing DATABASE_URL stops the server. */
function openConfigured(): Promise<Database> {
  const explicit = arg('--data') ?? env.DATABASE_URL ?? (DEV_MODE ? env.PGLITE_DIR : undefined)
  if (!explicit && !DEV_MODE) {
    console.error('FATAL: DATABASE_URL is required. Set it in .env or the environment.')
    console.error('       For a local development database pass --dev (uses PGLITE_DIR or ./.vertex-data).')
    process.exit(1)
  }
  return openFrom(explicit ?? '.vertex-data', arg('--schema') ?? env.DATABASE_SCHEMA)
}

function describe(db: Database, target: string): string {
  if (db.kind === 'pglite') return `embedded database ${target}`
  try {
    const u = new URL(target)
    return `postgres ${u.hostname}:${u.port || 5432}${u.pathname} schema ${db.schema}`
  } catch {
    return `postgres (schema ${db.schema})`
  }
}

/**
 * Every non-development server holds a licence. Without LICENCE_ID (or with an
 * inactive licence) the server answers only the licence check — see licence.ts.
 * VERTEX_LICENCE=off is for development machines only.
 */
function licenceFor(db: Database): LicenceGuard | undefined {
  if (DEV_MODE || env.VERTEX_LICENCE === 'off') return undefined
  return new LicenceGuard({ licenceId: env.LICENCE_ID || 'UNLICENSED', endpoint: env.LICENCE_ENDPOINT || LICENCE_ENDPOINT, appVersion: appVersion(), installId: env.INSTALL_ID }, metaStore(db))
}

async function serve() {
  const db = await openConfigured()
  const target = arg('--data') ?? env.DATABASE_URL ?? '.vertex-data'
  const backupDir = arg('--backup-dir') ?? env.BACKUP_DIR
  if (!backupDir) console.warn('Scheduled backups are OFF — set BACKUP_DIR (on separate storage) to enable them.')
  const running = await startServing({
    db,
    label: describe(db, target),
    port: Number(arg('--port') ?? env.PORT ?? 8787),
    staticDir: arg('--static') ?? env.STATIC_DIR ?? (existsSync('dist-app-server/index.html') ? 'dist-app-server' : undefined),
    secureCookies: env.SECURE_COOKIES === '1',
    allowedOrigins: (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    deployment: 'Node server',
    licence: licenceFor(db),
    backup: backupDir
      ? { dir: backupDir, copyDir: env.BACKUP_COPY_DIR || undefined, keep: Number(env.BACKUP_KEEP ?? 72), everyMin: Number(env.BACKUP_INTERVAL_MIN ?? 60), passphrase: passphrase(), appVersion: appVersion() }
      : undefined,
  })
  const stop = () => void running.stop().then(() => process.exit(0))
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
}

async function main() {
  const cmd = process.argv[2] ?? 'serve'
  if (cmd === 'serve') return serve()

  if (cmd === 'migrate') {
    const db = await openConfigured()
    console.log(JSON.stringify({ ok: true, schema: db.schema, schemaVersion: await schemaVersion(db) }, null, 1))
    return db.close()
  }

  if (cmd === 'backup') {
    const db = await openConfigured()
    try {
      const store = fsBackupStore(arg('--dir') ?? env.BACKUP_DIR ?? 'backups')
      const { name, manifest } = await runBackup(db, store, { passphrase: passphrase(), appVersion: appVersion() })
      console.log(JSON.stringify({ file: `${store.label}/${name}`, revision: manifest.database.revision, credentials: manifest.credentials, counts: manifest.counts }, null, 1))
    } finally {
      await db.close()
    }
    return
  }

  if (cmd === 'verify') {
    const check = verifyArchive(await readFile(process.argv[3]), { passphrase: passphrase() })
    if (!check.ok) throw new Error(check.error)
    const m = check.content.manifest
    console.log(JSON.stringify({ ok: true, exportedAt: m.exportedAt, revision: m.database.revision, schemaVersion: m.schemaVersion, credentials: check.content.credentials ? 'available' : m.credentials, counts: m.counts, warnings: check.warnings }, null, 1))
    return
  }

  if (cmd === 'restore') {
    const file = process.argv[3]
    const into = arg('--into')
    if (!file || !into) throw new Error('Usage: restore <archive.zip> --into <postgres-url | pglite-dir> [--schema s] (--dry-run | --confirm <label>)')
    const check = verifyArchive(await readFile(file), { passphrase: passphrase() })
    if (!check.ok) throw new Error(check.error)
    const target = await openFrom(into, arg('--schema'))
    try {
      await migrate(target)
      const options = { withoutCredentials: flag('--without-credentials'), replace: flag('--replace') }
      const preview = await previewRestore(target, check.content, options)
      const label = describe(target, into)
      if (flag('--dry-run') || !arg('--confirm')) {
        console.log(JSON.stringify({ dryRun: true, target: label, ...preview, warnings: [...check.warnings, ...preview.warnings], next: preview.blockers.length ? 'Resolve the blockers first.' : `Re-run with --confirm "${target.schema}" to restore.` }, null, 1))
        return
      }
      if (arg('--confirm') !== target.schema) throw new Error(`Confirmation "${arg('--confirm')}" does not match the destination schema "${target.schema}". Nothing was written.`)
      const result = await restoreArchive(target, check.content, { ...options, preRestoreStore: fsBackupStore(arg('--pre-restore-dir') ?? env.BACKUP_DIR ?? 'backups'), passphrase: passphrase() })
      console.log(JSON.stringify({ ok: true, restoredInto: label, ...result }, null, 1))
    } finally {
      await target.close()
    }
    return
  }

  if (cmd === 'import-browser') {
    const raw = JSON.parse(await readFile(process.argv[3], 'utf8')) as { db?: VertexDB; drafts?: { key: string; value: string }[] } & VertexDB
    const db = await openConfigured()
    try {
      const r = await new VertexService(db).importBrowserDataset(raw.db ?? raw, 'import-browser CLI', raw.drafts)
      if (!r.ok) throw new Error(r.error)
      console.log(JSON.stringify({ ok: true, revision: r.revision }, null, 1))
    } finally {
      await db.close()
    }
    return
  }

  throw new Error(`Unknown command: ${cmd}`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
