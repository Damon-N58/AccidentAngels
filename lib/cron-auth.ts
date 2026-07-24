import { timingSafeEqual } from 'crypto'

/**
 * Constant-time check that a cron request carries the correct secret.
 * Avoids a timing side-channel that a plain `===` on the bearer token leaks.
 */
export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  const a = Buffer.from(header)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
