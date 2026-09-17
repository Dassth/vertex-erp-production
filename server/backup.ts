/* ---------------------------------------------------------------------------
 * Portable backup archives ("take everything with me").
 *
 *   vertex-erp-backup-YYYY-MM-DD-HHmmss.zip
 *     manifest.json            format, versions, export time, revision, counts, file checksums
 *     data.json                every business record + saved recovery drafts (no credentials)
 *     credentials.enc.json     account password hashes, AES-256-GCM encrypted with the
 *                              backup passphrase (only when VERTEX_BACKUP_PASSPHRASE is set)
 *     migrations/NNNN_*.sql    the schema the data was exported from
 *     config.template.env      settings to fill in at the destination (placeholders only)
 *     RESTORE.md               supported restore procedure
 *
 * An archive is read from one committed snapshot (single REPEATABLE READ
 * transaction), written, read back and verified before it is reported.
 * Never included: session tokens, database passwords, API or service-role keys.
 * The app stores no attachments; the manifest records that explicitly.
 * ------------------------------------------------------------------------- */

import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'node:crypto'
import AdmZip from 'adm-zip'
import type { User, VertexDB } from '../src/lib/types'
import type { Database, Queryable } from './storage'
import { readState, schemaVersion, writeState } from './storage'
import { MIGRATIONS, SCHEMA_VERSION, migrationFileName } from './migrations'

export const ARCHIVE_FORMAT = 'vertex-erp-archive'
export const ARCHIVE_FORMAT_VERSION = 1
const LEGACY_FORMAT = 'vertex-erp-backup-v1'

type Credential = Pick<User, 'passwordHash' | 'passwordSalt' | 'passwordSetAt'>
export interface DraftRow {
  userId: string
  key: string
  rev: number
  data: string
}

export interface Manifest {
  format: typeof ARCHIVE_FORMAT
  formatVersion: number
  appVersion: string
  schemaVersion: number
  exportedAt: string
  database: { kind: string; schema: string; revision: number; updatedAt: string; updatedBy: string }
  counts: Record<string, number>
  counters: Record<string, number>
  files: Record<string, string>
  credentials: 'encrypted' | 'omitted' | 'none-set'
  attachments: { count: number; note: string }
  notice: string
}

export interface ArchiveContent {
  manifest: Manifest
  state: VertexDB
  drafts: DraftRow[]
  /** Only present after decrypting with the right passphrase. */
  credentials: Record<string, Credential> | null
  credentialsFile: EncryptedCredentials | null
  legacy?: boolean
}

interface EncryptedCredentials {
  kdf: 'scrypt'
  salt: string
  iv: string
  tag: string
  ciphertext: string
}

const sha256 = (buf: Buffer | string) => createHash('sha256').update(buf).digest('hex')

export function summarise(state: VertexDB, drafts: unknown[] = []): Record<string, number> {
  return {
    users: state.users.length,
    usersWithPassword: state.users.filter((u) => u.passwordHash).length,
    units: state.units?.length ?? 0,
    people: state.people?.length ?? 0,
    machines: state.machines?.length ?? 0,
    materials: state.materials.length,
    products: state.products.length,
    productStages: state.products.reduce((n, p) => n + p.stages.length, 0),
    productProcesses: state.products.reduce((n, p) => n + p.stages.reduce((m, s) => m + s.processes.length, 0), 0),
    productMaterialUsages: state.products.reduce((n, p) => n + p.materials.length, 0),
    customers: state.customers.length,
    plans: state.plans.length,
    costings: state.costings.length,
    orders: state.orders.length,
    dispatches: state.dispatches.length,
    dispatchesReceived: state.dispatches.filter((d) => d.receivedAt).length,
    invoices: state.invoices.length,
    notifications: state.notifications?.length ?? 0,
    auditEntries: state.audit.length,
    drafts: drafts.length,
  }
}

/* ------------------------------ credentials ------------------------------ */

function splitCredentials(state: VertexDB): { publicState: VertexDB; credentials: Record<string, Credential> } {
  const credentials: Record<string, Credential> = {}
  const users = state.users.map((u) => {
    if (u.passwordHash) credentials[u.id] = { passwordHash: u.passwordHash, passwordSalt: u.passwordSalt, passwordSetAt: u.passwordSetAt }
    return { ...u, passwordHash: null, passwordSalt: null, passwordSetAt: u.passwordHash ? u.passwordSetAt : null }
  })
  return { publicState: { ...state, users }, credentials }
}

function encryptCredentials(credentials: Record<string, Credential>, passphrase: string): EncryptedCredentials {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = scryptSync(passphrase, salt, 32)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(credentials), 'utf8'), cipher.final()])
  return { kdf: 'scrypt', salt: salt.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') }
}

