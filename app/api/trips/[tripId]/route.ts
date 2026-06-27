import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { getOverdueParentIds } from '@/lib/payments/overdue-parents'

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
    .select('*, stops:TripStop(*, child:Child(name, schoolName, parentId))')
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

    // Compute overdue set for this driver with graceful degradation
    let overdueSet = new Set<string>()
    try { overdueSet = await getOverdueParentIds(driver.id) }
    catch (err) { console.error('[trip] payment check failed, defaulting PAID:', err) }

    // Sort stops and annotate each with paymentStatus + parentId
    const stops = (trip.stops ?? [])
      .sort((a: any, b: any) => a.stopOrder - b.stopOrder)
      .map((stop: any) => {
        const pid = stop.child?.parentId ?? null
        return {
          ...stop,
          parentId: pid ?? undefined,
          paymentStatus: pid
            ? (overdueSet.has(pid) ? 'OVERDUE' : 'PAID')
            : undefined,
        }
      })
    return NextResponse.json({ ...trip, stops })
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

    // PRIVACY: strip parentId from child objects; no paymentStatus for parents
    const stops = (trip.stops ?? [])
      .sort((a: any, b: any) => a.stopOrder - b.stopOrder)
      .map((stop: any) => {
        const { paymentStatus: _ps, parentId: _pid, child, ...rest } = stop
        const { parentId: _cpid, ...childRest } = child ?? {}
        return { ...rest, child: child ? childRest : undefined }
      })
    return NextResponse.json({ ...trip, stops })
  }

  if (session.role === 'ADMIN') {
    // Admin sees trip data without payment annotations (Phase 1: admin sees compliance, not payments)
    const stops = (trip.stops ?? [])
      .sort((a: any, b: any) => a.stopOrder - b.stopOrder)
      .map((stop: any) => {
        const { paymentStatus: _ps, parentId: _pid, child, ...rest } = stop
        const { parentId: _cpid, ...childRest } = child ?? {}
        return { ...rest, child: child ? childRest : undefined }
      })
    return NextResponse.json({ ...trip, stops })
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
