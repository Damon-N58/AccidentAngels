import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const host = request.headers.get('host') ?? 'localhost:3000'
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const baseUrl = `${protocol}://${host}`

  const referer = request.headers.get('referer') ?? ''
  const isAdmin = referer.includes('/admin')
  const loginPath = isAdmin ? '/admin/login' : '/login'

  const response = NextResponse.redirect(new URL(loginPath, baseUrl))
  response.cookies.set('session', '', {
    httpOnly:  true,
    secure:    process.env.NODE_ENV === 'production',
    sameSite:  'strict',
    maxAge:    0,
    path:     '/',
  })
  return response
}
