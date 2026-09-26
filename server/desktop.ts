/* ---------------------------------------------------------------------------
 * Vertex ERP for Windows — the offline package's entry point.
 *
 *   node app\main.js service --home C:\ProgramData\VertexERP
 *       Started by Windows at boot (a scheduled task). Keeps PostgreSQL and the
 *       Vertex server running: starts them, restarts the server if it stops,
 *       restarts PostgreSQL if it stops, and shuts both down cleanly.
 *   node app\main.js run --home …      the server itself (started by `service`)
 *   node app\main.js backup --home …   write a backup now
 *   node app\main.js status --home …   print the database and licence state
 *   node app\main.js copy --home …     SECOND computer: every 10 minutes, fetch a copy of the
 *       main computer's data (pairing code) into copies\latest.zip, keeping one a day for
 *       400 days in copies\daily. If the main computer is ever lost, setup on this computer
 *       ("MAIN computer") starts from copies\latest.zip.
 *   node app\main.js restore <backup.zip> [--confirm] --home …
 *       put a backup back (after a disk failure or on a new computer). Without
 *       --confirm it only checks the archive and shows what would change. Stop
 *       the "Vertex ERP Server" task first; the current data is backed up first.
 *
 * Layout (installer/setup.ps1 creates it):
 *   C:\Program Files\VertexERP\node\node.exe      Node runtime
 *   C:\Program Files\VertexERP\app\main.js        this bundle, app\client\ the web app
 *   C:\Program Files\VertexERP\pgsql\bin\…        PostgreSQL 17
 *   C:\ProgramData\VertexERP\config.json          settings written at install
 *   C:\ProgramData\VertexERP\db\                  the PostgreSQL database
 *   C:\ProgramData\VertexERP\backups\             hourly backups (7 days)
 *   C:\ProgramData\VertexERP\logs\                server and database logs
 *
 * Why this is safe for data: every save is committed by PostgreSQL (write-ahead
 * log, fsync) before the screen shows it as saved; after a power cut PostgreSQL
 * replays its log on the next start. Closing the window or refreshing the page
 * never loses anything — the data lives in the database, not in the window.
 * ------------------------------------------------------------------------- */

import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import pg from 'pg'
import { migrate, openPostgres } from './storage'
import { copyToSecondPlace, startServing } from './serve'
import { LICENCE_ENDPOINT, LicenceGuard, metaStore } from './licence'
import { archiveName, previewRestore, restoreArchive, runBackup, verifyArchive } from './backup'
import { fsBackupStore } from './backup-fs'

export interface DesktopConfig {
  /** Web address port for both computers (default 4580). */
  port: number
  /** PostgreSQL listens on this computer only (default 55432). */
  pgPort: number
  dbPassword: string
  licenceId: string
  licenceEndpoint: string
  installId: string
  backupEveryMin: number
  backupKeep: number
  /** A second place — another drive, a USB disk, a synced folder — that keeps one archive per day. */
  backupCopyDir: string
  appVersion: string
  /** The second computer shows this code to fetch copies of the data. */
  pairCode: string
  /** SECOND computer only: the main computer's address, e.g. http://192.168.1.10:4580 */
  mainUrl: string
  copyEveryMin: number
}

const flag = (name: string) => {
  const i = process.argv.indexOf(name)
  return i > 0 ? process.argv[i + 1] : undefined
}
const HOME = resolve(flag('--home') ?? process.env.VERTEX_HOME ?? 'C:\\ProgramData\\VertexERP')
const APP_DIR = dirname(resolve(process.argv[1]))
const PG_BIN = resolve(process.env.VERTEX_PG_BIN ?? join(APP_DIR, '..', 'pgsql', 'bin'))
const DB_DIR = join(HOME, 'db')
const LOG_DIR = join(HOME, 'logs')
const exe = (name: string) => join(PG_BIN, process.platform === 'win32' ? `${name}.exe` : name)

function log(file: string, line: string) {
  const text = `${new Date().toISOString()} ${line}\n`
  try {
    mkdirSync(LOG_DIR, { recursive: true })
    const path = join(LOG_DIR, file)
    // Keep logs small: roll over at 10 MB, keeping one previous file.
    if (existsSync(path) && statSync(path).size > 10 * 1024 * 1024) {
      if (existsSync(`${path}.1`)) unlinkSync(`${path}.1`)
      renameSync(path, `${path}.1`)
    }
    appendFileSync(path, text)
  } catch {
    // Logging must never stop the server.
  }
  process.stdout.write(text)
}

