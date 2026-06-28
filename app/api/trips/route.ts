import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { getOverdueParentIds } from '@/lib/payments/overdue-parents'

export async function GET(request: Request) {
  const session = await getSession(request.headers.get('cookie'))
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const rawDate = searchParams.get('date')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const type = searchParams.get('type') as 'MORNING' | 'AFTERNOON' | null

  // Either a single ?date=, or a ?from=&to= range (one request for a whole
  // calendar month — avoids ~30 separate requests on mobile).
  const isRange = !!(from && to)
  if (!rawDate && !isRange) {
    return NextResponse.json({ error: 'date (YYYY-MM-DD) or from+to range required' }, { status: 400 })
  }
  const date = rawDate

  function applyDateFilter(q: any) {
    return isRange ? q.gte('date', from).lte('date', to) : q.eq('date', date)
  }

  async function fetchTrips(driverId: string, autoGenerate: boolean) {
    let query = applyDateFilter(
      supabase
        .from('Trip')
        .select('*, stops:TripStop(*, child:Child(name, schoolName, parentId))')
        .eq('driverId', driverId),
    ).order('createdAt', { ascending: true })

    if (type) query = query.eq('type', type)

    const { data: trips } = await query

    // Auto-generate if no trips exist (single-date mode only — we never
    // bulk-generate a whole range on a calendar view).
    if ((trips ?? []).length === 0 && autoGenerate && !isRange) {
      const { generateTripsForDriver } = await import('@/lib/trips/generate')
      await generateTripsForDriver(driverId, date!)
      let q2 = supabase
        .from('Trip')
        .select('*, stops:TripStop(*, child:Child(name, schoolName, parentId))')
        .eq('driverId', driverId)
        .eq('date', date!)
        .order('createdAt', { ascending: true })
      if (type) q2 = q2.eq('type', type)
      const { data: trips2 } = await q2
      return (trips2 ?? []).map((t: any) => ({
        ...t,
        stops: (t.stops ?? []).sort((a: any, b: any) => a.stopOrder - b.stopOrder),
      }))
    }

    // Sort stops by stopOrder
    return (trips ?? []).map((t: any) => ({
      ...t,
      stops: (t.stops ?? []).sort((a: any, b: any) => a.stopOrder - b.stopOrder),
    }))
  }

  if (session.role === 'DRIVER') {
    const { data: driver } = await supabase
      .from('Driver').select('id').eq('userId', session.userId).maybeSingle()
    if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
    const trips = await fetchTrips(driver.id, true)

    // Compute the set of overdue parents ONCE for this driver, with graceful degradation
    let overdueSet = new Set<string>()
    try { overdueSet = await getOverdueParentIds(driver.id) }
    catch (err) { console.error('[trips] payment check failed, defaulting PAID:', err) }

    // Annotate each stop with paymentStatus and parentId (DRIVER branch only)
    const annotated = trips.map((trip: any) => ({
      ...trip,
      stops: (trip.stops ?? []).map((stop: any) => {
        const pid = stop.child?.parentId ?? null
        return {
          ...stop,
          parentId: pid ?? undefined,
          // Stops without a parentId (e.g. school stops) get no paymentStatus
          paymentStatus: pid
            ? (overdueSet.has(pid) ? 'OVERDUE' : 'PAID')
            : undefined,
        }
      }),
    }))
    return NextResponse.json(annotated)
  }

  if (session.role === 'PARENT') {
    const { data: parent } = await supabase
      .from('Parent').select('id').eq('userId', session.userId).maybeSingle()
    if (!parent) return NextResponse.json([], { status: 200 })

    const { data: children } = await supabase
      .from('Child').select('driverId').eq('parentId', parent.id).eq('isActive', true)
    const driverIds = [...new Set((children ?? []).map(c => c.driverId).filter(Boolean))]

    if (driverIds.length === 0) return NextResponse.json([])

    // Driver names so the parent can tell each driver's trips apart (a parent
    // with children across multiple drivers sees multiple trips per day).
    const { data: driverRows } = await supabase
      .from('Driver').select('id, user:User(name)').in('id', driverIds as string[])
    const driverNameById = new Map(
      (driverRows ?? []).map((d: any) => [d.id, d.user?.name ?? 'Your driver']),
    )

    const childIdsForParent = new Set((children ?? []).map((c: any) => c.id))

    const allTrips = []
    for (const did of driverIds) {
      const trips = await fetchTrips(did!, false)
      trips.forEach((t: any) => { t.driverName = driverNameById.get(did) })
      allTrips.push(...trips)
    }

    // PRIVACY: strip parentId from child objects and ensure no paymentStatus leaks.
    // Also mark which stops belong to THIS parent's children (for highlighting).
    const stripped = allTrips.map((trip: any) => ({
      ...trip,
      stops: (trip.stops ?? []).map((stop: any) => {
        const { paymentStatus: _ps, parentId: _pid, child, ...rest } = stop
        const { parentId: _cpid, ...childRest } = child ?? {}
        return { ...rest, isMyChild: childIdsForParent.has(stop.childId), child: child ? childRest : undefined }
      }),
    }))
    return NextResponse.json(stripped)
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
