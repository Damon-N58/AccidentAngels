import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { validateRequest, safeParseJson } from '@/lib/request-validation'
import { listBanks, createSubAccount } from '@/lib/payments/paystack-admin'

async function driverForSession(request: Request) {
  const session = await getSession(request.headers.get('cookie'))
  if (!session || session.role !== 'DRIVER') return null
  const { data: driver } = await supabase
    .from('Driver')
    .select('id, paystackSubAccountCode, user:User(name)')
    .eq('userId', session.userId)
    .maybeSingle()
  return driver
}

/** GET — banks list + this driver's current payout account code. */
export async function GET(request: Request) {
  const driver = await driverForSession(request)
  if (!driver) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  let banks: { name: string; code: string }[] = []
  try {
    banks = (await listBanks('ZAR')).map(b => ({ name: b.name, code: b.code }))
  } catch (err) {
    console.error('[driver/payout GET] banks fetch failed:', err)
  }
  return NextResponse.json({ accountCode: driver.paystackSubAccountCode ?? null, banks })
}

/** POST — driver sets up their own payout account (creates a Paystack subaccount). */
export async function POST(request: Request) {
  const driver = await driverForSession(request)
  if (!driver) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (driver.paystackSubAccountCode) {
    // Already set — don't silently create a duplicate at Paystack.
    return NextResponse.json({ error: 'A payout account already exists', accountCode: driver.paystackSubAccountCode }, { status: 409 })
  }

  const validationError = validateRequest(request)
  if (validationError) return validationError
  const body = (await safeParseJson(request)) as Record<string, any> | null
  if (!body?.bankCode || !body?.accountNumber) {
    return NextResponse.json({ error: 'Bank and account number are required' }, { status: 400 })
  }

  const driverName = (driver as { user?: { name?: string } }).user?.name || `Driver ${driver.id.slice(0, 8)}`
  try {
    const sub = await createSubAccount({
      displayName: driverName,
      bankCode: String(body.bankCode),
      accountNumber: String(body.accountNumber).trim(),
      ownerRef: `driver:${driver.id}`,
    })
    const { error } = await supabase
      .from('Driver')
      .update({ paystackSubAccountCode: sub.subaccount_code, paystackSubAccountId: String(sub.id) })
      .eq('id', driver.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ accountCode: sub.subaccount_code })
  } catch (err) {
    // Paystack rejects invalid bank/account details — surface the reason.
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