export function readConfig(home = HOME): DesktopConfig {
  const file = join(home, 'config.json')
  const raw = JSON.parse(readFileSync(file, 'utf8')) as Partial<DesktopConfig>
  const cfg: DesktopConfig = {
    port: Number(raw.port) || 4580,
    pgPort: Number(raw.pgPort) || 55432,
    dbPassword: raw.dbPassword ?? '',
    licenceId: raw.licenceId ?? 'UNLICENSED',
    licenceEndpoint: raw.licenceEndpoint || LICENCE_ENDPOINT,
    installId: raw.installId || randomBytes(8).toString('hex'),
    backupEveryMin: Number(raw.backupEveryMin ?? 60),
    backupKeep: Number(raw.backupKeep ?? 168),
    backupCopyDir: raw.backupCopyDir ?? '',
    appVersion: raw.appVersion ?? 'vertex-erp',
    pairCode: raw.pairCode ?? '',
    mainUrl: raw.mainUrl ?? '',
    copyEveryMin: Number(raw.copyEveryMin ?? 10),
  }
  // First start: give the database its own password and remember it.
  if (!cfg.dbPassword || !raw.installId || (!cfg.mainUrl && !cfg.pairCode)) {
    cfg.dbPassword ||= randomBytes(24).toString('base64url')
    if (!cfg.mainUrl) cfg.pairCode ||= pairingCode()
    writeFileSync(file, JSON.stringify(cfg, null, 2))
  }
  return cfg
}

/** Eight characters without look-alikes (no 0/O, 1/I/L), shown as ABCD-EFGH. */
export function pairingCode(): string {
  const letters = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(8)
  const code = [...bytes].map((b) => letters[b % letters.length]).join('')
  return `${code.slice(0, 4)}-${code.slice(4)}`
}

const dbUrl = (c: DesktopConfig, database = 'vertex') => `postgres://vertex:${encodeURIComponent(c.dbPassword)}@127.0.0.1:${c.pgPort}/${database}`

function pgCtl(args: string[]) {
  // `start` hands its output handles to the database process, which keeps them open for as long
  // as it runs; capturing them would wait forever. Its messages go to logs\postgres.log instead.
  const detached = args[0] === 'start'
  return spawnSync(exe('pg_ctl'), args, { encoding: 'utf8', windowsHide: true, stdio: detached ? 'ignore' : 'pipe' })
}

/** The last lines of the database log, to explain a failed start. */
const pgLogTail = () => {
  try {
    return readFileSync(join(LOG_DIR, 'postgres.log'), 'utf8').trim().split(/\r?\n/).slice(-5).join(' | ')
  } catch {
    return ''
  }
}

const pgRunning = () => pgCtl(['status', '-D', DB_DIR]).status === 0

/** Create the database cluster once, then keep PostgreSQL running. */
async function ensurePostgres(c: DesktopConfig) {
  if (!existsSync(join(DB_DIR, 'PG_VERSION'))) {
    log('service.log', `creating the database in ${DB_DIR}`)
    mkdirSync(DB_DIR, { recursive: true })
    const pwfile = join(HOME, `.pw-${randomBytes(6).toString('hex')}`)
    writeFileSync(pwfile, c.dbPassword)
    try {
      const r = spawnSync(exe('initdb'), ['-D', DB_DIR, '-U', 'vertex', '-A', 'scram-sha-256', `--pwfile=${pwfile}`, '-E', 'UTF8', '--locale=C'], { encoding: 'utf8', windowsHide: true })
      if (r.status !== 0) throw new Error(`initdb failed: ${r.stderr || r.stdout}`)
    } finally {
      unlinkSync(pwfile)
    }
  }
  if (!pgRunning()) {
    log('service.log', 'starting PostgreSQL')
    const r = pgCtl(['start', '-D', DB_DIR, '-w', '-t', '180', '-l', join(LOG_DIR, 'postgres.log'), '-o', `-p ${c.pgPort} -c listen_addresses=127.0.0.1`])
    if (r.status !== 0) throw new Error(`PostgreSQL did not start (pg_ctl exit ${r.status}): ${pgLogTail()}`)
  }
  // The Vertex database inside the cluster.
  const admin = new pg.Client({ connectionString: dbUrl(c, 'postgres') })
  await admin.connect()
  try {
    const { rows } = await admin.query("select 1 from pg_database where datname = 'vertex'")
    if (!rows.length) await admin.query('create database vertex')
  } finally {
    await admin.end()
  }
}

function stopPostgres() {
  if (pgRunning()) {
    log('service.log', 'stopping PostgreSQL')
    pgCtl(['stop', '-D', DB_DIR, '-m', 'fast', '-w', '-t', '120'])
  }
}

