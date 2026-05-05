import { NextRequest, NextResponse } from 'next/server'
import { createSessionToken } from '@/lib/auth'

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development' || process.env.VERCEL_ENV) {
    return new Response('Not available in production', { status: 403 })
  }

  const allowedRoles = ['DRIVER', 'PARENT', 'ADMIN']
  const roleParam = (req.nextUrl.searchParams.get('role') ?? 'DRIVER').toUpperCase()
  const role = allowedRoles.includes(roleParam) ? roleParam : 'DRIVER'
  const token = await createSessionToken('dev-user-id', role)

  const res = NextResponse.redirect(new URL('/dashboard', req.nextUrl.origin))
  res.cookies.set('session', token, {
    httpOnly: true,
    secure:   false,
    sameSite: 'strict',
    path:     '/',
    maxAge:   60 * 60 * 24,
  })
  return res
}