function decryptCredentials(file: EncryptedCredentials, passphrase: string): Record<string, Credential> {
  const key = scryptSync(passphrase, Buffer.from(file.salt, 'base64'), 32)
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(file.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(file.tag, 'base64'))
  const plain = Buffer.concat([decipher.update(Buffer.from(file.ciphertext, 'base64')), decipher.final()])
  return JSON.parse(plain.toString('utf8'))
}

/* -------------------------------- export --------------------------------- */

const RESTORE_MD = `# Restoring a Vertex ERP backup

This archive restores the application data only up to its export time (see
manifest.json → exportedAt and database.revision). Anything saved later is not in it.

1. Prepare an EMPTY PostgreSQL database (a new Supabase project or any PostgreSQL 15+).
2. Fill in config.template.env for the destination and keep it out of source control.
3. Validate without writing anything:
   node dist-server/main.js restore <archive.zip> --into <DATABASE_URL> --dry-run
4. Restore (the schema in migrations/ is applied first):
   node dist-server/main.js restore <archive.zip> --into <DATABASE_URL> --confirm <destination-label>
   - Account passwords: set VERTEX_BACKUP_PASSPHRASE to the passphrase used when the
     archive was made. Without it, add --without-credentials: every account then
     chooses a new password at its first sign-in.
   - A destination that already holds data is refused. To replace it, add --replace;
     a pre-restore archive of the destination is written first.
5. Start the server against the destination (DATABASE_URL), sign in, check the records.
6. Keep the old deployment until the new one is verified.

The app's own login is used (not Supabase Auth); changing a Supabase account email
does not move these accounts — they live in this archive.
`

const CONFIG_TEMPLATE = `# Vertex ERP server configuration — placeholders only, never commit real values.
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<database>
# DATABASE_SCHEMA=public
PORT=8787
SECURE_COOKIES=1
BACKUP_DIR=<path on storage separate from the database>
BACKUP_INTERVAL_MIN=60
BACKUP_KEEP=72
# Passphrase that encrypts account password hashes inside backups (keep it outside the database).
VERTEX_BACKUP_PASSPHRASE=<long random passphrase>
`

async function snapshot(db: Database): Promise<{ row: NonNullable<Awaited<ReturnType<typeof readState>>>; drafts: DraftRow[]; schema: number }> {
  return db.transaction(async (tx: Queryable) => {
    if (db.kind === 'postgres') await tx.query('set transaction isolation level repeatable read')
    const row = await readState(tx)
    if (!row) throw new Error('Nothing to back up: the database has no state yet.')
    const { rows } = await tx.query<{ user_id: string; draft_key: string; rev: string; data: string }>('select user_id, draft_key, rev, data from vertex_drafts order by user_id, draft_key')
    return { row, drafts: rows.map((r) => ({ userId: r.user_id, key: r.draft_key, rev: Number(r.rev), data: r.data })), schema: await schemaVersion(tx) }
  })
}

export function archiveName(now: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return `vertex-erp-backup-${now.getUTCFullYear()}-${p(now.getUTCMonth() + 1)}-${p(now.getUTCDate())}-${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}Z.zip`
}

export async function buildArchive(db: Database, options: { now?: Date; passphrase?: string; appVersion?: string } = {}): Promise<{ buffer: Buffer; manifest: Manifest }> {
  const now = options.now ?? new Date()
  const { row, drafts, schema } = await snapshot(db)
  const { publicState, credentials } = splitCredentials(row.data)
  const hasCredentials = Object.keys(credentials).length > 0
  const files: Record<string, Buffer> = {
    'data.json': Buffer.from(JSON.stringify({ state: publicState, drafts }, null, 1)),
    'config.template.env': Buffer.from(CONFIG_TEMPLATE),
    'RESTORE.md': Buffer.from(RESTORE_MD),
  }
  for (const m of MIGRATIONS) files[`migrations/${migrationFileName(m)}`] = Buffer.from(m.sql.trim() + '\n')
  if (hasCredentials && options.passphrase) files['credentials.enc.json'] = Buffer.from(JSON.stringify(encryptCredentials(credentials, options.passphrase), null, 1))

  const manifest: Manifest = {
    format: ARCHIVE_FORMAT,
    formatVersion: ARCHIVE_FORMAT_VERSION,
    appVersion: options.appVersion ?? 'vertex-erp',
    schemaVersion: schema || SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    database: { kind: db.kind, schema: db.schema, revision: row.revision, updatedAt: row.updatedAt, updatedBy: row.updatedBy },
    counts: summarise(row.data, drafts),
    counters: row.data.counters as unknown as Record<string, number>,
    files: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, sha256(v)])),
    credentials: !hasCredentials ? 'none-set' : options.passphrase ? 'encrypted' : 'omitted',
    attachments: { count: 0, note: 'Vertex ERP stores no file attachments; issued documents are regenerated from their saved snapshots.' },
    notice: `Contains data committed up to revision ${row.revision} (${row.updatedAt}). Changes saved after ${now.toISOString()} are not included.`,
  }
  const zip = new AdmZip()
  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 1)))
  for (const [name, content] of Object.entries(files)) zip.addFile(name, content)
  return { buffer: zip.toBuffer(), manifest }
}

