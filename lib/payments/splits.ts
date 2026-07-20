/**
 * Configurable multi-party payment splitting.
 *
 * The parent pays a fixed monthly `grossCents`. That gross is divided among
 * configured parties (insurance, association, platform, Accident Angels, …);
 * the driver receives the REMAINDER after the gateway fee and every other cut.
 *
 * `computeSplit` and `buildPaystackSplit` are PURE (no DB) so the money maths
 * is unit-tested in isolation. DB loaders live at the bottom of the file.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type SplitPartyKind = 'FIXED' | 'DRIVER' | 'ASSOCIATION'
export type SplitCalcType = 'PERCENT' | 'FLAT' | 'REMAINDER' | 'ASSOCIATION_LEVY'

/** A scheme share with its party details already joined in. */
export interface ResolvedShare {
  partyId: string
  partyKey: string
  partyLabel: string
  partyKind: SplitPartyKind
  calcType: SplitCalcType
  value: number
  /** subaccount for FIXED parties; DRIVER/ASSOCIATION resolve from context */
  fixedSubAccountCode: string | null
}

export interface SplitContext {
  grossCents: number
  gatewayPercentBps: number
  gatewayFlatCents: number
  shares: ResolvedShare[]
  /** the charged driver's association monthly levy (for ASSOCIATION_LEVY shares) */
  associationLevyCents: number
  driverSubAccountCode: string | null
  associationSubAccountCode: string | null
}

export interface SplitLine {
  partyId: string
  partyKey: string
  partyLabel: string
  partyKind: SplitPartyKind
  calcType: SplitCalcType
  amountCents: number
  /** where this money actually routes; null → settles to the main account */
  subAccountCode: string | null
}

export interface SplitResult {
  ok: boolean
  errors: string[]
  grossCents: number
  gatewayFeeCents: number
  /** the REMAINDER party's amount (usually the driver's net) */
  remainderCents: number
  lines: SplitLine[]
}

/** Gateway fee: percentage of gross (basis points) plus a flat fee, in cents. */
export function gatewayFeeFor(grossCents: number, percentBps: number, flatCents: number): number {
  return Math.round((grossCents * percentBps) / 10000) + flatCents
}

function resolveSubAccount(share: ResolvedShare, ctx: SplitContext): string | null {
  switch (share.partyKind) {
    case 'DRIVER':      return ctx.driverSubAccountCode
    case 'ASSOCIATION': return ctx.associationSubAccountCode
    case 'FIXED':       return share.fixedSubAccountCode
  }
}

/**
 * Pure split calculation. Never throws — validation problems surface as
 * `ok: false` + `errors`, so a caller can decide whether to charge.
 */
export function computeSplit(ctx: SplitContext): SplitResult {
  const errors: string[] = []
  const { grossCents } = ctx

  if (!Number.isInteger(grossCents) || grossCents <= 0) {
    errors.push(`grossCents must be a positive integer, got ${grossCents}`)
  }

  const gatewayFeeCents = gatewayFeeFor(grossCents, ctx.gatewayPercentBps, ctx.gatewayFlatCents)

  const remainderShares = ctx.shares.filter(s => s.calcType === 'REMAINDER')
  if (remainderShares.length !== 1) {
    errors.push(`exactly one REMAINDER share required, found ${remainderShares.length}`)
  }

  const lines: SplitLine[] = []
  let allocated = gatewayFeeCents // gateway fee comes off the top

  for (const share of ctx.shares) {
    if (share.calcType === 'REMAINDER') continue

    let amountCents: number
    switch (share.calcType) {
      case 'PERCENT':
        if (share.value < 0) errors.push(`${share.partyKey}: percentage cannot be negative`)
        amountCents = Math.round((grossCents * share.value) / 10000)
        break
      case 'FLAT':
        if (share.value < 0) errors.push(`${share.partyKey}: flat amount cannot be negative`)
        amountCents = share.value
        break
      case 'ASSOCIATION_LEVY':
        amountCents = Math.max(0, ctx.associationLevyCents)
        break
      default:
        amountCents = 0
    }

    allocated += amountCents
    lines.push({
      partyId: share.partyId,
      partyKey: share.partyKey,
      partyLabel: share.partyLabel,
      partyKind: share.partyKind,
      calcType: share.calcType,
      amountCents,
      subAccountCode: resolveSubAccount(share, ctx),
    })
  }

  const remainderCents = grossCents - allocated
  if (remainderCents < 0) {
    errors.push(
      `over-allocated: gateway fee + party cuts (${allocated}c) exceed gross (${grossCents}c)`,
    )
  }

  const remainder = remainderShares[0]
  if (remainder) {
    lines.push({
      partyId: remainder.partyId,
      partyKey: remainder.partyKey,
      partyLabel: remainder.partyLabel,
      partyKind: remainder.partyKind,
      calcType: 'REMAINDER',
      amountCents: remainderCents,
      subAccountCode: resolveSubAccount(remainder, ctx),
    })
  }

  return {
    ok: errors.length === 0,
    errors,
    grossCents,
    gatewayFeeCents,
    remainderCents,
    lines,
  }
}

