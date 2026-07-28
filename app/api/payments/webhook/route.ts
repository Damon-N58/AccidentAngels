import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { supabase } from '@/lib/supabase'

function verifySignature(payload: string, signature: string | null): boolean {
  if (!signature || !process.env.PAYSTACK_WEBHOOK_SECRET) return false
  const hash = createHmac('sha512', process.env.PAYSTACK_WEBHOOK_SECRET).update(payload).digest('hex')
  // Constant-time compare to avoid a timing side-channel on the signature.
  const a = Buffer.from(hash)
  const b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('x-paystack-signature')

    if (!verifySignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const event = JSON.parse(rawBody)
    const now = new Date().toISOString()

    if (event.event === 'charge.success') {
      const tx = event.data
      const { data: transaction } = await supabase
        .from('Transaction')
        .select('id, status')
        .eq('providerReference', tx.reference)
        .maybeSingle()

      if (transaction) {
        // Idempotent + safe: only promote a still-live charge. A SUCCESS,
        // CANCELLED or REFUNDED row must never be reopened by a replayed or
        // out-of-order charge.success — promoting a REFUNDED row back to SUCCESS
        // would resurrect a charge whose money was already returned. The
        // matching .in() on the write makes the guard atomic against races.
        if (transaction.status === 'PENDING' || transaction.status === 'RETRY_SCHEDULED') {
          await supabase.from('Transaction').update({
            status:           'SUCCESS',
            providerChargeId: String(tx.id),
            lastAttemptAt:    now,
            nextRetryAt:      null,
            updatedAt:        now,
          })
            .eq('id', transaction.id)
            .in('status', ['PENDING', 'RETRY_SCHEDULED'])
        }
      } else {
        const parentId = tx.metadata?.parentId
        if (parentId && tx.metadata?.purpose === 'card_setup') {
          const auth = tx.authorization
          await supabase.from('Parent').update({
            paymentMethodStatus:        'ACTIVE',
            paystackCustomerId:         String(tx.customer?.id ?? ''),
            paystackAuthorizationCode:  auth?.authorization_code ?? null,
            paystackAuthorizationEmail: tx.customer?.email ?? null,
            paystackCardLast4:          auth?.last4 ?? null,
            paystackCardBank:           auth?.bank ?? null,
            paystackCardBrand:          auth?.card_type ?? null,
            isPaymentSetup:             true,
            paymentSetupAt:             now,
            updatedAt:                  now,
          }).eq('id', parentId)
        }
      }
    }

    if (event.event === 'charge.failed') {
      const tx = event.data
      const { data: transaction } = await supabase
        .from('Transaction')
        .select('id, status, attemptCount')
        .eq('providerReference', tx.reference)
        .maybeSingle()

      // Only act on a charge that is still live. A SUCCESS/CANCELLED/FAILED
      // transaction must never be reopened by a replayed or out-of-order
      // charge.failed event — that would re-charge an already-paid month.
      if (transaction && (transaction.status === 'PENDING' || transaction.status === 'RETRY_SCHEDULED')) {
        await supabase.from('Transaction').update({
          failureReason: tx.gateway_response ?? 'Unknown',
          lastAttemptAt: now,
          updatedAt:     now,
        }).eq('id', transaction.id)
        // NOTE: attemptCount / scheduleRetry are owned by the billing cron
        // (single source of truth) to avoid double-counting a decline that the
        // synchronous charge already recorded.
      }
    }

    // Genuine refund: money was actually returned to the parent. This is the
    // one unambiguous reversal signal, so it is the ONLY event that flips a
    // charge to REFUNDED. The split ledger is kept (it is the audit trail;
    // nothing sums REFUNDED rows for payouts) — deleting it, as the old code
    // did, destroyed the record irrecoverably. Guarded so a replay can't
    // re-refund and a terminal reversal can't be overwritten.
    if (event.event === 'refund.processed') {
      const ref =
        event.data?.transaction_reference ??
        event.data?.reference ??
        event.data?.transaction?.reference
      if (ref) {
        const { data: transaction } = await supabase
          .from('Transaction')
          .select('id, status')
          .eq('providerReference', ref)
          .maybeSingle()
        if (transaction && transaction.status !== 'REFUNDED' && transaction.status !== 'CANCELLED') {
          await supabase
            .from('Transaction')
            .update({ status: 'REFUNDED', failureReason: 'reversed: refund.processed', updatedAt: now })
            .eq('id', transaction.id)
            .in('status', ['PENDING', 'SUCCESS', 'FAILED', 'RETRY_SCHEDULED'])
          console.warn(`[webhook] transaction ${transaction.id} marked REFUNDED via refund.processed`)
        }
      }
    }

    // Disputes / chargebacks: opening OR resolving a dispute does not by itself
    // move money. A dispute you win must leave the charge SUCCESS; a dispute you
    // lose results in an actual refund, which arrives as its own
    // refund.processed event (handled above). The previous code marked the
    // charge REFUNDED on dispute.create AND on both resolution outcomes, and
    // hard-deleted the ledger — wrong for a won dispute. We now only surface the
    // dispute for manual/admin review and leave the money state untouched.
    if (event.event === 'charge.dispute.create' || event.event === 'charge.dispute.resolve') {
      const ref =
        event.data?.transaction?.reference ??
        event.data?.transaction_reference ??
        event.data?.reference
      console.warn(
        `[webhook] ${event.event} (ref=${ref ?? 'unknown'}, status=${event.data?.status ?? '?'}, ` +
        `resolution=${event.data?.resolution ?? '?'}) — flagged for manual review; charge status unchanged`,
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[payments/webhook]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
