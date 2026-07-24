import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getActiveSplitScheme } from '@/lib/payments/splits'
import { computeCharge } from '@/lib/payments/compute-charge'
import { isCronAuthorized } from '@/lib/cron-auth'
import { randomUUID } from 'crypto'

// Enqueue is fast (no external charges) but can span thousands of contracts.
export const maxDuration = 300

async function getConfig(key: string): Promise<string | null> {
  const { data } = await supabase.from('PlatformConfig').select('value').eq('key', key).maybeSingle()
  return data?.value ?? null
}

/**
 * Monthly billing ENQUEUE.
 *
 * This does NOT charge anyone. It creates one PENDING Transaction row per due
 * contract (the row IS the queue item). The charge worker
 * (/api/cron/billing-charge) then claims and charges those rows with bounded
 * concurrency, so no single invocation has to make thousands of sequential
 * gateway calls. Enqueue is idempotent: the unique index on
 * (parentId, childId, billingMonth, billingYear) means a re-run or overlapping
 * run can't create a second row (23505 -> skip).
 */
export async function POST(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const paymentsLive = await getConfig('PAYMENTS_LIVE')
  if (paymentsLive !== 'true') {
    return NextResponse.json({ ok: true, skipped: true, reason: 'PAYMENTS_LIVE is false' })
  }

  const legacyPlatformFeeCents = parseInt((await getConfig('PLATFORM_FEE_CENTS')) ?? '0')
  const legacyTccSplitCents = parseInt((await getConfig('TCC_SPLIT_CENTS')) ?? '0')
  const scheme = await getActiveSplitScheme(supabase)

  const now = new Date()
  const nowIso = now.toISOString()
  const billingMonth = now.getMonth() + 1
  const billingYear = now.getFullYear()

  let enqueued = 0,
    skipped = 0,
    misconfigured = 0

  let offset = 0
  const BATCH_SIZE = 200
  let batch: any[] = []

  do {
    // Batch the per-contract lookups: fetch the page, then resolve children in
    // one query (avoids an N+1 Child SELECT per contract).
    const { data: contracts } = await supabase
      .from('Contract')
      .select('*, parent:Parent(*), driver:Driver(paystackSubAccountCode, association:Association(*))')
      .eq('status', 'FULLY_SIGNED')
      .order('id', { ascending: true }) // stable order for offset paging
      .range(offset, offset + BATCH_SIZE - 1)
    batch = contracts ?? []

    const childIds = [...new Set(batch.map(c => c.childId))]
    const { data: children } = childIds.length
      ? await supabase.from('Child').select('id, isActive').in('id', childIds)
      : { data: [] as { id: string; isActive: boolean }[] }
    const activeChild = new Map((children ?? []).map(c => [c.id, c.isActive]))

    for (const contract of batch) {
      const parent = contract.parent
      // Gate: active, fully set-up, ACTIVE mandate, active child.
      if (!parent?.paymentMethodType || !parent.isPaymentSetup) { skipped++; continue }
      if (parent.paymentMethodStatus && parent.paymentMethodStatus !== 'ACTIVE') { skipped++; continue }
      if (activeChild.get(contract.childId) === false) { skipped++; continue }

      const grossAmountCents = contract.monthlyAmountCents
      const computed = computeCharge(
        {
          grossCents: grossAmountCents,
          driverSubAccountCode: contract.driver?.paystackSubAccountCode ?? null,
          associationSubAccountCode: contract.driver?.association?.paystackSubAccountCode ?? null,
          associationLevyCents: contract.driver?.association?.monthlyLevy ?? 0,
        },
        scheme,
        legacyPlatformFeeCents,
        legacyTccSplitCents,
      )

      // Deterministic reference: stable across re-runs so Paystack de-dupes.
      const reference = `bill_${contract.id}_${billingYear}${String(billingMonth).padStart(2, '0')}`
      const safeLegacy = { ...computed.legacy, driverNetCents: Math.max(0, computed.legacy.driverNetCents) }

      const { error: insertErr } = await supabase.from('Transaction').insert({
        id: randomUUID(),
        parentId: contract.parentId,
        driverId: contract.driverId,
        childId: contract.childId,
        billingMonth,
        billingYear,
        grossAmountCents,
        ...safeLegacy,
        paymentMethodType: parent.paymentMethodType,
        // A misconfigured scheme is enqueued straight to FAILED — never charged.
        status: computed.ok ? 'PENDING' : 'FAILED',
        failureReason: computed.ok ? null : `split error: ${computed.error}`,
        providerReference: reference,
        attemptCount: 0,
        claimedAt: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      })

      if (insertErr) {
        // 23505 = already enqueued this month (idempotent) — not an error.
        if ((insertErr as { code?: string }).code === '23505') { skipped++; continue }
        console.error(`[billing/enqueue] insert failed for contract ${contract.id}:`, insertErr)
        skipped++
        continue
      }
      if (!computed.ok) misconfigured++
      else enqueued++
    }

    offset += BATCH_SIZE
  } while (batch.length === BATCH_SIZE)

  return NextResponse.json({
    ok: true,
    phase: 'enqueue',
    enqueued,
    skipped,
    misconfigured,
    scheme: scheme?.name ?? 'legacy-fallback',
  })
}
