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

    if (!checkRateLimit(`otp-send:${normalized}`, 3, 60_000)) {
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
    }

    if (!purpose) {
      return NextResponse.json({ error: 'Purpose is required' }, { status: 400 })
    }

    const ipAddress = request.headers.get('x-forwarded-for') ?? undefined
    const userAgent = request.headers.get('user-agent') ?? undefined
    const code = await createOtp(normalized, purpose, ipAddress, userAgent)

    // USE_SMS_AUTH is the single switch for whether login relies on real SMS delivery.
    // The code is NEVER returned in the API response, in either mode.
    // false -> skip SMS entirely, log the code to the server console (local/demo use).
    // true  -> send for real — if the send fails, the request fails too, rather than
    //          falling back to exposing the code.
    const useSmsAuth = process.env.USE_SMS_AUTH === 'true'

    if (!useSmsAuth) {
      console.log(`[OTP] ${normalized} (${purpose}): ${code}`)
      return NextResponse.json({ ok: true })
    }

    try {
      const result = await sendSms(normalized, smsTemplates.otp(code))
      if (!result.success) {
        console.error('[send-otp] SMS delivery failed:', result.error)
        return NextResponse.json({ error: 'Failed to send code. Please try again.' }, { status: 502 })
      }
    } catch (smsErr) {
      console.error('[send-otp] SMS failed:', smsErr)
      return NextResponse.json({ error: 'Failed to send code. Please try again.' }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[send-otp]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
