import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getPaymentProvider } from '@/lib/payments'
import { scheduleRetry } from '@/lib/payments/retry'
import {
  getActiveSplitScheme,
  computeSplit,
  buildPaystackSplit,
  gatewayFeeFor,
  type ActiveScheme,
  type SplitResult,
} from '@/lib/payments/splits'
import { randomUUID } from 'crypto'

const CRON_SECRET = process.env.CRON_SECRET

function isCronAuthorized(request: Request): boolean {
  if (!CRON_SECRET) return false
  return request.headers.get('authorization') === `Bearer ${CRON_SECRET}`
}

async function getConfig(key: string): Promise<string | null> {
  const { data } = await supabase.from('PlatformConfig').select('value').eq('key', key).maybeSingle()
  return data?.value ?? null
}

/** Context needed to split one charge. */
interface ChargeCtx {
  grossCents: number
  driverSubAccountCode: string | null
  associationSubAccountCode: string | null
  associationLevyCents: number
}

/** Legacy column values every Transaction row still stores, for reporting. */
interface LegacyCols {
  gatewayFeeCents: number
  platformFeeCents: number
  associationLevyCents: number
  tccSplitCents: number
  driverNetCents: number
}

interface ComputedCharge {
  ok: boolean
  error?: string
  legacy: LegacyCols
  /** engine result — null on the legacy fallback path (no active scheme) */
  split: SplitResult | null
  paystackSplit: ReturnType<typeof buildPaystackSplit>
}

/**
 * Compute the split for a single charge. Uses the active scheme when present;
 * otherwise falls back to the exact legacy formula so billing keeps working
 * before the payment-splits migration is applied.
 */
function computeCharge(
  ctx: ChargeCtx,
  scheme: ActiveScheme | null,
  legacyPlatformFeeCents: number,
  legacyTccSplitCents: number,
): ComputedCharge {
  if (scheme) {
    const result = computeSplit({
      grossCents: ctx.grossCents,
      gatewayPercentBps: scheme.gatewayPercentBps,
      gatewayFlatCents: scheme.gatewayFlatCents,
      shares: scheme.shares,
      associationLevyCents: ctx.associationLevyCents,
      driverSubAccountCode: ctx.driverSubAccountCode,
      associationSubAccountCode: ctx.associationSubAccountCode,
    })

    const lineBy = (key: string) => result.lines.find(l => l.partyKey === key)?.amountCents ?? 0
    return {
      ok: result.ok,
      error: result.ok ? undefined : result.errors.join('; '),
      legacy: {
        gatewayFeeCents: result.gatewayFeeCents,
        platformFeeCents: lineBy('nineteen58'),
        tccSplitCents: lineBy('accident_angels'),
        associationLevyCents: result.lines.find(l => l.partyKind === 'ASSOCIATION')?.amountCents ?? 0,
        driverNetCents: result.remainderCents,
      },
      split: result,
      paystackSplit: buildPaystackSplit(result.lines),
    }
  }

  // ── Legacy fallback: identical to the original hard-coded split ──
  const gatewayFeeCents = gatewayFeeFor(ctx.grossCents, 150, 200)
  const driverNetCents =
    ctx.grossCents - gatewayFeeCents - legacyPlatformFeeCents - ctx.associationLevyCents - legacyTccSplitCents
  return {
    ok: driverNetCents >= 0,
    error: driverNetCents >= 0 ? undefined : 'legacy split over-allocated (driver net < 0)',
    legacy: {
      gatewayFeeCents,
      platformFeeCents: legacyPlatformFeeCents,
      associationLevyCents: ctx.associationLevyCents,
      tccSplitCents: legacyTccSplitCents,
      driverNetCents,
    },
    split: null,
    paystackSplit: null,
  }
}

