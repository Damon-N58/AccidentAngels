import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { verifyChildAccess } from '@/lib/auth/ownership'
import { supabase } from '@/lib/supabase'
import { validateAndParseJson } from '@/lib/request-validation'

async function checkAccess(
  _request: Request,
  params: Promise<{ childId: string }>,
): Promise<{ session: { userId: string; role: string }; childId: string } | NextResponse> {
  const session = await getSession(_request.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) as any

  const { childId } = await params

  const child = await verifyChildAccess(childId, session)
  if (!child) return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) as any

  return { session, childId }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ childId: string }> },
) {
  const result = await checkAccess(_request, params)
  if (result instanceof NextResponse) return result

  const { childId } = result

  const { data: schedules } = await supabase
    .from('ChildSchedule')
    .select('*')
    .eq('childId', childId)
    .order('createdAt', { ascending: false })

  return NextResponse.json(schedules ?? [])
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ childId: string }> },
) {
  const result = await checkAccess(request, params)
  if (result instanceof NextResponse) return result

  const { childId } = result
  const [rawBody, bodyErr] = await validateAndParseJson(request)
  if (bodyErr) return bodyErr
  const body = rawBody as Record<string, any>

  // Validate time windows
  if (body.morningPickupEarliest && body.morningPickupLatest && body.morningPickupEarliest >= body.morningPickupLatest) {
    return NextResponse.json({ error: 'Morning pickup earliest must be before latest' }, { status: 400 })
  }
  if (body.morningDropoffEarliest && body.morningDropoffLatest && body.morningDropoffEarliest >= body.morningDropoffLatest) {
    return NextResponse.json({ error: 'Morning dropoff earliest must be before latest' }, { status: 400 })
  }
  if (body.afternoonPickupEarliest && body.afternoonPickupLatest && body.afternoonPickupEarliest >= body.afternoonPickupLatest) {
    return NextResponse.json({ error: 'Afternoon pickup earliest must be before latest' }, { status: 400 })
  }
  if (body.afternoonDropoffEarliest && body.afternoonDropoffLatest && body.afternoonDropoffEarliest >= body.afternoonDropoffLatest) {
    return NextResponse.json({ error: 'Afternoon dropoff earliest must be before latest' }, { status: 400 })
  }

  // Deactivate old schedules
  await supabase
    .from('ChildSchedule')
    .update({ isActive: false })
    .eq('childId', childId)
    .eq('isActive', true)

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('ChildSchedule')
    .insert({
      id: crypto.randomUUID(),
      childId,
      daysOfWeek: body.daysOfWeek,
      startDate: body.startDate ?? now,
      endDate: body.endDate ?? null,
      morningPickupEarliest: body.morningPickupEarliest ?? null,
      morningPickupLatest: body.morningPickupLatest ?? null,
      morningDropoffEarliest: body.morningDropoffEarliest ?? null,
      morningDropoffLatest: body.morningDropoffLatest ?? null,
      afternoonPickupEarliest: body.afternoonPickupEarliest ?? null,
      afternoonPickupLatest: body.afternoonPickupLatest ?? null,
      afternoonDropoffEarliest: body.afternoonDropoffEarliest ?? null,
      afternoonDropoffLatest: body.afternoonDropoffLatest ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .select()
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ childId: string }> },
) {
  const result = await checkAccess(_request, params)
  if (result instanceof NextResponse) return result

  const { childId } = result

  await supabase
    .from('ChildSchedule')
    .update({ isActive: false })
    .eq('childId', childId)
    .eq('isActive', true)

  return NextResponse.json({ success: true })
}
