import { describe, it, expect } from 'vitest'
import {
  computeSplit,
  buildPaystackSplit,
  gatewayFeeFor,
  type ResolvedShare,
  type SplitContext,
} from '../payments/splits'

// Helpers ---------------------------------------------------------------------
function share(over: Partial<ResolvedShare>): ResolvedShare {
  return {
    partyId: over.partyId ?? 'p',
    partyKey: over.partyKey ?? 'party',
    partyLabel: over.partyLabel ?? 'Party',
    partyKind: over.partyKind ?? 'FIXED',
    calcType: over.calcType ?? 'FLAT',
    value: over.value ?? 0,
    fixedSubAccountCode: over.fixedSubAccountCode ?? null,
  }
}

function ctx(over: Partial<SplitContext>): SplitContext {
  return {
    grossCents: over.grossCents ?? 50000,
    gatewayPercentBps: over.gatewayPercentBps ?? 150,
    gatewayFlatCents: over.gatewayFlatCents ?? 200,
    shares: over.shares ?? [],
    associationLevyCents: over.associationLevyCents ?? 0,
    driverSubAccountCode: over.driverSubAccountCode ?? null,
    associationSubAccountCode: over.associationSubAccountCode ?? null,
  }
}

const driverRemainder = share({
  partyId: 'd', partyKey: 'driver', partyLabel: 'Driver', partyKind: 'DRIVER', calcType: 'REMAINDER',
})

// gatewayFeeFor ---------------------------------------------------------------
describe('gatewayFeeFor', () => {
  it('matches the legacy 1.5% + R2 formula', () => {
    // legacy: Math.round(gross * 0.015) + 200
    expect(gatewayFeeFor(50000, 150, 200)).toBe(Math.round(50000 * 0.015) + 200)
    expect(gatewayFeeFor(50000, 150, 200)).toBe(950)
  })
  it('zero-rate gateway is just the flat fee', () => {
    expect(gatewayFeeFor(50000, 0, 200)).toBe(200)
  })
})

// computeSplit ----------------------------------------------------------------
describe('computeSplit', () => {
  it('driver-only scheme: driver gets gross minus gateway fee', () => {
    const r = computeSplit(ctx({ grossCents: 50000, shares: [driverRemainder] }))
    expect(r.ok).toBe(true)
    expect(r.gatewayFeeCents).toBe(950)
    expect(r.remainderCents).toBe(50000 - 950)
    expect(r.lines).toHaveLength(1)
    expect(r.lines[0].amountCents).toBe(49050)
  })

  it('flat + percent + remainder allocates exactly, no cents lost', () => {
    const r = computeSplit(ctx({
      grossCents: 50000,
      shares: [
        share({ partyKey: 'platform', calcType: 'FLAT', value: 1500 }),
        share({ partyKey: 'insurance', calcType: 'PERCENT', value: 1000 }), // 10% = 5000
        driverRemainder,
      ],
    }))
    expect(r.ok).toBe(true)
    const total = r.lines.reduce((s, l) => s + l.amountCents, 0) + r.gatewayFeeCents
    expect(total).toBe(50000) // gateway + all party lines reconcile to gross
    expect(r.lines.find(l => l.partyKey === 'insurance')!.amountCents).toBe(5000)
    expect(r.lines.find(l => l.partyKey === 'platform')!.amountCents).toBe(1500)
    expect(r.remainderCents).toBe(50000 - 950 - 1500 - 5000)
  })

  it('ASSOCIATION_LEVY reads the levy from context', () => {
    const r = computeSplit(ctx({
      grossCents: 50000,
      associationLevyCents: 800,
      shares: [
        share({ partyKey: 'association', partyKind: 'ASSOCIATION', calcType: 'ASSOCIATION_LEVY' }),
        driverRemainder,
      ],
    }))
    expect(r.lines.find(l => l.partyKey === 'association')!.amountCents).toBe(800)
    expect(r.remainderCents).toBe(50000 - 950 - 800)
  })

  it('flags over-allocation instead of returning a negative remainder', () => {
    const r = computeSplit(ctx({
      grossCents: 1000,
      shares: [share({ partyKey: 'greedy', calcType: 'FLAT', value: 5000 }), driverRemainder],
    }))
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(/over-allocated/)
  })

  it('requires exactly one REMAINDER share', () => {
    expect(computeSplit(ctx({ shares: [share({ calcType: 'FLAT', value: 10 })] })).ok).toBe(false)
    expect(computeSplit(ctx({ shares: [driverRemainder, { ...driverRemainder, partyId: 'x' }] })).ok).toBe(false)
  })

  it('rejects non-positive gross', () => {
    expect(computeSplit(ctx({ grossCents: 0, shares: [driverRemainder] })).ok).toBe(false)
  })

  it('resolves subaccounts per party kind', () => {
    const r = computeSplit(ctx({
      driverSubAccountCode: 'ACCT_driver',
      associationSubAccountCode: 'ACCT_assoc',
      associationLevyCents: 500,
      shares: [
        share({ partyKey: 'insurance', calcType: 'FLAT', value: 1000, fixedSubAccountCode: 'ACCT_ins' }),
        share({ partyKey: 'association', partyKind: 'ASSOCIATION', calcType: 'ASSOCIATION_LEVY' }),
        driverRemainder,
      ],
    }))
    expect(r.lines.find(l => l.partyKey === 'insurance')!.subAccountCode).toBe('ACCT_ins')
    expect(r.lines.find(l => l.partyKey === 'association')!.subAccountCode).toBe('ACCT_assoc')
    expect(r.lines.find(l => l.partyKey === 'driver')!.subAccountCode).toBe('ACCT_driver')
  })
})

// buildPaystackSplit ----------------------------------------------------------
describe('buildPaystackSplit', () => {
  it('routes only parties with a subaccount and positive amount', () => {
    const r = computeSplit(ctx({
      driverSubAccountCode: 'ACCT_driver',
      shares: [
        share({ partyKey: 'platform', calcType: 'FLAT', value: 1500 }), // no subaccount → main account
        driverRemainder,
      ],
    }))
    const split = buildPaystackSplit(r.lines)
    expect(split).not.toBeNull()
    expect(split!.type).toBe('flat')
    expect(split!.subaccounts).toEqual([{ subaccount: 'ACCT_driver', share: r.remainderCents }])
  })

  it('returns null when no party has a subaccount', () => {
    const r = computeSplit(ctx({ shares: [driverRemainder] }))
    expect(buildPaystackSplit(r.lines)).toBeNull()
  })

  it('honours a bearer subaccount', () => {
    const r = computeSplit(ctx({
      driverSubAccountCode: 'ACCT_driver',
      shares: [driverRemainder],
    }))
    const split = buildPaystackSplit(r.lines, { bearerSubAccount: 'ACCT_driver' })
    expect(split!.bearer_type).toBe('subaccount')
    expect(split!.bearer_subaccount).toBe('ACCT_driver')
  })
})
