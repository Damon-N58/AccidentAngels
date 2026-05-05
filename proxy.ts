import { NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  const hostname = request.headers.get('host') ?? ''
  const url = request.nextUrl.clone()

  const host = hostname.split(':')[0]

  if (host.startsWith('driver.')) {
    url.pathname = `/driver-app${url.pathname}`
    return NextResponse.rewrite(url)
  }

  if (host.startsWith('parent.')) {
    url.pathname = `/parent-app${url.pathname}`
    return NextResponse.rewrite(url)
  }

  if (host.startsWith('admin.')) {
    url.pathname = `/admin${url.pathname}`
    return NextResponse.rewrite(url)
  }

  // Local dev fallback — NEXT_PUBLIC_LOCAL_APP defaults to driver
  // Skip rewrite if already on the correct app prefix (direct access)
  if (host === 'localhost') {
    const appType = process.env.NEXT_PUBLIC_LOCAL_APP ?? 'driver'
    const prefix = appType === 'parent' ? '/parent-app' : appType === 'admin' ? '/admin' : '/driver-app'
    if (!url.pathname.startsWith(prefix)) {
      url.pathname = `${prefix}${url.pathname}`
      return NextResponse.rewrite(url)
    }
    return NextResponse.next()
  }

  return NextResponse.redirect(
    new URL(process.env.NEXT_PUBLIC_DRIVER_URL ?? 'https://driver.accidentangels.co.za')
  )
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logos|icons|manifest.json|api|driver/|parent/|driver-app|parent-app|admin).*)',
  ],
}