// ── Paystack inline split ────────────────────────────────────────────────────

export interface PaystackSplitPayload {
  type: 'flat'
  bearer_type: 'account' | 'subaccount'
  bearer_subaccount?: string
  subaccounts: { subaccount: string; share: number }[]
}

/**
 * Build a Paystack inline (dynamic) transaction split from computed lines.
 * Only parties WITH a subaccount code and a positive amount are routed at the
 * gateway; everything else settles to the main (integrator) account for manual
 * disbursement via the Payout table. Returns null if nothing to route.
 */
export function buildPaystackSplit(
  lines: SplitLine[],
  opts: { bearerSubAccount?: string | null } = {},
): PaystackSplitPayload | null {
  const subaccounts = lines
    .filter(l => l.subAccountCode && l.amountCents > 0)
    .map(l => ({ subaccount: l.subAccountCode as string, share: l.amountCents }))

  if (subaccounts.length === 0) return null

  return {
    type: 'flat',
    bearer_type: opts.bearerSubAccount ? 'subaccount' : 'account',
    ...(opts.bearerSubAccount ? { bearer_subaccount: opts.bearerSubAccount } : {}),
    subaccounts,
  }
}

// ── DB loaders (Supabase) ────────────────────────────────────────────────────

export interface ActiveScheme {
  id: string
  name: string
  gatewayPercentBps: number
  gatewayFlatCents: number
  shares: ResolvedShare[]
}

/**
 * Load the single active split scheme with its shares + joined party details,
 * ordered by the share sortOrder. Returns null if no scheme is active.
 */
export async function getActiveSplitScheme(
  db: SupabaseClient,
): Promise<ActiveScheme | null> {
  const { data: scheme } = await db
    .from('SplitScheme')
    .select('*')
    .eq('isActive', true)
    .maybeSingle()
  if (!scheme) return null

  const { data: shares } = await db
    .from('SplitShare')
    .select('*, party:SplitParty(*)')
    .eq('schemeId', scheme.id)
    .order('sortOrder', { ascending: true })

  const resolved: ResolvedShare[] = (shares ?? [])
    .filter((s: { party?: { isActive?: boolean } }) => s.party?.isActive !== false)
    .map((s: {
      partyId: string
      calcType: SplitCalcType
      value: number
      party: { key: string; label: string; kind: SplitPartyKind; paystackSubAccountCode: string | null }
    }) => ({
      partyId: s.partyId,
      partyKey: s.party.key,
      partyLabel: s.party.label,
      partyKind: s.party.kind,
      calcType: s.calcType,
      value: s.value,
      fixedSubAccountCode: s.party.paystackSubAccountCode ?? null,
    }))

  return {
    id: scheme.id,
    name: scheme.name,
    gatewayPercentBps: scheme.gatewayPercentBps,
    gatewayFlatCents: scheme.gatewayFlatCents,
    shares: resolved,
  }
}
