import { NextResponse } from 'next/server'
import { verifyOtp, createSessionToken } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { normalizeSAPhone, isValidSAPhone } from '@/lib/utils/validators'
import { checkRateLimit } from '@/lib/rate-limit'

const SESSION_MAX_AGE = 8 * 60 * 60 // 8 hours — admin sessions are short-lived

export async function POST(request: Request) {
  try {
    const { phone, code } = await request.json()

    if (!phone || !code) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const normalized = normalizeSAPhone(phone)
    if (!isValidSAPhone(normalized)) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }

    if (!checkRateLimit(`admin-verify:${normalized}`, 5, 300_000)) {
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
    }

    const valid = await verifyOtp(normalized, code, 'admin_login')
    if (!valid) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 })
    }

    const { data: user } = await supabase.from('User').select('*').eq('phone', normalized).maybeSingle()
    if (!user) {
      return NextResponse.json({ error: 'No admin account found for this number' }, { status: 404 })
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied. Admin privileges required.' }, { status: 403 })
    }

    const token = await createSessionToken(user.id, user.role)
    const response = NextResponse.json({ ok: true })
    response.cookies.set('session', token, {
      httpOnly:  true,
      secure:    process.env.NODE_ENV === 'production',
      sameSite:  'strict',
      maxAge:    SESSION_MAX_AGE,
      path:      '/',
    })

    return response
  } catch (err) {
    console.error('[admin-verify]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
