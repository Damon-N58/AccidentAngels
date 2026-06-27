import { describe, it, expect } from 'vitest'
import { calcWaitingCharge } from './waiting-charge'

const t0 = new Date(0) // epoch as arrivedAt baseline

describe('calcWaitingCharge', () => {
  it('0 seconds waiting → 0 charge', () => {
    const result = calcWaitingCharge(t0, new Date(0))
    expect(result).toEqual({ waitingSeconds: 0, billableMinutes: 0, chargeCents: 0 })
  })

  it('180 seconds (exactly 3 min grace) → 0 charge', () => {
    const result = calcWaitingCharge(t0, new Date(180_000))
    expect(result).toEqual({ waitingSeconds: 180, billableMinutes: 0, chargeCents: 0 })
  })

  it('181 seconds (1 s over grace) → 1 billable minute → 500 cents', () => {
    const result = calcWaitingCharge(t0, new Date(181_000))
    expect(result).toEqual({ waitingSeconds: 181, billableMinutes: 1, chargeCents: 500 })
  })

  it('240 seconds (1 min over grace, ceiling) → 1 billable minute → 500 cents', () => {
    const result = calcWaitingCharge(t0, new Date(240_000))
    expect(result).toEqual({ waitingSeconds: 240, billableMinutes: 1, chargeCents: 500 })
  })

  it('241 seconds (61 s over grace, ceiling) → 2 billable minutes → 1000 cents', () => {
    const result = calcWaitingCharge(t0, new Date(241_000))
    expect(result).toEqual({ waitingSeconds: 241, billableMinutes: 2, chargeCents: 1000 })
  })

  it('1800 seconds (30 min total, 27 min billable) → 27 min → 13500 cents', () => {
    // 1800s total − 180s grace = 1620s billable = exactly 27 min
    const result = calcWaitingCharge(t0, new Date(1_800_000))
    expect(result).toEqual({ waitingSeconds: 1800, billableMinutes: 27, chargeCents: 13500 })
  })

  it('completedAt before arrivedAt (clock skew) → 0 charge', () => {
    const result = calcWaitingCharge(new Date(1_000_000), new Date(0))
    expect(result).toEqual({ waitingSeconds: 0, billableMinutes: 0, chargeCents: 0 })
  })
})
