import { NextResponse } from 'next/server'
import { createOtp, getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { sendSms, smsTemplates } from '@/lib/sms/africas-talking'
import { normalizeSAPhone, isValidSAPhone } from '@/lib/utils/validators'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { purpose, role } = body
    let { phone } = body

    if (!phone) {
      const session = await getSession(request.headers.get('cookie'))
      if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      const { data: user } = await supabase.from('User').select('phone').eq('id', session.userId).maybeSingle()
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
      phone = user.phone
    }

    const normalized = normalizeSAPhone(phone)
    if (!isValidSAPhone(normalized)) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }

    if (!checkRateLimit(`otp-send:${normalized}`, 3, 60_000)) {
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
    }

    if (!purpose) {
      return NextResponse.json({ error: 'Purpose is required' }, { status: 400 })
    }

    const ipAddress = request.headers.get('x-forwarded-for') ?? undefined
    const userAgent = request.headers.get('user-agent') ?? undefined
    const code = await createOtp(normalized, purpose, ipAddress, userAgent)

    try {
      await sendSms(normalized, smsTemplates.otp(code))
    } catch (smsErr) {
      if (process.env.NODE_ENV !== 'development') throw smsErr
      console.warn('[send-otp] SMS skipped in dev:', smsErr)
    }

    const isDev = process.env.NODE_ENV === 'development'
    return NextResponse.json({ ok: true, ...(isDev && { devCode: code }) })
  } catch (err) {
    console.error('[send-otp]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
