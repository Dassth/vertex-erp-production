/* ---------------------------------------------------------------------------
 * Local account passwords.
 *
 * Accounts ship WITHOUT a password — the first sign-in on each account chooses
 * one, so no credential is embedded in the build. Passwords are stored as
 * PBKDF2-SHA-256 hashes with a per-account salt.
 *
 * LIMITATION: this is browser-local authentication. Anyone with access to the
 * browser profile can read or clear localStorage. It identifies who performed
 * an action for audit purposes; it is not a security boundary.
 * ------------------------------------------------------------------------- */

export const PBKDF2_ITERATIONS = 120_000
export const MIN_PASSWORD_LENGTH = 8

function toHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2))
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

export function newSalt(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return toHex(bytes)
}

export async function hashPassword(password: string, saltHex: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations: PBKDF2_ITERATIONS },
    key,
    256,
  )
  return toHex(bits)
}

export async function verifyPassword(password: string, saltHex: string, hashHex: string): Promise<boolean> {
  const candidate = await hashPassword(password, saltHex)
  if (candidate.length !== hashHex.length) return false
  let diff = 0
  for (let i = 0; i < candidate.length; i++) diff |= candidate.charCodeAt(i) ^ hashHex.charCodeAt(i)
  return diff === 0
}

export function passwordProblem(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH)
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`
  if (password !== confirm) return 'The two passwords do not match.'
  return null
}
