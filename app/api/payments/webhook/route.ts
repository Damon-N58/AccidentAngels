import { NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { supabase } from '@/lib/supabase'
import { scheduleRetry } from '@/lib/payments/retry'

function verifySignature(payload: string, signature: string | null): boolean {
  if (!signature || !process.env.PAYSTACK_WEBHOOK_SECRET) return false
  const hash = createHmac('sha512', process.env.PAYSTACK_WEBHOOK_SECRET).update(payload).digest('hex')
  return hash === signature
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
        .select('id')
        .eq('providerReference', tx.reference)
        .maybeSingle()

      if (transaction) {
        await supabase.from('Transaction').update({
          status:           'SUCCESS',
          providerChargeId: String(tx.id),
          lastAttemptAt:    now,
          updatedAt:        now,
        }).eq('id', transaction.id)
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
        .select('id, attemptCount')
        .eq('providerReference', tx.reference)
        .maybeSingle()

      if (transaction) {
        await supabase.from('Transaction').update({
          attemptCount:  transaction.attemptCount + 1,
          failureReason: tx.gateway_response ?? 'Unknown',
          lastAttemptAt: now,
          updatedAt:     now,
        }).eq('id', transaction.id)
        await scheduleRetry(transaction.id)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[payments/webhook]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
