import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const session = await getSession(_request.headers.get('cookie'))
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { tripId } = await params

  const { data: trip } = await supabase
    .from('Trip')
    .select('*, stops:TripStop(*, child:Child(name, schoolName))')
    .eq('id', tripId)
    .maybeSingle()

  if (!trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  }

  // Authorization: driver must own the trip
  if (session.role === 'DRIVER') {
    const { data: driver } = await supabase
      .from('Driver').select('id').eq('userId', session.userId).maybeSingle()
    if (!driver || trip.driverId !== driver.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Authorization: parent must have a child on this trip
  if (session.role === 'PARENT') {
    const { data: parent } = await supabase
      .from('Parent').select('id').eq('userId', session.userId).maybeSingle()
    if (!parent) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const childIdsOnTrip = [...new Set((trip.stops ?? []).map((s: any) => s.childId))]
    const { data: children } = await supabase
      .from('Child').select('id').eq('parentId', parent.id).in('id', childIdsOnTrip)
    if (!children?.length) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  if (session.role === 'ADMIN') {
    // admins can see any trip
  }

  trip.stops = (trip.stops ?? []).sort((a: any, b: any) => a.stopOrder - b.stopOrder)

  return NextResponse.json(trip)
}
