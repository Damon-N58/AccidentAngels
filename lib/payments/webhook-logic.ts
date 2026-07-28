import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Pure decision helpers for the Paystack webhook. Kept free of DB/Next imports
 * so the security-critical logic (signature check + state-machine guards) is
 * unit-testable in isolation.
 */

/** Constant-time HMAC-SHA512 verification of a Paystack webhook signature. */
export function verifyPaystackSignature(
  rawBody: string,
  signature: string | null,
  secret: string | undefined,
): boolean {
  if (!signature || !secret) return false
  const hash = createHmac('sha512', secret).update(rawBody).digest('hex')
  const a = Buffer.from(hash)
  const b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * A charge.success may promote a transaction to SUCCESS only from a live
 * (non-terminal) state. Crucially this excludes REFUNDED and CANCELLED, so a
 * replayed/out-of-order success can never resurrect a refunded charge.
 */
export function canPromoteToSuccess(status: string): boolean {
  return status === 'PENDING' || status === 'RETRY_SCHEDULED'
}

/**
 * refund.processed may flip a transaction to REFUNDED unless it is already
 * terminally reversed or cancelled (prevents double-refund / replay).
 */
export function canApplyRefund(status: string): boolean {
  return status !== 'REFUNDED' && status !== 'CANCELLED'
}

/**
 * Disputes never move money on their own — opening or resolving a dispute is
 * logged for manual review; the money state is driven solely by an actual
 * refund.processed event.
 */
export function isDisputeEvent(eventName: string): boolean {
  return eventName === 'charge.dispute.create' || eventName === 'charge.dispute.resolve'
}
