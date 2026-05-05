import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const session = await getSession(_request.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (session.role !== 'DRIVER') {
    return NextResponse.json({ error: 'Only drivers can start trips' }, { status: 403 })
  }

  const { tripId } = await params

  const { data: driver } = await supabase
    .from('Driver').select('id').eq('userId', session.userId).maybeSingle()
  if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })

  const { data: trip } = await supabase
    .from('Trip').select('*').eq('id', tripId).maybeSingle()
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  if (trip.driverId !== driver.id) {
    return NextResponse.json({ error: 'You do not own this trip' }, { status: 403 })
  }
  if (trip.status !== 'SCHEDULED') {
    return NextResponse.json({ error: 'Trip already started or completed' }, { status: 400 })
  }

  // Verify trip is for today
  const today = new Date().toISOString().split('T')[0]
  if (trip.date !== today) {
    return NextResponse.json({ error: 'Can only start trips scheduled for today' }, { status: 400 })
  }

  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('Trip')
    .update({ status: 'IN_PROGRESS', driverStartedAt: now })
    .eq('id', tripId)
    .select('*, stops:TripStop(*, child:Child(name, schoolName))')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
