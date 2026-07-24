import { supabase } from './supabase'

/**
 * Distributed, fixed-window rate limiter backed by Postgres (see
 * scripts/payment-scale.sql -> check_rate_limit). Works across serverless
 * instances, unlike an in-process Map.
 *
 * Fail-open: if the backing store is briefly unavailable we allow the request
 * (availability for rural users on flaky networks matters, and the limiter is
 * defence-in-depth, not the only auth gate). Errors are logged.
 *
 * NOTE: this is now async — callers must `await` it.
 */
export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_key: key,
      p_max: maxAttempts,
      p_window_seconds: Math.max(1, Math.ceil(windowMs / 1000)),
    })
    if (error) {
      console.error('[rate-limit] rpc error, failing open:', error.message)
      return true
    }
    return data === true
  } catch (err) {
    console.error('[rate-limit] failing open:', err)
    return true
  }
}
