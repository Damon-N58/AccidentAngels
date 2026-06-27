import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { verifyChildAccess } from '@/lib/auth/ownership'
import { supabase } from '@/lib/supabase'
import { validateAndParseJson } from '@/lib/request-validation'
import { hasOutstandingBalance } from '@/lib/payments/balance-check'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ childId: string }> },
) {
  const session = await getSession(request.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { childId } = await params

  const child = await verifyChildAccess(childId, session)
  if (!child) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [body, bodyErr] = await validateAndParseJson(request)
  if (bodyErr) return bodyErr

  // P1-C: Block driver switch when the parent has an overdue balance with the current driver
  if (
    body.driverId !== undefined &&
    body.driverId !== child.driverId &&
    child.driverId // only relevant when a driver is currently assigned
  ) {
    const { blocked, driverName } = await hasOutstandingBalance(child.parentId, child.driverId)
    if (blocked) {
      return NextResponse.json(
        {
          error: `Please clear your balance with ${driverName} before switching drivers`,
          code: 'BALANCE_OUTSTANDING',
        },
        { status: 402 }
      )
    }
  }

  const updates: Record<string, any> = {}
  if (body.driverId !== undefined) updates.driverId = body.driverId || null
  if (body.name !== undefined) updates.name = body.name
  if (body.schoolName !== undefined) updates.schoolName = body.schoolName
  if (body.grade !== undefined) updates.grade = body.grade
  if (body.pickupAddress !== undefined) updates.pickupAddress = body.pickupAddress
  if (body.pickupLat !== undefined) updates.pickupLat = body.pickupLat
  if (body.pickupLng !== undefined) updates.pickupLng = body.pickupLng
  if (body.dropoffAddress !== undefined) updates.dropoffAddress = body.dropoffAddress
  if (body.dropoffLat !== undefined) updates.dropoffLat = body.dropoffLat
  if (body.dropoffLng !== undefined) updates.dropoffLng = body.dropoffLng

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('Child')
    .update({ ...updates, updatedAt: new Date().toISOString() })
    .eq('id', childId)
    .select()
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ childId: string }> },
) {
  const session = await getSession(request.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { childId } = await params

  const child = await verifyChildAccess(childId, session)
  if (!child) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data } = await supabase
    .from('Child')
    .select('*')
    .eq('id', childId)
    .maybeSingle()

  return NextResponse.json(data ?? { error: 'Not found' }, { status: data ? 200 : 404 })
}
