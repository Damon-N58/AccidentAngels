/**
 * Phase 3 QA – additional edge-case tests for calcWaitingCharge.
 *
 * Top 3 failure points covered:
 *   1. Non-integer seconds (sub-second ms) – floor behaviour must hold.
 *   2. Custom grace / rate overrides – the function must respect caller params.
 *   3. Huge waiting time (integer overflow guard) – result must be finite & correct.
 */

import { describe, it, expect } from 'vitest'
import { calcWaitingCharge } from './waiting-charge'

// ── Failure point 1: sub-second (fractional) milliseconds ──────────────────
// The function uses Math.floor(ms/1000). If ms is e.g. 180_999 the result is
// still 180 waiting seconds, which is exactly the grace period → 0 charge.
// A bug that used Math.round instead would produce 181 s → 500 cents.
describe('calcWaitingCharge – sub-second precision (floor guard)', () => {
  it('180_999 ms (grace + 999 ms) → still 180 s → 0 charge', () => {
    const arrivedAt = new Date(0)
    const completedAt = new Date(180_999)   // 180.999 s — still within grace after floor
    const result = calcWaitingCharge(arrivedAt, completedAt)
    expect(result).toEqual({ waitingSeconds: 180, billableMinutes: 0, chargeCents: 0 })
  })

  it('181_001 ms (1 ms past first billable second) → 181 s → 1 min → 500 cents', () => {
    const arrivedAt = new Date(0)
    const completedAt = new Date(181_001)
    const result = calcWaitingCharge(arrivedAt, completedAt)
    expect(result).toEqual({ waitingSeconds: 181, billableMinutes: 1, chargeCents: 500 })
  })
})

// ── Failure point 2: custom grace / rate overrides ──────────────────────────
// Callers can pass graceMinutes=0 (no free period) or a custom rateCentsPerMin.
// This exercises the parameter plumbing that is easy to break in a refactor.
describe('calcWaitingCharge – custom grace and rate params', () => {
  it('graceMinutes=0 → every second is billable (60 s → 1 min → custom rate)', () => {
    const arrivedAt = new Date(0)
    const completedAt = new Date(60_000)   // exactly 60 s
    const result = calcWaitingCharge(arrivedAt, completedAt, 0, 1000)
    expect(result).toEqual({ waitingSeconds: 60, billableMinutes: 1, chargeCents: 1000 })
  })

  it('graceMinutes=5 → 4 min 59 s total → still inside grace → 0 charge', () => {
    const arrivedAt = new Date(0)
    const completedAt = new Date(299_000)  // 299 s < 300 s (5 min)
    const result = calcWaitingCharge(arrivedAt, completedAt, 5, 500)
    expect(result).toEqual({ waitingSeconds: 299, billableMinutes: 0, chargeCents: 0 })
  })

  it('graceMinutes=5, 5 min 1 s total → 1 s over → ceiling 1 min → custom rate 750', () => {
    const arrivedAt = new Date(0)
    const completedAt = new Date(301_000)  // 301 s, grace=300 s, 1 s over → ceil(1/60)=1 min
    const result = calcWaitingCharge(arrivedAt, completedAt, 5, 750)
    expect(result).toEqual({ waitingSeconds: 301, billableMinutes: 1, chargeCents: 750 })
  })
})

// ── Failure point 3: very large waiting time (integer safety) ───────────────
// If a driver leaves a stop running for 24 hours (86_400 s), the function must
// produce a finite, correct integer result and never produce NaN/Infinity.
describe('calcWaitingCharge – large waiting time integrity', () => {
  it('24 hours waiting (86400 s) → 86220 s billable → 1437 min → 718500 cents', () => {
    // 86400 − 180 (grace) = 86220 s billable. 86220 / 60 = 1437 min exactly.
    const arrivedAt = new Date(0)
    const completedAt = new Date(86_400_000)
    const result = calcWaitingCharge(arrivedAt, completedAt)
    expect(result.waitingSeconds).toBe(86_400)
    expect(result.billableMinutes).toBe(1437)
    expect(result.chargeCents).toBe(718_500)
    expect(Number.isFinite(result.chargeCents)).toBe(true)
    expect(Number.isInteger(result.chargeCents)).toBe(true)
  })

  it('result is never NaN for any valid date pair', () => {
    const arrivedAt = new Date(1_000_000_000_000)
    const completedAt = new Date(1_000_000_000_000 + 500_000)  // +500 s
    const result = calcWaitingCharge(arrivedAt, completedAt)
    expect(Number.isNaN(result.waitingSeconds)).toBe(false)
    expect(Number.isNaN(result.billableMinutes)).toBe(false)
    expect(Number.isNaN(result.chargeCents)).toBe(false)
  })
})
