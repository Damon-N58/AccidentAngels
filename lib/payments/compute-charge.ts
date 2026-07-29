import { supabase } from '@/lib/supabase'
import {
  computeSplit,
  buildPaystackSplit,
  gatewayFeeFor,
  type ActiveScheme,
  type SplitResult,
} from './splits'
import { randomUUID } from 'crypto'

/** Context needed to split one charge. */
export interface ChargeCtx {
  grossCents: number
  driverSubAccountCode: string | null
  associationSubAccountCode: string | null
  associationLevyCents: number
}

/** Legacy column values every Transaction row still stores, for reporting. */
export interface LegacyCols {
  gatewayFeeCents: number
  platformFeeCents: number
  associationLevyCents: number
  tccSplitCents: number
  driverNetCents: number
}

export interface ComputedCharge {
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
export function computeCharge(
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

  // ── Fallback when no scheme is active (migration not yet run) ──
  // Gateway fee = Paystack ZA local 2.9% + R1, +15% VAT = 3.335% + R1.15.
  const gatewayFeeCents = gatewayFeeFor(ctx.grossCents, 334, 115)
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

/** Write the per-charge split audit rows (idempotent via the unique index). */
export async function recordSplits(
  transactionId: string,
  scheme: ActiveScheme,
  split: SplitResult,
  nowIso: string,
): Promise<void> {
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