export interface BackupStatus {
  lastSuccessAt: string | null
  lastSuccessRevision: number | null
  lastSuccessName: string | null
  lastFailureAt: string | null
  lastFailure: string | null
  credentials: Manifest['credentials'] | null
}

export const EMPTY_STATUS: BackupStatus = { lastSuccessAt: null, lastSuccessRevision: null, lastSuccessName: null, lastFailureAt: null, lastFailure: null, credentials: null }

export interface ArchiveListing {
  name: string
  size: number
  exportedAt: string | null
  revision: number | null
}

/** Where archives are kept: a directory (Node) or an object bucket (Cloudflare R2). */
export interface BackupStore {
  /** Human-readable destination, e.g. a path or "R2 bucket vertex-erp-backups". */
  label: string
  put(name: string, data: Uint8Array, meta: { exportedAt: string; revision: number }): Promise<void>
  get(name: string): Promise<Uint8Array | null>
  list(): Promise<ArchiveListing[]>
  remove(name: string): Promise<void>
  readStatus(): Promise<BackupStatus>
  writeStatus(status: BackupStatus): Promise<void>
}

export const ARCHIVE_NAME = /^vertex-erp-backup-[A-Za-z0-9._-]+.zip$/

/** Write a timestamped archive, read it back and verify it, then record the result. */
export async function runBackup(db: Database, store: BackupStore, options: { now?: Date; passphrase?: string; appVersion?: string; keep?: number } = {}): Promise<{ name: string; manifest: Manifest }> {
  const now = options.now ?? new Date()
  const status = await store.readStatus().catch(() => ({ ...EMPTY_STATUS }))
  try {
    const { buffer, manifest } = await buildArchive(db, { ...options, now })
    const name = archiveName(now)
    await store.put(name, buffer, { exportedAt: manifest.exportedAt, revision: manifest.database.revision })
    const back = await store.get(name)
    if (!back) throw new Error('The backup could not be read back from ' + store.label)
    const check = verifyArchive(Buffer.from(back), { passphrase: options.passphrase })
    if (!check.ok) throw new Error(`Backup written but failed verification: ${check.error}`)
    await store.writeStatus({ ...status, lastSuccessAt: now.toISOString(), lastSuccessRevision: manifest.database.revision, lastSuccessName: name, credentials: manifest.credentials })
    if (options.keep) {
      const all = (await store.list()).map((l) => l.name).sort()
      for (const old of all.slice(0, Math.max(0, all.length - options.keep))) await store.remove(old)
    }
    return { name, manifest }
  } catch (err) {
    await store.writeStatus({ ...status, lastFailureAt: now.toISOString(), lastFailure: err instanceof Error ? err.message : String(err) }).catch(() => {})
    throw err
  }
}

/** Read the manifest summary of a stored archive (for listings). */
export function peekManifest(data: Uint8Array): { exportedAt: string | null; revision: number | null } {
  try {
    const m = JSON.parse(new AdmZip(Buffer.from(data)).getEntry('manifest.json')?.getData().toString('utf8') ?? '{}')
    return { exportedAt: m.exportedAt ?? m.createdAt ?? null, revision: m.database?.revision ?? m.revision ?? null }
  } catch {
    return { exportedAt: null, revision: null }
  }
}

/* ------------------------------ validation ------------------------------- */

export type ArchiveCheck = { ok: true; content: ArchiveContent; warnings: string[] } | { ok: false; error: string }

