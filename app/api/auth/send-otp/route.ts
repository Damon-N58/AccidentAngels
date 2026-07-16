import { NextResponse } from 'next/server'
import { createOtp, getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { sendWhatsapp, whatsappTemplates } from '@/lib/whatsapp/nineteen58'
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

    let sendFailed = false
    try {
      await sendWhatsapp(normalized, whatsappTemplates.otp(code))
    } catch (sendErr) {
      console.warn('[send-otp] WhatsApp send failed:', sendErr)
      sendFailed = true
    }

    // Return devCode when WhatsApp is not delivering to real phones:
    // - dev mode, explicit DEMO_MODE flag, or WhatsApp send failure
    const showCode = process.env.NODE_ENV === 'development'
      || process.env.DEMO_MODE === 'true'
      || sendFailed
    return NextResponse.json({ ok: true, sendFailed, ...(showCode && { devCode: code }) })
  } catch (err) {
    console.error('[send-otp]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
