import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { supabase } from './supabase'

const rawSecret = process.env.NEXTAUTH_SECRET
if (!rawSecret) {
  throw new Error('NEXTAUTH_SECRET environment variable is required')
}
const SECRET = new TextEncoder().encode(rawSecret)
const OTP_EXPIRY_MINUTES = 5
const SESSION_EXPIRY_DAYS = 30

export async function createOtp(phone: string, purpose: string, ipAddress?: string, userAgent?: string) {
  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const hashed = await bcrypt.hash(code, 10)
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString()

  // Invalidate existing OTPs for this phone+purpose
  await supabase
    .from('OtpToken')
    .update({ usedAt: new Date().toISOString() })
    .eq('phone', phone)
    .eq('purpose', purpose)
    .is('usedAt', null)

  await supabase.from('OtpToken').insert({
    id:        crypto.randomUUID(),
    phone,
    code:      hashed,
    purpose,
    expiresAt,
    ipAddress: ipAddress ?? null,
    userAgent: userAgent ?? null,
    createdAt: new Date().toISOString(),
  })

  return code
}

export async function verifyOtp(phone: string, code: string, purpose: string): Promise<boolean> {
  const { data: token } = await supabase
    .from('OtpToken')
    .select('*')
    .eq('phone', phone)
    .eq('purpose', purpose)
    .is('usedAt', null)
    .gt('expiresAt', new Date().toISOString())
    .order('createdAt', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!token) return false

  const valid = await bcrypt.compare(code, token.code)
  if (!valid) return false

  await supabase
    .from('OtpToken')
    .update({ usedAt: new Date().toISOString() })
    .eq('id', token.id)

  return true
}

export async function createSessionToken(userId: string, role: string): Promise<string> {
  return new SignJWT({ userId, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_EXPIRY_DAYS}d`)
    .sign(SECRET)
}

export async function verifySessionToken(token: string): Promise<{ userId: string; role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as { userId: string; role: string }
  } catch {
    return null
  }
}

export async function createParentSigningToken(contractId: string, parentPhone: string): Promise<string> {
  return new SignJWT({ contractId, parentPhone, type: 'contract_sign' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('72h')
    .sign(SECRET)
}

export async function verifyParentSigningToken(
  token: string
): Promise<{ contractId: string; parentPhone: string } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    if (payload.type !== 'contract_sign') return null
    return payload as { contractId: string; parentPhone: string }
  } catch {
    return null
  }
}

export async function getSession(cookieHeader: string | null): Promise<{ userId: string; role: string } | null> {
  if (!cookieHeader) return null
  const match = cookieHeader.match(/session=([^;]+)/)
  if (!match) return null
  return verifySessionToken(match[1])
}

export async function requireAdmin(): Promise<{ userId: string; role: string }> {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const session = await getSession(cookieStore.toString())
  if (!session || session.role !== 'ADMIN') {
    const { redirect } = await import('next/navigation')
    redirect('/admin/login')
    throw new Error('unreachable')
  }
  return session
}
