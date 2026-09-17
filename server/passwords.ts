/* ---------------------------------------------------------------------------
 * Server-side password hashing with node:crypto.
 *
 * Same scheme as the browser build (src/lib/auth.ts): PBKDF2-SHA-256,
 * 120,000 iterations, 32-byte key, hex salt — so existing hashes verify
 * unchanged. node:crypto is used because the Cloudflare Workers Web Crypto
 * API refuses PBKDF2 above 100,000 iterations.
 * ------------------------------------------------------------------------- */

import { pbkdf2, timingSafeEqual } from 'node:crypto'
import { PBKDF2_ITERATIONS } from '../src/lib/auth'
import type { Queryable } from './storage'

export { newSalt, passwordProblem } from '../src/lib/auth'

function derive(password: string, saltHex: string): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    pbkdf2(password, Buffer.from(saltHex, 'hex'), PBKDF2_ITERATIONS, 32, 'sha256', (err, key) => (err ? reject(err) : resolve(key))),
  )
}

export interface PasswordHasher {
  hash(password: string, saltHex: string): Promise<string>
  verify(password: string, saltHex: string, hashHex: string): Promise<boolean>
}

function equalHex(candidateHex: string, expectedHex: string): boolean {
  const a = Buffer.from(candidateHex, 'hex')
  const b = Buffer.from(expectedHex, 'hex')
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b)
}

/** In-process hashing (Node). */
export const nodeHasher: PasswordHasher = {
  async hash(password, saltHex) {
    return (await derive(password, saltHex)).toString('hex')
  },
  async verify(password, saltHex, hashHex) {
    return equalHex((await derive(password, saltHex)).toString('hex'), hashHex)
  },
}

/**
 * Hashing inside PostgreSQL (migration 0003, vertex_pbkdf2_sha256). For runtimes
 * that cannot run PBKDF2 at 120,000 iterations themselves, such as Cloudflare
 * Workers; the result is byte-identical, so existing passwords keep working.
 */
export function databaseHasher(db: Queryable): PasswordHasher {
  const run = async (password: string, saltHex: string) => {
    const { rows } = await db.query<{ h: string }>('select vertex_pbkdf2_sha256($1, $2, $3) as h', [password, saltHex, PBKDF2_ITERATIONS])
    if (!rows[0]?.h) throw new Error('Password hashing is unavailable in the database.')
    return rows[0].h
  }
  return {
    hash: run,
    async verify(password, saltHex, hashHex) {
      return equalHex(await run(password, saltHex), hashHex)
    },
  }
}
