import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { encrypt } from '@/lib/auth/encryption'
import { supabase } from '@/lib/supabase'
import { validateAndParseJson } from '@/lib/request-validation'

export async function POST(request: Request) {
  try {
    const session = await getSession(request.headers.get('cookie'))
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [body, bodyErr] = await validateAndParseJson(request)
    if (bodyErr) return bodyErr
    const { details, vehicle, associationId, banking } = body as Record<string, any>

    if (!details?.name) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 })
    }

    const now = new Date().toISOString()

    await supabase.from('User').update({ name: details.name.trim(), updatedAt: now }).eq('id', session.userId)

    const { data: existing } = await supabase.from('Driver').select('id').eq('userId', session.userId).maybeSingle()
    if (existing) {
      return NextResponse.json({ error: 'Driver profile already exists' }, { status: 409 })
    }

    await supabase.from('Driver').insert({
      id:                     crypto.randomUUID(),
      userId:                 session.userId,
      associationId:          associationId || null,
      getsRegistrationNumber: details.getsNumber?.trim() || null,
      vehicleMake:            vehicle.make?.trim() || null,
      vehicleModel:           vehicle.model?.trim() || null,
      vehicleYear:            vehicle.year ? parseInt(vehicle.year) : null,
      vehicleRegistration:    vehicle.registration?.trim() || null,
      vehicleColour:          vehicle.colour?.trim() || null,
      vehicleCapacity:        vehicle.capacity ? parseInt(vehicle.capacity) : null,
      bankName:               banking.bankName?.trim() || null,
      bankAccountNumber:      banking.accountNumber?.trim() ? encrypt(banking.accountNumber.trim()) : null,
      bankBranchCode:         banking.branchCode?.trim() ? encrypt(banking.branchCode.trim()) : null,
      bankAccountName:        banking.accountName?.trim() ? encrypt(banking.accountName.trim()) : null,
      status:                 'PENDING_COMPLIANCE',
      isVerifiedByAdmin:      false,
      createdAt:              now,
      updatedAt:              now,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[driver/onboard]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
