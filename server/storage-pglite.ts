/* Embedded PostgreSQL (PGlite) for local development and tests — never used in the Cloudflare Worker. */

import type { Database } from './storage'
import { migrate } from './storage'

export async function openPglite(dataDir?: string): Promise<Database> {
  const { PGlite } = await import('@electric-sql/pglite')
  const pg = dataDir ? await PGlite.create(dataDir) : await PGlite.create()
  const db: Database = {
    kind: 'pglite',
    schema: 'public',
    query: (sql, params) => pg.query(sql, params) as never,
    transaction: (fn) => pg.transaction((tx) => fn({ query: (sql, params) => tx.query(sql, params) as never })),
    close: () => pg.close(),
  }
  await migrate(db)
  return db
}
