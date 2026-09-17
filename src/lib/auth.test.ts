import { describe, expect, it } from 'vitest'
import { hashPassword, newSalt, passwordProblem, verifyPassword } from './auth'
import { setPasswordHash, resetPassword } from '../domain/system'
import { buildEmptyDB } from './defaults'
import { ADMIN, ctxFor, must } from '../test/fixtures'

describe('local account passwords', () => {
  it('hashes with a per-account salt and verifies only the right password', async () => {
    const salt = newSalt()
    const hash = await hashPassword('correct horse', salt)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(await verifyPassword('correct horse', salt, hash)).toBe(true)
    expect(await verifyPassword('wrong horse', salt, hash)).toBe(false)
    expect(await hashPassword('correct horse', newSalt())).not.toBe(hash)
  })

  it('validates length and confirmation', () => {
    expect(passwordProblem('short', 'short')).toMatch(/at least 8/)
    expect(passwordProblem('long enough', 'different')).toMatch(/do not match/)
    expect(passwordProblem('long enough', 'long enough')).toBeNull()
  })

  it('allows a first-time password once and records it per account', () => {
    const db = buildEmptyDB()
    const self = ctxFor(ADMIN[1])
    const first = must(setPasswordHash('USR-ADM2', 'h', 's', 'first-time')(db, self))
    expect(first.db.users.find((u) => u.id === 'USR-ADM2')?.passwordHash).toBe('h')
    expect(setPasswordHash('USR-ADM2', 'x', 'y', 'first-time')(first.db, self).ok).toBe(false)
    expect(first.db.audit[0].userId).toBe('USR-ADM2')

    const reset = must(resetPassword('USR-ADM2')(first.db, ctxFor(ADMIN[0])))
    expect(reset.db.users.find((u) => u.id === 'USR-ADM2')?.passwordHash).toBeNull()
    expect(reset.db.audit[0].user).toBe('Administrator 1')
  })
})
