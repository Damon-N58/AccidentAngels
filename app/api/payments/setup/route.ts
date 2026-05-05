import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { getPaymentProvider } from '@/lib/payments'
import { validateRequest, safeParseJson } from '@/lib/request-validation'
import type { PaymentMethodType } from '@/lib/payments/types'

export async function POST(request: Request) {
  try {
    const session = await getSession(request.headers.get('cookie'))
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const validationError = validateRequest(request)
    if (validationError) return validationError
    const body = await safeParseJson(request)
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    const { method } = body as { method: PaymentMethodType }

    const { data: parent } = await supabase
      .from('Parent')
      .select('*, user:User(*)')
      .eq('userId', session.userId)
      .maybeSingle()
    if (!parent) return NextResponse.json({ error: 'Parent profile not found' }, { status: 404 })

    const provider = getPaymentProvider(method)
    const result = await provider.setupMandate({
      parentId: parent.id,
      phone:    parent.user.phone,
      email:    parent.user.email ?? undefined,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error ?? 'Setup failed' }, { status: 500 })
    }

    await supabase.from('Parent').update({
      paymentMethodType:   method,
      paymentMethodStatus: 'PENDING_SETUP',
      updatedAt:           new Date().toISOString(),
    }).eq('id', parent.id)

    return NextResponse.json({ authorizationUrl: result.authorizationUrl, reference: result.reference })
  } catch (err) {
    console.error('[payments/setup]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
