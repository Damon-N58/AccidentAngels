import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { generateTripsForDriver } from '@/lib/trips/generate'
import { validateAndParseJson } from '@/lib/request-validation'

export async function POST(request: Request) {
  const session = await getSession(request.headers.get('cookie'))
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [body, bodyErr] = await validateAndParseJson(request)
  if (bodyErr) return bodyErr
  const { date } = body as Record<string, any>
  if (!date) {
    return NextResponse.json({ error: 'date is required (YYYY-MM-DD)' }, { status: 400 })
  }

  if (session.role === 'DRIVER') {
    const { data: driver } = await supabase
      .from('Driver').select('id').eq('userId', session.userId).maybeSingle()
    if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
    const result = await generateTripsForDriver(driver.id, date)
    return NextResponse.json(result)
  }

  if (session.role === 'PARENT') {
    const { data: parent } = await supabase
      .from('Parent').select('id').eq('userId', session.userId).maybeSingle()
    if (!parent) return NextResponse.json({ error: 'Parent not found' }, { status: 404 })

    const { data: children } = await supabase
      .from('Child').select('driverId').eq('parentId', parent.id).eq('isActive', true)
    const driverIds = [...new Set((children ?? []).map(c => c.driverId).filter(Boolean))]

    const results = []
    for (const did of driverIds) {
      results.push(await generateTripsForDriver(did!, date))
    }
    return NextResponse.json({ results })
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
