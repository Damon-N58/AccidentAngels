import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'
import {
  verifyPaystackSignature,
  canPromoteToSuccess,
  canApplyRefund,
  isDisputeEvent,
} from '../webhook-logic'

const SECRET = 'whsec_test_secret'
function sign(body: string, secret = SECRET): string {
  return createHmac('sha512', secret).update(body).digest('hex')
}

describe('verifyPaystackSignature', () => {
  const body = JSON.stringify({ event: 'charge.success', data: { reference: 'r' } })

  it('accepts a correct signature', () => {
    expect(verifyPaystackSignature(body, sign(body), SECRET)).toBe(true)
  })

  it('rejects a wrong signature', () => {
    expect(verifyPaystackSignature(body, sign(body, 'other'), SECRET)).toBe(false)
  })

  it('rejects a tampered body', () => {
    const sig = sign(body)
    expect(verifyPaystackSignature(body + ' ', sig, SECRET)).toBe(false)
  })

  it('rejects when signature or secret is missing', () => {
    expect(verifyPaystackSignature(body, null, SECRET)).toBe(false)
    expect(verifyPaystackSignature(body, sign(body), undefined)).toBe(false)
  })

  it('does not throw on a length-mismatched signature', () => {
    expect(verifyPaystackSignature(body, 'short', SECRET)).toBe(false)
  })
})

describe('canPromoteToSuccess — charge.success guard', () => {
  it('promotes only from live states', () => {
    expect(canPromoteToSuccess('PENDING')).toBe(true)
    expect(canPromoteToSuccess('RETRY_SCHEDULED')).toBe(true)
  })

  it('never resurrects a terminal state (the refund→success bug)', () => {
    expect(canPromoteToSuccess('REFUNDED')).toBe(false)
    expect(canPromoteToSuccess('SUCCESS')).toBe(false)
    expect(canPromoteToSuccess('CANCELLED')).toBe(false)
    expect(canPromoteToSuccess('FAILED')).toBe(false)
  })
})

describe('canApplyRefund — refund.processed guard', () => {
  it('refunds from live/settled states', () => {
    for (const s of ['PENDING', 'SUCCESS', 'FAILED', 'RETRY_SCHEDULED']) {
      expect(canApplyRefund(s)).toBe(true)
    }
  })

  it('does not re-refund a terminal reversal/cancel', () => {
    expect(canApplyRefund('REFUNDED')).toBe(false)
    expect(canApplyRefund('CANCELLED')).toBe(false)
  })
})

describe('isDisputeEvent', () => {
  it('matches dispute events only', () => {
    expect(isDisputeEvent('charge.dispute.create')).toBe(true)
    expect(isDisputeEvent('charge.dispute.resolve')).toBe(true)
    expect(isDisputeEvent('refund.processed')).toBe(false)
    expect(isDisputeEvent('charge.success')).toBe(false)
  })
})
