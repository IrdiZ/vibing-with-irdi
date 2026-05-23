import { createHmac, timingSafeEqual } from 'node:crypto'

// HMAC-signed cookie value helper. Used for the OAuth `state` round-trip so
// the slug we encode in the state can't be tampered with between /api/linkedin/start
// and /api/linkedin/callback.

const SECRET = process.env.SESSION_SECRET ?? 'dev-only-rotate-in-prod'

function sign(value: string): string {
  return createHmac('sha256', SECRET).update(value).digest('hex')
}

export function signValue(value: string): string {
  return `${value}.${sign(value)}`
}

export function unsignValue(signed: string): string | null {
  const idx = signed.lastIndexOf('.')
  if (idx === -1) return null
  const value = signed.slice(0, idx)
  const sig = signed.slice(idx + 1)
  const expected = sign(value)
  if (expected.length !== sig.length) return null
  try {
    if (!timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'))) return null
  } catch {
    return null
  }
  return value
}
