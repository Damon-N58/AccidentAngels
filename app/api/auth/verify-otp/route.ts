import { NextResponse } from 'next/server'
import { verifyOtp, createSessionToken } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { normalizeSAPhone, isValidSAPhone } from '@/lib/utils/validators'
import { checkRateLimit } from '@/lib/rate-limit'

const SESSION_MAX_AGE = 30 * 24 * 60 * 60

export async function POST(request: Request) {
  try {
    const { phone, code, purpose, role } = await request.json()

    if (!phone || !code || !purpose) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const normalized = normalizeSAPhone(phone)
    if (!isValidSAPhone(normalized)) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }

    if (!checkRateLimit(`otp-verify:${normalized}`, 5, 300_000)) {
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
    }

    const valid = await verifyOtp(normalized, code, purpose)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 })
    }

    let { data: user } = await supabase.from('User').select('*').eq('phone', normalized).maybeSingle()
    let isNewUser = false

    if (!user) {
      if (purpose !== 'login') {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      const userRole = role === 'PARENT' ? 'PARENT' : 'DRIVER'
      const now = new Date().toISOString()
      const { data: created } = await supabase.from('User').insert({
        id:        crypto.randomUUID(),
        phone:     normalized,
        name:      '',
        role:      userRole,
        isActive:  true,
        createdAt: now,
        updatedAt: now,
      }).select().single()
      user = created
      isNewUser = true
    }

    if (user.role === 'PARENT') {
      const { data: existing } = await supabase.from('Parent').select('id').eq('userId', user.id).maybeSingle()
      if (!existing) {
        const now = new Date().toISOString()
        await supabase.from('Parent').insert({
          id:                  crypto.randomUUID(),
          userId:              user.id,
          paymentMethodStatus: 'PENDING_SETUP',
          isPaymentSetup:      false,
          createdAt:           now,
          updatedAt:           now,
        })
      }
    }

    const token = await createSessionToken(user.id, user.role)
    const response = NextResponse.json({ isNewUser, role: user.role })
    response.cookies.set('session', token, {
      httpOnly:  true,
      secure:    process.env.NODE_ENV === 'production',
      sameSite:  'strict',
      maxAge:    SESSION_MAX_AGE,
      path:      '/',
    })

    return response
  } catch (err) {
    console.error('[verify-otp]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set('session', '', {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   0,
    path:     '/',
  })
  return response
}
