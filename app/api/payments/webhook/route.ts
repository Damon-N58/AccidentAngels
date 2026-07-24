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
        // Idempotent: only promote to SUCCESS from a non-terminal state.
        if (transaction.status !== 'SUCCESS' && transaction.status !== 'CANCELLED') {
          await supabase.from('Transaction').update({
            status:           'SUCCESS',
            providerChargeId: String(tx.id),
            lastAttemptAt:    now,
            nextRetryAt:      null,
            updatedAt:        now,
          }).eq('id', transaction.id)
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

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[payments/webhook]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
