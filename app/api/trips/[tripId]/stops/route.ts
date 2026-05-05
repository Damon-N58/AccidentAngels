import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { recalculateETAs } from '@/lib/trips/eta'
import { validateAndParseJson } from '@/lib/request-validation'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const session = await getSession(request.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (session.role !== 'DRIVER') {
    return NextResponse.json({ error: 'Only drivers can update stops' }, { status: 403 })
  }

  const { tripId } = await params
  const [rawBody, bodyErr] = await validateAndParseJson(request)
  if (bodyErr) return bodyErr
  const body = rawBody as Record<string, any>

  if (!body.stopId || !body.status) {
    return NextResponse.json({ error: 'stopId and status are required' }, { status: 400 })
  }

  if (!['COMPLETED', 'MISSED'].includes(body.status)) {
    return NextResponse.json({ error: 'status must be COMPLETED or MISSED' }, { status: 400 })
  }

  const { data: driver } = await supabase
    .from('Driver').select('id').eq('userId', session.userId).maybeSingle()
  if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })

  // Verify driver owns this trip
  const { data: trip } = await supabase
    .from('Trip').select('id, driverId, status').eq('id', tripId).maybeSingle()
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  if (trip.driverId !== driver.id) {
    return NextResponse.json({ error: 'You do not own this trip' }, { status: 403 })
  }

  const now = new Date().toISOString()

  const updateFields: Record<string, any> = {
    status: body.status,
    actualTime: now,
    completedAt: now,
  }
  if (body.status === 'MISSED' && body.missedReason) {
    updateFields.missedReason = body.missedReason
  }
  if (body.lat != null && body.lng != null) {
    updateFields.lat = body.lat
    updateFields.lng = body.lng
  }

  const { error: stopError } = await supabase
    .from('TripStop')
    .update(updateFields)
    .eq('id', body.stopId)
    .eq('tripId', tripId)

  if (stopError) {
    return NextResponse.json({ error: stopError.message }, { status: 500 })
  }

  // Check if all stops are done and auto-complete trip
  const { data: remaining } = await supabase
    .from('TripStop')
    .select('id, status, lat, lng, stopOrder, address, childId, type, estimatedTime, scheduledTime')
    .eq('tripId', tripId)
    .order('stopOrder', { ascending: true })

  const pendingStops = remaining?.filter(s => s.status === 'PENDING') ?? []
  let tripCompleted = false

  if (pendingStops.length === 0) {
    await supabase
      .from('Trip')
      .update({ status: 'COMPLETED', driverEndedAt: now })
      .eq('id', tripId)
    tripCompleted = true
  } else {
    // Recalculate ETAs for remaining stops
    const currentPosition = body.lat != null && body.lng != null
      ? { lat: body.lat, lng: body.lng }
      : { lat: pendingStops[0]?.lat ?? 0, lng: pendingStops[0]?.lng ?? 0 }

    const remainingWithCurrent = pendingStops.map(s => ({
      stopId: s.id,
      lat: s.lat ?? 0,
      lng: s.lng ?? 0,
      stopOrder: s.stopOrder,
    }))

    const etaResults = recalculateETAs(remainingWithCurrent, currentPosition, new Date())

    // Update estimated times
    for (let i = 0; i < Math.min(etaResults.length, pendingStops.length); i++) {
      const stopId = pendingStops[i].id
      const minutes = etaResults[i].estimatedMinutes
      const etaTime = new Date(Date.now() + minutes * 60000).toISOString()
      await supabase
        .from('TripStop')
        .update({ estimatedTime: etaTime })
        .eq('id', stopId)
    }
  }

  // Fetch updated trip
  const { data: updatedTrip } = await supabase
    .from('Trip')
    .select('*, stops:TripStop(*, child:Child(name, schoolName))')
    .eq('id', tripId)
    .maybeSingle()

  if (updatedTrip?.stops) {
    updatedTrip.stops.sort((a: any, b: any) => a.stopOrder - b.stopOrder)
  }

  return NextResponse.json({
    ...updatedTrip,
    tripCompleted,
  })
}
