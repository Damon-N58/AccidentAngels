import { supabase } from '@/lib/supabase'

/**
 * Fail-closed go-live gate for the billing pipeline.
 *
 * The double-charge safety of billing depends on DB objects created only by the
 * hand-run scripts in scripts/payment-*.sql (the partial unique index, the
 * claimedAt column, the check_rate_limit function). If any migration is skipped
 * in an environment, concurrent billing can double-charge. This check refuses to
 * run billing unless check_payments_schema() reports every object present.
 *
 * The RPC (check_payments_schema) is itself part of the migration set, so its
 * absence — an RPC error — also means "migrations not applied" and fails closed.
 *
 * A successful result is cached for the lifetime of the (warm) instance so this
 * is at most one extra round-trip per cold start, not per request.
 */
let cachedReady = false

export async function assertPaymentsSchemaReady(): Promise<{ ok: boolean; reason?: string }> {
  if (cachedReady) return { ok: true }

  try {
    const { data, error } = await supabase.rpc('check_payments_schema')
    if (error) {
      return {
        ok: false,
        reason: `payments schema guard unavailable — migrations likely not applied (run scripts/payment-*.sql): ${error.message}`,
      }
    }

    const result = data as { ready?: boolean; missing?: string[] } | null
    if (result?.ready !== true) {
      const missing = result?.missing ?? []
      return { ok: false, reason: `payments schema incomplete; missing: ${missing.join(', ') || 'unknown'}` }
    }

    cachedReady = true
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: `payments schema check threw: ${(err as Error).message}` }
  }
}
