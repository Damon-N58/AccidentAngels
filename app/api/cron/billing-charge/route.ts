import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getPaymentProvider } from '@/lib/payments'
import { getActiveSplitScheme } from '@/lib/payments/splits'
import { computeCharge, recordSplits } from '@/lib/payments/compute-charge'
import { scheduleRetry } from '@/lib/payments/retry'
import { isCronAuthorized } from '@/lib/cron-auth'
import { assertPaymentsSchemaReady } from '@/lib/payments/schema-guard'

export const maxDuration = 300

const CRON_SECRET = process.env.CRON_SECRET
const CONCURRENCY = 6 // gateway calls in flight at once
const CLAIM_BATCH = 60 // rows claimed per loop
const TIME_BUDGET_MS = 240_000 // stop before the 300s hard limit and continue later

async function getConfig(key: string): Promise<string | null> {
  const { data } = await supabase.from('PlatformConfig').select('value').eq('key', key).maybeSingle()
  return data?.value ?? null
}

/**
 * Billing charge WORKER (queue drain).
 *
 * Claims a batch of queued Transaction rows (PENDING, or RETRY_SCHEDULED that is
 * due) by stamping claimedAt in a single atomic UPDATE, then charges them with
 * bounded concurrency. Two workers can never charge the same row: the atomic
 * `claimedAt IS NULL` guard means only one UPDATE wins a row. Runs until the
 * queue is drained or the time budget is hit, then re-invokes itself.
 */
export async function POST(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fail closed: never charge if the claim/idempotency DB objects are missing.
  const schema = await assertPaymentsSchemaReady()
  if (!schema.ok) {
    console.error('[billing-charge] blocked — schema not ready:', schema.reason)
    return NextResponse.json({ error: 'Payments schema not ready', reason: schema.reason }, { status: 503 })
  }

  const paymentsLive = await getConfig('PAYMENTS_LIVE')
  if (paymentsLive !== 'true') {
    return NextResponse.json({ ok: true, skipped: true, reason: 'PAYMENTS_LIVE is false' })
  }

  const legacyPlatformFeeCents = parseInt((await getConfig('PLATFORM_FEE_CENTS')) ?? '0')
  const legacyTccSplitCents = parseInt((await getConfig('TCC_SPLIT_CENTS')) ?? '0')
  const scheme = await getActiveSplitScheme(supabase)

  const start = Date.now()
  let charged = 0,
    failed = 0,
    unknown = 0
  let budgetHit = false

  while (Date.now() - start < TIME_BUDGET_MS) {
    const nowIso = new Date().toISOString()

    // Candidate work: unclaimed PENDING, or due RETRY_SCHEDULED that is unclaimed.
    const { data: candidates } = await supabase
      .from('Transaction')
      .select('*, parent:Parent(paymentMethodType), driver:Driver(paystackSubAccountCode, association:Association(*))')
      .is('claimedAt', null)
      .or(`status.eq.PENDING,and(status.eq.RETRY_SCHEDULED,nextRetryAt.lte.${nowIso})`)
      .order('createdAt', { ascending: true })
      .limit(CLAIM_BATCH)

    if (!candidates || candidates.length === 0) break

    // Atomically claim — only rows still unclaimed are returned to this worker.
    const ids = candidates.map(c => c.id)
    const { data: claimedRows } = await supabase
      .from('Transaction')
      .update({ claimedAt: nowIso, updatedAt: nowIso })
      .in('id', ids)
      .is('claimedAt', null)
      .select('id')
    const claimedIds = new Set((claimedRows ?? []).map(r => r.id))
    const work = candidates.filter(c => claimedIds.has(c.id))
    if (work.length === 0) continue

    // Charge in bounded-concurrency chunks.
    for (let i = 0; i < work.length; i += CONCURRENCY) {
      const chunk = work.slice(i, i + CONCURRENCY)
      const results = await Promise.all(chunk.map(tx => chargeOne(tx, scheme, legacyPlatformFeeCents, legacyTccSplitCents)))
      for (const r of results) {
        if (r === 'charged') charged++
        else if (r === 'failed') failed++
        else if (r === 'unknown') unknown++
      }
    }

    if (Date.now() - start >= TIME_BUDGET_MS) { budgetHit = true; break }
  }

  // If we stopped on the time budget there is likely more queued work; kick off
  // a continuation. (A scheduled cron is the reliable backstop — see vercel.json.)
  if (budgetHit && CRON_SECRET) {
    try {
      void fetch(new URL('/api/cron/billing-charge', request.url).toString(), {
        method: 'POST',
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      })
    } catch { /* best-effort; the scheduled cron continues regardless */ }
  }

  return NextResponse.json({ ok: true, phase: 'charge', charged, failed, unknown, continued: budgetHit })
}

