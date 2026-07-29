import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyTransaction } from '@/lib/payments/paystack-admin'
import { scheduleRetry } from '@/lib/payments/retry'
import { isCronAuthorized } from '@/lib/cron-auth'
import { assertPaymentsSchemaReady } from '@/lib/payments/schema-guard'
import { getActiveSplitScheme } from '@/lib/payments/splits'
import { computeCharge, recordSplits } from '@/lib/payments/compute-charge'

// Charges are external HTTP; give the run room to work through a batch.
export const maxDuration = 300

/**
 * Reconciliation sweep. For charges that are stuck in a non-terminal state
 * (PENDING / RETRY_SCHEDULED) — e.g. a charge that succeeded at Paystack but
 * whose confirming DB write was lost — ask Paystack for the authoritative
 * outcome and settle our record accordingly. This is what makes a lost-response
 * charge self-heal instead of being blindly re-charged.
 */
export async function POST(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const schema = await assertPaymentsSchemaReady()
  if (!schema.ok) {
    console.error('[reconcile] blocked — schema not ready:', schema.reason)
    return NextResponse.json({ error: 'Payments schema not ready', reason: schema.reason }, { status: 503 })
  }

  // Active split scheme, loaded once, to backfill the ledger for reconciled
  // successes (the lost DB write never recorded their TransactionSplit rows).
  const scheme = await getActiveSplitScheme(supabase)

  // Only look at rows old enough that a real response would have landed.
  const cutoff = new Date(Date.now() - 10 * 60_000).toISOString()
  const { data: rows } = await supabase
    .from('Transaction')
    .select('id, providerReference, status, grossAmountCents, driver:Driver(paystackSubAccountCode, association:Association(*))')
    .in('status', ['PENDING', 'RETRY_SCHEDULED'])
    .not('providerReference', 'is', null)
    .lte('updatedAt', cutoff)
    .order('updatedAt', { ascending: true })
    .limit(200)

  let resolved = 0,
    stillPending = 0,
    failed = 0,
    errors = 0
  const now = new Date().toISOString()

  for (const tx of rows ?? []) {
    try {
      const result = await verifyTransaction(tx.providerReference)

      if (result.status === 'success') {
        // Money actually moved — settle it. Idempotent: only from non-terminal.
        await supabase
          .from('Transaction')
          .update({ status: 'SUCCESS', nextRetryAt: null, claimedAt: null, updatedAt: now })
          .eq('id', tx.id)
          .in('status', ['PENDING', 'RETRY_SCHEDULED'])
        // Backfill the split ledger the lost DB write never recorded, so driver/
        // party payout reconciliation isn't missing this charge. Only when a
        // scheme is active (legacy mode records no TransactionSplit rows).
        if (scheme) {
          const driver = (tx as { driver?: { paystackSubAccountCode?: string | null; association?: { paystackSubAccountCode?: string | null; monthlyLevy?: number | null } | null } }).driver
          const computed = computeCharge(
            {
              grossCents: (tx as { grossAmountCents: number }).grossAmountCents,
              driverSubAccountCode: driver?.paystackSubAccountCode ?? null,
              associationSubAccountCode: driver?.association?.paystackSubAccountCode ?? null,
              associationLevyCents: driver?.association?.monthlyLevy ?? 0,
            },
            scheme,
            0,
            0,
          )
          if (computed.ok && computed.split) {
            try {
              await supabase.from('TransactionSplit').delete().eq('transactionId', tx.id)
              await recordSplits(tx.id, scheme, computed.split, now)
            } catch (splitErr) {
              console.error(`[reconcile] split backfill failed for tx ${tx.id} (already SUCCESS):`, splitErr)
            }
          }
        }
        resolved++
      } else if (result.status === 'failed' || result.status === 'abandoned') {
        await scheduleRetry(tx.id)
        failed++
      } else {
        stillPending++ // pending/ongoing — leave for the next sweep
      }
    } catch (err) {
      // Not-found / network: leave the row untouched for a later sweep.
      console.error(`[reconcile] verify failed for ${tx.id} (${tx.providerReference}):`, err)
      errors++
    }
  }

  return NextResponse.json({ ok: true, scanned: rows?.length ?? 0, resolved, failed, stillPending, errors })
}

// Vercel Cron triggers scheduled jobs with a GET request (carrying the
// `Authorization: Bearer $CRON_SECRET` header), so expose the same handler on
// GET. POST is retained for internal/manual invocation.
export const GET = POST