/** The long-running supervisor Windows starts at boot. */
async function service() {
  mkdirSync(LOG_DIR, { recursive: true })
  const c = readConfig()
  log('service.log', `Vertex ERP service starting (home ${HOME}, port ${c.port})`)
  let stopping = false
  let child: ReturnType<typeof spawn> | null = null

  for (let attempt = 1; ; attempt++) {
    try {
      await ensurePostgres(c)
      break
    } catch (e) {
      log('service.log', `database start failed (attempt ${attempt}): ${e instanceof Error ? e.message : e}`)
      await new Promise((r) => setTimeout(r, Math.min(60, attempt * 5) * 1000))
    }
  }

  // A server left behind when Windows ended the previous service would hold the port.
  const pidFile = join(HOME, 'server.pid')
  if (existsSync(pidFile)) {
    const old = Number(readFileSync(pidFile, 'utf8'))
    // Only when our server really still answers — after a reboot the number may belong to another program.
    const alive = await fetch(`http://127.0.0.1:${c.port}/api/health`, { signal: AbortSignal.timeout(3000) }).then(
      () => true,
      () => false,
    )
    if (old > 0 && alive) {
      try {
        process.kill(old)
        log('service.log', `stopped a server left running from before (pid ${old})`)
      } catch {
        // Already gone.
      }
    }
    unlinkSync(pidFile)
  }

  const startServer = () => {
    if (stopping) return
    child = spawn(process.execPath, [process.argv[1], 'run', '--home', HOME], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    if (child.pid) writeFileSync(pidFile, String(child.pid))
    child.stdout?.on('data', (d: Buffer) => log('server.log', d.toString().trimEnd()))
    child.stderr?.on('data', (d: Buffer) => log('server.log', `ERR ${d.toString().trimEnd()}`))
    child.on('exit', (code) => {
      child = null
      if (stopping) return
      log('service.log', `server stopped (code ${code}); restarting in 5 seconds`)
      setTimeout(startServer, 5000)
    })
  }
  startServer()

  // Watch the database too: if it stops, start it again.
  const watch = setInterval(() => {
    if (stopping || pgRunning()) return
    log('service.log', 'PostgreSQL is not running — starting it again')
    ensurePostgres(c).catch((e) => log('service.log', `restart failed: ${e instanceof Error ? e.message : e}`))
  }, 30_000)

  const shutdown = () => {
    if (stopping) return
    stopping = true
    clearInterval(watch)
    log('service.log', 'Vertex ERP service stopping')
    child?.kill()
    setTimeout(() => {
      stopPostgres()
      process.exit(0)
    }, 3000)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
  process.on('SIGBREAK', shutdown)
}

/** The Vertex server on the local database. */
async function run() {
  const c = readConfig()
  const db = await openPostgres(dbUrl(c))
  const running = await startServing({
    db,
    label: `PostgreSQL on this computer, ${DB_DIR}`,
    port: c.port,
    staticDir: join(APP_DIR, 'client'),
    deployment: 'Windows (offline)',
    version: c.appVersion,
    licence: new LicenceGuard({ licenceId: c.licenceId, endpoint: c.licenceEndpoint, appVersion: c.appVersion, installId: c.installId }, metaStore(db)),
    backup: { dir: join(HOME, 'backups'), copyDir: c.backupCopyDir || undefined, keep: c.backupKeep, everyMin: c.backupEveryMin, appVersion: c.appVersion },
    replica: c.pairCode ? { pairCode: c.pairCode } : undefined,
    log: (l) => console.log(l),
  })
  const stop = () => void running.stop().then(() => process.exit(0))
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
}

async function backupNow() {
  const c = readConfig()
  await ensurePostgres(c)
  const db = await openPostgres(dbUrl(c))
  try {
    const { name } = await runBackup(db, fsBackupStore(join(HOME, 'backups')), { appVersion: c.appVersion, keep: c.backupKeep })
    console.log(join(HOME, 'backups', name))
  } finally {
    await db.close()
  }
}

async function status() {
  const c = readConfig()
  console.log(JSON.stringify({ home: HOME, database: pgRunning() ? 'running' : 'stopped', port: c.port, licenceId: c.licenceId, backupCopyDir: c.backupCopyDir || null }, null, 1))
  if (pgRunning()) {
    const db = await openPostgres(dbUrl(c))
    try {
      console.log(JSON.stringify(await new LicenceGuard({ licenceId: c.licenceId, endpoint: c.licenceEndpoint }, metaStore(db)).state(), null, 1))
    } finally {
      await db.close()
    }
  }
}

async function restore() {
  const file = process.argv[3]
  if (!file || file.startsWith('--')) throw new Error('Usage: restore <backup.zip> [--confirm] --home <folder>')
  const c = readConfig()
  const up = await fetch(`http://127.0.0.1:${c.port}/api/health`, { signal: AbortSignal.timeout(3000) }).then(
    () => true,
    () => false,
  )
  if (up) throw new Error('Vertex ERP is running. Stop the "Vertex ERP Server" task in Task Scheduler first, then run restore again.')
  const check = verifyArchive(readFileSync(resolve(file)))
  if (!check.ok) throw new Error(`This backup cannot be used: ${check.error}`)
  await ensurePostgres(c)
  const db = await openPostgres(dbUrl(c))
  try {
    await migrate(db)
    // Backups carry no password hashes (no passphrase): each administrator sets a new password afterwards.
    const options = { withoutCredentials: true, replace: true }
    const preview = await previewRestore(db, check.content, options)
    if (!process.argv.includes('--confirm')) {
      console.log(JSON.stringify({ dryRun: true, backup: check.content.manifest.exportedAt, ...preview, warnings: [...check.warnings, ...preview.warnings], next: preview.blockers.length ? 'Resolve the blockers first.' : 'Run again with --confirm to restore.' }, null, 1))
      return
    }
    if (preview.blockers.length) throw new Error(`Cannot restore: ${preview.blockers.join(' ')}`)
    const result = await restoreArchive(db, check.content, { ...options, preRestoreStore: fsBackupStore(join(HOME, 'backups')) })
    log('service.log', `restored backup ${file}`)
    console.log(JSON.stringify({ ok: true, ...result, next: 'Start the "Vertex ERP Server" task again. Each administrator sets a new password at first sign-in.' }, null, 1))
  } finally {
    await db.close()
  }
}

/** SECOND computer: keep a fresh copy of the main computer's data. */
async function copy() {
  const c = readConfig()
  if (!c.mainUrl || !c.pairCode) throw new Error('This computer is not set up as the second computer (mainUrl and pairCode missing).')
  const dir = join(HOME, 'copies')
  const incoming = join(dir, 'incoming')
  mkdirSync(incoming, { recursive: true })
  const statusFile = join(dir, 'status.json')
  const once = async () => {
    try {
      const res = await fetch(`${c.mainUrl.replace(/\/$/, '')}/api/replica/backup`, { headers: { 'x-vertex-pair': c.pairCode }, signal: AbortSignal.timeout(120_000) })
      if (res.status === 401) throw new Error('The main computer refused the pairing code. Run setup on this computer again with the code shown on the main computer.')
      if (!res.ok) throw new Error(`The main computer answered ${res.status}.`)
      const buf = Buffer.from(await res.arrayBuffer())
      const check = verifyArchive(buf)
      if (!check.ok) throw new Error(`The copy was damaged in transfer: ${check.error}`)
      const name = archiveName(new Date(check.content.manifest.exportedAt))
      writeFileSync(join(incoming, name), buf)
      copyToSecondPlace(incoming, name, join(dir, 'daily'), 400)
      writeFileSync(join(dir, 'latest.zip.tmp'), buf)
      renameSync(join(dir, 'latest.zip.tmp'), join(dir, 'latest.zip'))
      unlinkSync(join(incoming, name))
      const revision = check.content.manifest.database.revision
      writeFileSync(statusFile, JSON.stringify({ lastSuccessAt: new Date().toISOString(), revision, from: c.mainUrl, lastError: null }, null, 2))
      log('copy.log', `copy taken from ${c.mainUrl} (revision ${revision})`)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      let before: Record<string, unknown> = {}
      try {
        before = JSON.parse(readFileSync(statusFile, 'utf8'))
      } catch {
        before = {}
      }
      writeFileSync(statusFile, JSON.stringify({ ...before, lastErrorAt: new Date().toISOString(), lastError: message }, null, 2))
      log('copy.log', `copy not taken: ${message}`)
    }
  }
  log('copy.log', `copying from ${c.mainUrl} every ${c.copyEveryMin} minutes into ${dir}`)
  await once()
  setInterval(() => void once(), Math.max(1, c.copyEveryMin) * 60_000)
}

const commands: Record<string, () => Promise<void>> = { service, run, backup: backupNow, status, restore, copy }
const cmd = process.argv[2] ?? 'service'
;(commands[cmd] ?? (async () => { throw new Error(`Unknown command: ${cmd}. Use service, run, backup, status, restore or copy.`) }))().catch((e) => {
  log('service.log', `FATAL ${e instanceof Error ? e.stack : e}`)
  process.exit(1)
})
