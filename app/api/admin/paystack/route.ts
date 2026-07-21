import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { validateRequest, safeParseJson } from '@/lib/request-validation'
import { listBanks, createSubAccount, updateSubAccount, listSubAccounts } from '@/lib/payments/paystack-admin'

async function requireAdmin(request: Request) {
  const session = await getSession(request.headers.get('cookie'))
  if (!session || session.role !== 'ADMIN') return null
  return session
}

/** Which table a subaccount code gets written back to. */
const TARGET_TABLE: Record<string, string> = {
  party: 'SplitParty',
  driver: 'Driver',
  association: 'Association',
}

/** GET ?resource=banks | subaccounts — read-only Paystack lookups. */
export async function GET(request: Request) {
  try {
    if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const resource = new URL(request.url).searchParams.get('resource')

    if (resource === 'banks') return NextResponse.json(await listBanks('ZAR'))
    if (resource === 'subaccounts') return NextResponse.json(await listSubAccounts())
    return NextResponse.json({ error: 'unknown resource' }, { status: 400 })
  } catch (err) {
    console.error('[admin/paystack GET]', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}

/**
 * POST — create/update a payout account and attach its code to the owning row.
 * body: { action, targetType: 'party'|'driver'|'association', targetId,
 *         displayName, bankCode, accountNumber }
 */
export async function POST(request: Request) {
  try {
    if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const validationError = validateRequest(request)
    if (validationError) return validationError
    const body = (await safeParseJson(request)) as Record<string, any> | null
    if (!body?.action) return NextResponse.json({ error: 'action is required' }, { status: 400 })

    const table = TARGET_TABLE[body.targetType]
    if (!table) return NextResponse.json({ error: 'invalid targetType' }, { status: 400 })
    if (!body.targetId) return NextResponse.json({ error: 'targetId is required' }, { status: 400 })

    if (body.action === 'createSubAccount') {
      const { displayName, bankCode, accountNumber } = body
      if (!displayName || !bankCode || !accountNumber) {
        return NextResponse.json({ error: 'displayName, bankCode and accountNumber are required' }, { status: 400 })
      }
      const sub = await createSubAccount({
        displayName,
        bankCode,
        accountNumber: String(accountNumber).trim(),
        ownerRef: `${body.targetType}:${body.targetId}`,
      })
      const { error } = await supabase
        .from(table)
        .update({ paystackSubAccountCode: sub.subaccount_code, ...(table === 'Driver' ? { paystackSubAccountId: String(sub.id) } : {}) })
        .eq('id', body.targetId)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ subaccount_code: sub.subaccount_code, id: sub.id })
    }

    if (body.action === 'updateSubAccount') {
      if (!body.code) return NextResponse.json({ error: 'code is required' }, { status: 400 })
      const sub = await updateSubAccount(body.code, {
        displayName: body.displayName,
        bankCode: body.bankCode,
        accountNumber: body.accountNumber ? String(body.accountNumber).trim() : undefined,
      })
      return NextResponse.json({ subaccount_code: sub.subaccount_code, id: sub.id })
    }

    return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 })
  } catch (err) {
    console.error('[admin/paystack POST]', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