async function recordSplits(transactionId: string, scheme: ActiveScheme, split: SplitResult, nowIso: string) {
  const rows = split.lines.map(l => ({
    id: randomUUID(),
    transactionId,
    schemeId: scheme.id,
    partyId: l.partyId,
    partyKey: l.partyKey,
    partyLabel: l.partyLabel,
    partyKind: l.partyKind,
    calcType: l.calcType,
    resolvedSubAccountCode: l.subAccountCode,
    amountCents: l.amountCents,
    createdAt: nowIso,
  }))
  if (rows.length) await supabase.from('TransactionSplit').insert(rows)
}

export async function POST(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const paymentsLive = await getConfig('PAYMENTS_LIVE')
  if (paymentsLive !== 'true') {
    return NextResponse.json({ ok: true, skipped: true, reason: 'PAYMENTS_LIVE is false' })
  }

  // Legacy config values are only used if no split scheme is active yet.
  const legacyPlatformFeeCents = parseInt((await getConfig('PLATFORM_FEE_CENTS')) ?? '0')
  const legacyTccSplitCents = parseInt((await getConfig('TCC_SPLIT_CENTS')) ?? '0')
  const scheme = await getActiveSplitScheme(supabase)

  const now = new Date()
  const nowIso = now.toISOString()
  const billingMonth = now.getMonth() + 1
  const billingYear = now.getFullYear()

  let charged = 0,
    failed = 0,
    retried = 0

  // ── Process overdue retries ──
  const { data: pendingRetries } = await supabase
    .from('Transaction')
    .select('*, parent:Parent(*), driver:Driver(paystackSubAccountCode, association:Association(*))')
    .eq('status', 'RETRY_SCHEDULED')
    .lte('nextRetryAt', nowIso)
    .limit(100)

  for (const tx of pendingRetries ?? []) {
    if (!tx.parent.paymentMethodType) continue
    try {
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
        // Terminal: a bad scheme won't fix itself on retry. Clear nextRetryAt
        // and mark FAILED so the cron stops re-picking this row every run.
        await supabase
          .from('Transaction')
          .update({
            status: 'FAILED',
            failureReason: `split error: ${computed.error}`,
            nextRetryAt: null,
            lastAttemptAt: nowIso,
            updatedAt: nowIso,
          })
          .eq('id', tx.id)
        failed++
        continue
      }

      const provider = getPaymentProvider(tx.parent.paymentMethodType)
      const result = await provider.chargeMandate({
        parentId: tx.parentId,
        childId: tx.childId,
        driverId: tx.driverId,
        amountCents: tx.grossAmountCents,
        billingMonth: tx.billingMonth,
        billingYear: tx.billingYear,
        reference: `retry_${tx.id}_${Date.now()}`,
        split: computed.paystackSplit ?? undefined,
      })

      if (result.success) {
        await supabase
          .from('Transaction')
          .update({
            status: 'SUCCESS',
            providerReference: result.providerReference,
            providerChargeId: result.providerChargeId,
            attemptCount: tx.attemptCount + 1,
            lastAttemptAt: nowIso,
            nextRetryAt: null,
            updatedAt: nowIso,
            ...computed.legacy,
          })
          .eq('id', tx.id)
        if (scheme && computed.split) {
          await supabase.from('TransactionSplit').delete().eq('transactionId', tx.id)
          await recordSplits(tx.id, scheme, computed.split, nowIso)
        }
        retried++
      } else {
        await supabase
          .from('Transaction')
          .update({
            attemptCount: tx.attemptCount + 1,
            failureReason: result.error,
            failureCode: result.errorCode,
            lastAttemptAt: nowIso,
            updatedAt: nowIso,
          })
          .eq('id', tx.id)
        await scheduleRetry(tx.id)
        failed++
      }
    } catch (err) {
      console.error(`[billing] retry error for tx ${tx.id}:`, err)
    }
  }

  // ── New monthly billing — process in batches of 50 ──
  let offset = 0
  const BATCH_SIZE = 50
  let batchContracts: any[] = []

  do {
    const { data: contracts } = await supabase
      .from('Contract')
      .select('*, parent:Parent(*), driver:Driver(paystackSubAccountCode, association:Association(*))')
      .eq('status', 'FULLY_SIGNED')
      .range(offset, offset + BATCH_SIZE - 1)
    batchContracts = contracts ?? []

    for (const contract of batchContracts) {
      const { data: child } = await supabase.from('Child').select('isActive').eq('id', contract.childId).maybeSingle()
      if (!child?.isActive) continue
      const { data: existing } = await supabase
        .from('Transaction')
        .select('id')
        .eq('parentId', contract.parentId)
        .eq('childId', contract.childId)
        .eq('billingMonth', billingMonth)
        .eq('billingYear', billingYear)
        .neq('status', 'CANCELLED')
        .maybeSingle()
      if (existing) continue
      if (!contract.parent.paymentMethodType || !contract.parent.isPaymentSetup) continue

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

      const reference = `bill_${contract.id}_${billingYear}${String(billingMonth).padStart(2, '0')}_${randomUUID().slice(0, 8)}`

      // A misconfigured scheme must never charge the parent — record the row
      // straight to FAILED. Clamp financial columns so we never persist a
      // negative amount from an over-allocated split.
      const safeLegacy = { ...computed.legacy, driverNetCents: Math.max(0, computed.legacy.driverNetCents) }
      const { data: tx, error: insertErr } = await supabase
        .from('Transaction')
        .insert({
          id: randomUUID(),
          parentId: contract.parentId,
          driverId: contract.driverId,
          childId: contract.childId,
          billingMonth,
          billingYear,
          grossAmountCents,
          ...safeLegacy,
          paymentMethodType: contract.parent.paymentMethodType,
          status: computed.ok ? 'PENDING' : 'FAILED',
          failureReason: computed.ok ? null : `split error: ${computed.error}`,
          providerReference: reference,
          attemptCount: computed.ok ? 0 : 1,
          lastAttemptAt: computed.ok ? null : nowIso,
          createdAt: nowIso,
          updatedAt: nowIso,
        })
        .select()
        .single()

      if (insertErr || !tx) {
        console.error(`[billing] insert failed for contract ${contract.id}:`, insertErr)
        failed++
        continue
      }
      if (!computed.ok) {
        failed++
        continue
      }

      try {
        const provider = getPaymentProvider(contract.parent.paymentMethodType)
        const result = await provider.chargeMandate({
          parentId: contract.parentId,
          childId: contract.childId,
          driverId: contract.driverId,
          amountCents: grossAmountCents,
          billingMonth,
          billingYear,
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
              attemptCount: 1,
              lastAttemptAt: nowIso,
              updatedAt: nowIso,
            })
            .eq('id', tx.id)
          if (scheme && computed.split) await recordSplits(tx.id, scheme, computed.split, nowIso)
          charged++
        } else {
          await supabase
            .from('Transaction')
            .update({
              status: 'FAILED',
              failureReason: result.error,
              failureCode: result.errorCode,
              attemptCount: 1,
              lastAttemptAt: nowIso,
              updatedAt: nowIso,
            })
            .eq('id', tx.id)
          await scheduleRetry(tx.id)
          failed++
        }
      } catch (err) {
        console.error(`[billing] charge error for contract ${contract.id}:`, err)
        await supabase
          .from('Transaction')
          .update({
            status: 'FAILED',
            failureReason: String(err),
            attemptCount: 1,
            lastAttemptAt: nowIso,
            updatedAt: nowIso,
          })
          .eq('id', tx.id)
        await scheduleRetry(tx.id)
        failed++
      }
    }

    offset += BATCH_SIZE
    // Keep paging while the batch came back full; a short batch is the last page.
  } while (batchContracts.length === BATCH_SIZE)

  return NextResponse.json({ ok: true, charged, failed, retried, scheme: scheme?.name ?? 'legacy-fallback' })
}