/** Validate an archive without touching any database. */
export function verifyArchive(buffer: Buffer, options: { passphrase?: string } = {}): ArchiveCheck {
  let zip: AdmZip
  try {
    zip = new AdmZip(buffer)
  } catch {
    return { ok: false, error: 'Not a readable ZIP archive.' }
  }
  const read = (name: string) => zip.getEntry(name)?.getData() ?? null
  const manifestBuf = read('manifest.json')
  const dataBuf = read('data.json')
  if (!manifestBuf || !dataBuf) return { ok: false, error: 'The archive is missing manifest.json or data.json.' }
  let manifest: Manifest
  let data: { state?: VertexDB; drafts?: DraftRow[]; format?: string; sha256?: string } & Record<string, unknown>
  try {
    manifest = JSON.parse(manifestBuf.toString('utf8'))
    data = JSON.parse(dataBuf.toString('utf8'))
  } catch {
    return { ok: false, error: 'manifest.json or data.json is not valid JSON.' }
  }

  // Archives written before format v1 (plain credentials inside data.json).
  if (data.format === LEGACY_FORMAT) {
    const { sha256: sum, ...content } = data
    if (sha256(JSON.stringify(content)) !== sum) return { ok: false, error: 'Checksum mismatch — the legacy archive was changed or is incomplete.' }
    const state = data.state as VertexDB
    const legacyManifest: Manifest = {
      format: ARCHIVE_FORMAT,
      formatVersion: 0,
      appVersion: 'legacy',
      schemaVersion: 1,
      exportedAt: String(data.createdAt ?? manifest.exportedAt ?? ''),
      database: { kind: 'unknown', schema: 'public', revision: Number(data.revision), updatedAt: String(data.updatedAt), updatedBy: String(data.updatedBy) },
      counts: summarise(state, (data.drafts as unknown[]) ?? []),
      counters: state.counters as unknown as Record<string, number>,
      files: {},
      credentials: 'none-set',
      attachments: { count: 0, note: '' },
      notice: 'Legacy archive: account password hashes are stored unencrypted inside it — keep it private.',
    }
    const { publicState, credentials } = splitCredentials(state)
    return {
      ok: true,
      content: { manifest: legacyManifest, state: publicState, drafts: (data.drafts as DraftRow[]) ?? [], credentials, credentialsFile: null, legacy: true },
      warnings: ['Legacy archive format (before v1). It contains unencrypted password hashes.'],
    }
  }

  if (manifest.format !== ARCHIVE_FORMAT) return { ok: false, error: 'Not a Vertex ERP backup archive.' }
  if (!(manifest.formatVersion >= 1 && manifest.formatVersion <= ARCHIVE_FORMAT_VERSION))
    return { ok: false, error: `Unsupported archive format version ${manifest.formatVersion}. This server reads version ${ARCHIVE_FORMAT_VERSION}.` }
  if (manifest.schemaVersion > SCHEMA_VERSION)
    return { ok: false, error: `The archive needs schema version ${manifest.schemaVersion}; this server only knows up to ${SCHEMA_VERSION}. Upgrade the server first.` }

  for (const [name, expected] of Object.entries(manifest.files ?? {})) {
    const buf = read(name)
    if (!buf) return { ok: false, error: `The archive is missing ${name}.` }
    if (sha256(buf) !== expected) return { ok: false, error: `Checksum mismatch in ${name} — the archive was changed or is incomplete.` }
  }
  if (!manifest.files?.['data.json']) return { ok: false, error: 'The manifest does not list data.json.' }

  const state = data.state
  const drafts = data.drafts ?? []
  if (!state || !Array.isArray(state.users)) return { ok: false, error: 'data.json has no dataset.' }
  const counts = summarise(state, drafts)
  for (const [k, v] of Object.entries(manifest.counts)) {
    // usersWithPassword is 0 in data.json by design (hashes live in credentials.enc.json).
    if (k === 'usersWithPassword') continue
    if (counts[k] !== v) return { ok: false, error: `Record count mismatch for ${k}: manifest ${v}, data ${counts[k]}.` }
  }
  if (state.users.some((u) => u.passwordHash || u.passwordSalt)) return { ok: false, error: 'data.json unexpectedly contains credentials.' }

  const warnings: string[] = []
  let credentials: Record<string, Credential> | null = null
  const encBuf = read('credentials.enc.json')
  const credentialsFile = encBuf ? (JSON.parse(encBuf.toString('utf8')) as EncryptedCredentials) : null
  if (credentialsFile) {
    if (options.passphrase) {
      try {
        credentials = decryptCredentials(credentialsFile, options.passphrase)
      } catch {
        return { ok: false, error: 'The backup passphrase does not open credentials.enc.json.' }
      }
    } else warnings.push('Account passwords are encrypted; provide the backup passphrase to restore them.')
  } else if (manifest.credentials === 'omitted') {
    warnings.push('This archive has no account passwords (no passphrase was configured). Accounts would choose new passwords after a restore.')
  }
  return { ok: true, content: { manifest, state, drafts, credentials, credentialsFile }, warnings }
}

/* -------------------------------- restore -------------------------------- */

