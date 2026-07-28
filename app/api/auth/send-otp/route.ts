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
    // Skip strict SA mobile validation for admin login (test/seed numbers like +27000000000)
    if (purpose !== 'admin_login' && !isValidSAPhone(normalized)) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }

    if (!(await checkRateLimit(`otp-send:${normalized}`, 3, 60_000, { failClosed: true }))) {
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
    }

    if (!purpose) {
      return NextResponse.json({ error: 'Purpose is required' }, { status: 400 })
    }

    const ipAddress = request.headers.get('x-forwarded-for') ?? undefined
    const userAgent = request.headers.get('user-agent') ?? undefined
    const code = await createOtp(normalized, purpose, ipAddress, userAgent)

    let smsFailed = false
    try {
      await sendSms(normalized, smsTemplates.otp(code))
    } catch (smsErr) {
      console.warn('[send-otp] SMS failed:', smsErr)
      smsFailed = true
    }

    // SECURITY: the OTP code must NEVER be returned over the API in production.
    // Returning it on smsFailed / sandbox / DEMO_MODE was an account-takeover
    // vector (an attacker forces an SMS failure and reads the admin code from
    // the response). Only expose it in a local dev build; in production a failed
    // send returns smsFailed:true with NO code so the client prompts a resend.
    const showCode = process.env.NODE_ENV !== 'production'
    return NextResponse.json({ ok: true, smsFailed, ...(showCode && { devCode: code }) })
  } catch (err) {
    console.error('[send-otp]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