// Vercel Cron triggers scheduled jobs with a GET request (carrying the
// `Authorization: Bearer $CRON_SECRET` header), so expose the same handler on
// GET. POST is retained for the internal self-continuation fetch above.
export const GET = POST

type ChargeOutcome = 'charged' | 'failed' | 'skipped' | 'unknown'

async function chargeOne(
  tx: any,
  scheme: Awaited<ReturnType<typeof getActiveSplitScheme>>,
  legacyPlatformFeeCents: number,
  legacyTccSplitCents: number,
): Promise<ChargeOutcome> {
  const nowIso = new Date().toISOString()
  try {
    if (!tx.parent?.paymentMethodType) {
      await supabase.from('Transaction').update({ claimedAt: null, updatedAt: nowIso }).eq('id', tx.id)
      return 'skipped'
    }

    const computed = computeCharge(
      {
        grossCents: tx.grossAmountCents,
        driverSubAccountCode: tx.driver?.paystackSubAccountCode ?? null,
        associationSubAccountCode: tx.driver?.association?.paystackSubAccountCode ?? null,
        associationLevyCents: tx.driver?.association?.monthlyLevy ?? 0,
      },
      scheme,
      legacyPlatformFeeCents,
      legacyTccSplitCents,
    )
    if (!computed.ok) {
      await supabase
        .from('Transaction')
        .update({ status: 'FAILED', failureReason: `split error: ${computed.error}`, claimedAt: null, updatedAt: nowIso })
        .eq('id', tx.id)
      return 'failed'
    }

    // Deterministic reference: reuse the enqueued bill_ ref for PENDING; for a
    // retry use a per-attempt ref and persist it so the webhook can match.
    const isRetry = tx.status === 'RETRY_SCHEDULED'
    const reference = isRetry ? `retry_${tx.id}_${tx.attemptCount + 1}` : tx.providerReference
    if (isRetry) {
      await supabase.from('Transaction').update({ providerReference: reference }).eq('id', tx.id)
    }

    const provider = getPaymentProvider(tx.parent.paymentMethodType)
    const result = await provider.chargeMandate({
      parentId: tx.parentId,
      childId: tx.childId,
      driverId: tx.driverId,
      amountCents: tx.grossAmountCents,
      billingMonth: tx.billingMonth,
      billingYear: tx.billingYear,
      reference,
      split: computed.paystackSplit ?? undefined,
    })

    if (result.success) {
      await supabase
        .from('Transaction')
        .update({
          status: 'SUCCESS',
          providerReference: result.providerReference ?? reference,
          providerChargeId: result.providerChargeId,
          attemptCount: tx.attemptCount + 1,
          lastAttemptAt: nowIso,
          nextRetryAt: null,
          claimedAt: null,
          updatedAt: nowIso,
          ...computed.legacy,
          driverNetCents: Math.max(0, computed.legacy.driverNetCents),
        })
        .eq('id', tx.id)
      if (scheme && computed.split) {
        try {
          await supabase.from('TransactionSplit').delete().eq('transactionId', tx.id)
          await recordSplits(tx.id, scheme, computed.split, nowIso)
        } catch (splitErr) {
          console.error(`[billing-charge] split-record failed for tx ${tx.id} (already SUCCESS):`, splitErr)
        }
      }
      return 'charged'
    }

    // UNKNOWN outcome (timeout / network / non-2xx): the charge MAY have landed
    // at the gateway. Release the claim but do NOT mark failed, do NOT bump
    // attemptCount, do NOT schedule a retry and do NOT allocate a new reference
    // — any of which would risk re-charging a charge that already succeeded.
    // The reconcile cron verifies THIS reference against Paystack and settles it.
    if (result.outcome === 'unknown') {
      console.warn(`[billing-charge] unknown outcome for tx ${tx.id} (left for reconcile): ${result.error}`)
      await supabase.from('Transaction').update({ claimedAt: null, updatedAt: nowIso }).eq('id', tx.id)
      return 'unknown'
    }

    // Definitive decline (money did NOT move): advance the retry schedule
    // (also clears the claim).
    await supabase
      .from('Transaction')
      .update({
        failureReason: result.error,
        failureCode: result.errorCode,
        attemptCount: tx.attemptCount + 1,
        lastAttemptAt: nowIso,
        claimedAt: null,
        updatedAt: nowIso,
      })
      .eq('id', tx.id)
    await scheduleRetry(tx.id)
    return 'failed'
  } catch (err) {
    // Backstop: an unexpected throw (e.g. a DB write itself failing) is also an
    // unknown outcome. Release the claim WITHOUT marking failed so reconcile
    // verifies with Paystack before any re-charge.
    console.error(`[billing-charge] charge error for tx ${tx.id} (left for reconcile):`, err)
    await supabase.from('Transaction').update({ claimedAt: null, updatedAt: nowIso }).eq('id', tx.id)
    return 'unknown'
  }
}
