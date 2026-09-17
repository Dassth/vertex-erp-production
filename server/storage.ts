/* ---------------------------------------------------------------------------
 * PostgreSQL storage.
 *
 * The whole business dataset is one JSONB document with a revision number, so
 * every domain rule keeps running unchanged. Writes happen inside a transaction
 * that locks the single state row (SELECT … FOR UPDATE): concurrent commands are
 * serialised and each one is applied to the latest committed data, and a caller
 * is told "saved" only after COMMIT returned.
 *
 * Two drivers share the same SQL:
 *   • `pg`     — a PostgreSQL server (DATABASE_URL), for deployment;
 *   • PGlite   — the PostgreSQL engine embedded in Node, for local use and tests.
 * ------------------------------------------------------------------------- */

import type { User, VertexDB } from '../src/lib/types'
import { MIGRATIONS, MIGRATIONS_TABLE, migrationFileName, statements } from './migrations'

export interface Queryable {
  query<R = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: R[] }>
}

export interface Database extends Queryable {
  kind: 'postgres' | 'pglite'
  /** Schema holding the Vertex tables ('public' unless configured). */
  schema: string
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>
  close(): Promise<void>
}

/** The full schema as one script (for reference and backup archives). Applied through MIGRATIONS. */
export const SCHEMA = MIGRATIONS.map((m) => `-- ${migrationFileName(m)}\n${m.sql.trim()}`).join('\n\n')

/** How many full revisions are kept for recovery inside the database (backups are kept separately). */
export const HISTORY_LIMIT = 200

const SCHEMA_NAME = /^[a-z_][a-z0-9_]{0,62}$/

/**
 * Connect to a PostgreSQL server. With `schema`, every statement runs with
 * `SET LOCAL search_path` inside its own transaction, which also works through
 * Supabase's transaction pooler (session settings would leak between clients).
 */
export async function openPostgres(connectionString: string, options: { schema?: string; migrate?: boolean; max?: number } = {}): Promise<Database> {
  const schema = options.schema ?? 'public'
  if (!SCHEMA_NAME.test(schema)) throw new Error(`Invalid schema name “${schema}”.`)
  const { default: pg } = await import('pg')
  const pool = new pg.Pool({ connectionString, max: options.max ?? 10 })
  const scoped = schema !== 'public'
  if (scoped && options.migrate !== false) await pool.query(`create schema if not exists "${schema}"`)
  const db: Database = {
    kind: 'postgres',
    schema,
    query: (sql, params) => (scoped ? db.transaction((tx) => tx.query(sql, params)) : (pool.query(sql, params) as never)),
    async transaction(fn) {
      const client = await pool.connect()
      try {
        await client.query('begin')
        if (scoped) await client.query(`set local search_path to "${schema}"`)
        const result = await fn({ query: (sql, params) => client.query(sql, params) as never })
        await client.query('commit')
        return result
      } catch (err) {
        await client.query('rollback').catch(() => {})
        throw err
      } finally {
        client.release()
      }
    },
    close: () => pool.end(),
  }
  if (options.migrate !== false) await migrate(db)
  return db
}

/** Apply pending versioned migrations, each in its own transaction. */
export async function migrate(db: Database): Promise<number[]> {
  await db.query(MIGRATIONS_TABLE)
  const { rows } = await db.query<{ version: number }>('select version from vertex_schema_migrations')
  const done = new Set(rows.map((r) => Number(r.version)))
  const applied: number[] = []
  for (const m of MIGRATIONS) {
    if (done.has(m.version)) continue
    await db.transaction(async (tx) => {
      for (const statement of statements(m.sql)) await tx.query(statement)
      await tx.query('insert into vertex_schema_migrations (version, name) values ($1, $2)', [m.version, migrationFileName(m)])
    })
    applied.push(m.version)
  }
  return applied
}

export async function schemaVersion(db: Queryable): Promise<number> {
  const { rows } = await db.query<{ v: number | null }>('select max(version) as v from vertex_schema_migrations')
  return Number(rows[0]?.v ?? 0)
}

export interface StateRow {
  revision: number
  data: VertexDB
  updatedAt: string
  updatedBy: string
}

function toRow(r: { revision: string | number; data: unknown; updated_at: string | Date; updated_by: string }): StateRow {
  return {
    revision: Number(r.revision),
    data: (typeof r.data === 'string' ? JSON.parse(r.data) : r.data) as VertexDB,
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
    updatedBy: r.updated_by,
  }
}

export async function readState(q: Queryable, lock = false): Promise<StateRow | null> {
  const { rows } = await q.query<{ revision: string; data: unknown; updated_at: string; updated_by: string }>(
    `select revision, data, updated_at, updated_by from vertex_state where id = 1${lock ? ' for update' : ''}`,
  )
  return rows[0] ? toRow(rows[0]) : null
}

/** One account from the state document, without transferring the whole document. */
export async function readUser(q: Queryable, userId: string): Promise<User | null> {
  const { rows } = await q.query<{ u: unknown }>(`select u from vertex_state, jsonb_array_elements(data->'users') u where id = 1 and u->>'id' = $1`, [userId])
  const u = rows[0]?.u
  return u ? ((typeof u === 'string' ? JSON.parse(u) : u) as User) : null
}

export async function writeState(q: Queryable, next: { revision: number; data: VertexDB; actor: string; command: string; at: Date }) {
  const json = JSON.stringify(next.data)
  await q.query(
    `insert into vertex_state (id, revision, data, updated_at, updated_by) values (1, $1, $2::jsonb, $3, $4)
     on conflict (id) do update set revision = excluded.revision, data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    [next.revision, json, next.at.toISOString(), next.actor],
  )
  // Copy the document inside the database: sending it twice doubles the payload,
  // and large writes drop the connection on Cloudflare Workers.
  await q.query(
    `insert into vertex_history (revision, command, actor, at, data)
     select revision, $1, updated_by, updated_at, data from vertex_state where id = 1`,
    [next.command],
  )
  await q.query(`delete from vertex_history where revision <= $1`, [next.revision - HISTORY_LIMIT])
}
