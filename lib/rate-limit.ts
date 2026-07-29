import { supabase } from './supabase'

/**
 * Distributed, fixed-window rate limiter backed by Postgres (see
 * scripts/payment-scale.sql -> check_rate_limit). Works across serverless
 * instances, unlike an in-process Map.
 *
 * Failure behaviour is caller-controlled via `failClosed`:
 *  - failClosed: false (default) — if the backing store is briefly unavailable
 *    we ALLOW the request. Use for non-security throttles where availability
 *    matters more (the limiter is defence-in-depth there).
 *  - failClosed: true — if the store errors we DENY the request. Use for
 *    auth-critical limits (OTP send/verify, admin login) so a store hiccup
 *    cannot silently disable brute-force / SMS-flood protection.
 *
 * NOTE: this is async — callers must `await` it.
 */
export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
  opts: { failClosed?: boolean } = {},
): Promise<boolean> {
  const allowOnError = !opts.failClosed
  try {
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_key: key,
      p_max: maxAttempts,
      p_window_seconds: Math.max(1, Math.ceil(windowMs / 1000)),
    })
    if (error) {
      console.error(`[rate-limit] rpc error, failing ${allowOnError ? 'open' : 'CLOSED'}:`, error.message)
      return allowOnError
    }
    return data === true
  } catch (err) {
    console.error(`[rate-limit] failing ${allowOnError ? 'open' : 'CLOSED'}:`, err)
    return allowOnError
  }
}
