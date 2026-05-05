import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const PAYSTACK_BASE  = 'https://api.paystack.co'
const PARENT_APP_URL = process.env.NEXT_PUBLIC_PARENT_URL ?? 'https://parent.accidentangels.co.za'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const reference = searchParams.get('reference')

    if (!reference) return NextResponse.redirect(`${PARENT_APP_URL}/payments?error=missing_reference`)

    const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    })
    const data = await res.json()

    if (!res.ok || !data.status || data.data.status !== 'success') {
      return NextResponse.redirect(`${PARENT_APP_URL}/payments?error=verification_failed`)
    }

    const tx = data.data
    const parentId = tx.metadata?.parentId

    if (!parentId) return NextResponse.redirect(`${PARENT_APP_URL}/payments?error=no_parent`)

    const { data: parent } = await supabase.from('Parent').select('id').eq('id', parentId).maybeSingle()
    if (!parent) return NextResponse.redirect(`${PARENT_APP_URL}/payments?error=parent_not_found`)

    const auth = tx.authorization
    await supabase.from('Parent').update({
      paymentMethodType:          'PAYSTACK_CARD',
      paymentMethodStatus:        'ACTIVE',
      paystackCustomerId:         String(tx.customer?.id ?? ''),
      paystackAuthorizationCode:  auth?.authorization_code ?? null,
      paystackAuthorizationEmail: tx.customer?.email ?? null,
      paystackCardLast4:          auth?.last4 ?? null,
      paystackCardBank:           auth?.bank ?? null,
      paystackCardBrand:          auth?.card_type ?? null,
      isPaymentSetup:             true,
      paymentSetupAt:             new Date().toISOString(),
      updatedAt:                  new Date().toISOString(),
    }).eq('id', parentId)

    return NextResponse.redirect(`${PARENT_APP_URL}/payments?setup=success`)
  } catch (err) {
    console.error('[payments/callback]', err)
    return NextResponse.redirect(`${PARENT_APP_URL}/payments?error=internal`)
  }
}