export interface RestorePreview {
  destination: { kind: string; schema: string; empty: boolean; revision: number | null; counts: Record<string, number> | null }
  archive: { exportedAt: string; revision: number; counts: Record<string, number>; credentials: string; notice: string }
  warnings: string[]
  blockers: string[]
}

export async function previewRestore(target: Database, content: ArchiveContent, options: { withoutCredentials?: boolean; replace?: boolean } = {}): Promise<RestorePreview> {
  const existing = await readState(target)
  const blockers: string[] = []
  const warnings: string[] = []
  if (existing && !options.replace) blockers.push('The destination already holds data. Restore into an empty database, or use --replace (a pre-restore archive is written first).')
  const needsCredentials = content.manifest.credentials !== 'none-set' || (content.credentials && Object.keys(content.credentials).length > 0)
  if (needsCredentials && !content.credentials && !options.withoutCredentials)
    blockers.push('Account passwords are not available (missing or wrong passphrase). Provide the passphrase, or use --without-credentials so accounts choose new passwords.')
  if (needsCredentials && !content.credentials && options.withoutCredentials) warnings.push('Accounts will have no passwords after the restore; each chooses one at first sign-in.')
  return {
    destination: { kind: target.kind, schema: target.schema, empty: !existing, revision: existing?.revision ?? null, counts: existing ? summarise(existing.data) : null },
    archive: {
      exportedAt: content.manifest.exportedAt,
      revision: content.manifest.database.revision,
      counts: content.manifest.counts,
      credentials: content.credentials ? 'available' : content.manifest.credentials,
      notice: content.manifest.notice,
    },
    warnings,
    blockers,
  }
}

function mergeCredentials(state: VertexDB, credentials: Record<string, Credential> | null): VertexDB {
  if (!credentials) return state
  return { ...state, users: state.users.map((u) => (credentials[u.id] ? { ...u, ...credentials[u.id] } : u)) }
}

/** JSONB does not preserve key order; compare structurally. */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]))
  return value
}

/**
 * Restore an archive. Refuses a populated destination unless `replace` is set,
 * in which case a pre-restore archive of the destination is written first.
 * Afterwards the stored data, revision, counters and drafts are compared with the archive.
 */
export async function restoreArchive(
  target: Database,
  content: ArchiveContent,
  options: { withoutCredentials?: boolean; replace?: boolean; preRestoreStore?: BackupStore; passphrase?: string } = {},
): Promise<{ revision: number; counts: Record<string, number>; preRestoreBackup: string | null }> {
  const preview = await previewRestore(target, content, options)
  if (preview.blockers.length) throw new Error(preview.blockers.join(' '))
  let preRestoreBackup: string | null = null
  if (!preview.destination.empty) {
    if (!options.preRestoreStore) throw new Error('A pre-restore backup destination is required when replacing data.')
    preRestoreBackup = `${options.preRestoreStore.label}/${(await runBackup(target, options.preRestoreStore, { passphrase: options.passphrase })).name}`
  }
  const state = mergeCredentials(content.state, content.credentials)
  const m = content.manifest.database
  await target.transaction(async (tx) => {
    if (!preview.destination.empty) {
      await tx.query('delete from vertex_sessions')
      await tx.query('delete from vertex_drafts')
      await tx.query('delete from vertex_history')
    }
    await writeState(tx, { revision: m.revision, data: state, actor: m.updatedBy, command: `restore:${content.manifest.exportedAt}`, at: new Date(m.updatedAt) })
    for (const d of content.drafts) await tx.query('insert into vertex_drafts (user_id, draft_key, rev, data) values ($1, $2, $3, $4)', [d.userId, d.key, d.rev, d.data])
    await tx.query(`insert into vertex_meta (key, value) values ('restored_from', $1) on conflict (key) do update set value = excluded.value`, [
      JSON.stringify({ exportedAt: content.manifest.exportedAt, revision: m.revision, at: new Date().toISOString() }),
    ])
  })
  const restored = await readState(target)
  if (!restored) throw new Error('Restore did not produce a dataset.')
  if (restored.revision !== m.revision) throw new Error(`Revision mismatch after restore (${restored.revision} ≠ ${m.revision}).`)
  if (JSON.stringify(sortKeys(restored.data)) !== JSON.stringify(sortKeys(state))) throw new Error('Restored data differs from the archive.')
  const { rows } = await target.query<{ n: string }>('select count(*) as n from vertex_drafts')
  if (Number(rows[0].n) !== content.drafts.length) throw new Error('Restored drafts differ from the archive.')
  return { revision: restored.revision, counts: summarise(restored.data, content.drafts), preRestoreBackup }
}
