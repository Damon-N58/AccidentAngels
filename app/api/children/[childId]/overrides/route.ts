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

  const { data: overrides } = await supabase
    .from('ScheduleOverride')
    .select('*')
    .eq('childId', childId)
    .order('date', { ascending: true })

  return NextResponse.json(overrides ?? [])
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

  if (!body.date || !body.action) {
    return NextResponse.json({ error: 'date and action are required' }, { status: 400 })
  }

  if (!['SKIP', 'ADD'].includes(body.action)) {
    return NextResponse.json({ error: 'action must be SKIP or ADD' }, { status: 400 })
  }

  // Prevent overrides for past dates
  const today = new Date().toISOString().split('T')[0]
  if (body.date < today) {
    return NextResponse.json({ error: 'Cannot override past dates' }, { status: 400 })
  }

  const { id: overrideId } = rawBody as Record<string, any>

  const { data, error } = await supabase
    .from('ScheduleOverride')
    .upsert({
      id: overrideId ?? crypto.randomUUID(),
      childId,
      date: body.date,
      action: body.action,
      reason: body.reason ?? null,
      overrideTime: body.overrideTime ?? null,
    }, { onConflict: 'childId,date', ignoreDuplicates: false })
    .select()
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
