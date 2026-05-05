import { supabase } from '@/lib/supabase'
import { optimizeRoute } from './optimize'
import type { StopToOptimize, OptimizationResult } from './types'
import { TRIP_START_HOURS } from './types'

async function getActiveChildrenWithSchedules(driverId: string, date: string) {
  const dayOfWeek = new Date(date).getDay()

  const { data: schedules } = await supabase
    .from('ChildSchedule')
    .select(`
      id, childId, daysOfWeek, startDate, endDate,
      morningPickupEarliest, morningPickupLatest,
      morningDropoffEarliest, morningDropoffLatest,
      afternoonPickupEarliest, afternoonPickupLatest,
      afternoonDropoffEarliest, afternoonDropoffLatest,
      child:Child!inner(
        id, name, schoolName, driverId, parentId,
        pickupAddress, pickupLat, pickupLng,
        dropoffAddress, dropoffLat, dropoffLng
      )
    `)
    .eq('isActive', true)
    .eq('child.isActive', true)
    .eq('child.driverId', driverId)
    .lte('startDate', date)
    .contains('daysOfWeek', [dayOfWeek])

  if (!schedules?.length) return []

  const childIds = schedules.map(s => s.childId)

  // Verify children have FULLY_SIGNED contracts
  const { data: contracts } = await supabase
    .from('Contract')
    .select('childId')
    .in('childId', childIds)
    .eq('driverId', driverId)
    .eq('status', 'FULLY_SIGNED')
  const contractedChildIds = new Set((contracts ?? []).map(c => c.childId))
  const contracted = schedules.filter(s => contractedChildIds.has(s.childId))
  if (!contracted.length) return []

  // Fetch overrides
  const { data: overrides } = await supabase
    .from('ScheduleOverride')
    .select('*')
    .in('childId', childIds)
    .eq('date', date)

  const overrideMap = new Map((overrides ?? []).map(o => [o.childId, o]))

  return contracted
    .filter(s => {
      if (s.endDate && s.endDate < date) return false
      const ov = overrideMap.get(s.childId)
      return ov?.action !== 'SKIP'
    })
    .map(s => {
      const c = Array.isArray(s.child) ? s.child[0] : s.child
      return {
      childId: c.id,
      childName: c.name,
      schoolName: c.schoolName,
      driverId: c.driverId,
      parentId: c.parentId,
      pickupAddress: c.pickupAddress,
      pickupLat: c.pickupLat,
      pickupLng: c.pickupLng,
      dropoffAddress: c.dropoffAddress,
      dropoffLat: c.dropoffLat,
      dropoffLng: c.dropoffLng,
      morningPickupEarliest: s.morningPickupEarliest,
      morningPickupLatest: s.morningPickupLatest,
      morningDropoffEarliest: s.morningDropoffEarliest,
      morningDropoffLatest: s.morningDropoffLatest,
      afternoonPickupEarliest: s.afternoonPickupEarliest,
      afternoonPickupLatest: s.afternoonPickupLatest,
      afternoonDropoffEarliest: s.afternoonDropoffEarliest,
      afternoonDropoffLatest: s.afternoonDropoffLatest,
    }})
}

function buildStopsForType(
  children: Awaited<ReturnType<typeof getActiveChildrenWithSchedules>>,
  tripType: 'MORNING' | 'AFTERNOON',
): StopToOptimize[] {
  if (tripType === 'MORNING') {
    return children.map(c => ({
      childId: c.childId,
      childName: c.childName,
      type: 'PICKUP' as const,
      address: c.pickupAddress,
      lat: c.pickupLat ?? 0,
      lng: c.pickupLng ?? 0,
      windowEarliest: c.morningPickupEarliest ? parseTime(c.morningPickupEarliest) : undefined,
      windowLatest: c.morningPickupLatest ? parseTime(c.morningPickupLatest) : undefined,
    }))
  } else {
    // Afternoon: pickup at school, dropoff at home
    const schoolStops = children.map(c => ({
      childId: c.childId,
      childName: c.childName,
      type: 'PICKUP' as const,
      address: c.dropoffAddress, // school = dropoff address from child record
      lat: c.dropoffLat ?? 0,
      lng: c.dropoffLng ?? 0,
      windowEarliest: c.afternoonPickupEarliest ? parseTime(c.afternoonPickupEarliest) : undefined,
      windowLatest: c.afternoonPickupLatest ? parseTime(c.afternoonPickupLatest) : undefined,
    }))

    // Deduplicate school stops by lat/lng (same school = same coordinates)
    const seen = new Set<string>()
    const uniqueSchoolStops = schoolStops.filter(s => {
      const key = `${s.lat},${s.lng}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    const homeStops = children.map(c => ({
      childId: c.childId,
      childName: c.childName,
      type: 'DROPOFF' as const,
      address: c.pickupAddress, // home = pickup address
      lat: c.pickupLat ?? 0,
      lng: c.pickupLng ?? 0,
      windowEarliest: c.afternoonDropoffEarliest ? parseTime(c.afternoonDropoffEarliest) : undefined,
      windowLatest: c.afternoonDropoffLatest ? parseTime(c.afternoonDropoffLatest) : undefined,
    }))

    return [...uniqueSchoolStops, ...homeStops]
  }
}

function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function timeToDate(date: string, minutes: number): string {
  const d = new Date(date + 'T00:00:00')
  d.setMinutes(d.getMinutes() + minutes)
  return d.toISOString()
}

export async function generateTripsForDriver(
  driverId: string,
  date: string,
): Promise<{ morningTripId?: string; afternoonTripId?: string }> {
  // Check if trips already exist for this driver/date (avoid dupes)
  const { data: existing } = await supabase
    .from('Trip')
    .select('id, type')
    .eq('driverId', driverId)
    .eq('date', date)
    .neq('status', 'CANCELLED')

  const existingTypes = new Set((existing ?? []).map(t => t.type))
  const result: { morningTripId?: string; afternoonTripId?: string } = {}

  if (!existingTypes.has('MORNING')) {
    result.morningTripId = await createSingleTrip(driverId, date, 'MORNING')
  }
  if (!existingTypes.has('AFTERNOON')) {
    result.afternoonTripId = await createSingleTrip(driverId, date, 'AFTERNOON')
  }

  return result
}

async function createSingleTrip(
  driverId: string,
  date: string,
  type: 'MORNING' | 'AFTERNOON',
): Promise<string | undefined> {
  const children = await getActiveChildrenWithSchedules(driverId, date)
  if (children.length === 0) return undefined

  const stops = buildStopsForType(children, type)
  const startMinutes = parseTime(TRIP_START_HOURS[type])

  // Filter out stops with missing coordinates
  const geocodedStops = stops.filter(s => s.lat !== 0 && s.lng !== 0)

  let optimizationResult: OptimizationResult
  if (geocodedStops.length >= 2) {
    optimizationResult = optimizeRoute(geocodedStops, type)
  } else {
    // Not enough geocoded data — use original order
    const fallback = stops.map((s, i) => ({
      childId: s.childId,
      childName: s.childName,
      type: s.type,
      address: s.address,
      lat: s.lat,
      lng: s.lng,
      stopOrder: i,
      estimatedArrivalMinutes: i * 5,
      distanceFromPrevMeters: 0,
      notes: s.notes,
    }))
    optimizationResult = { stops: fallback, totalDistanceMeters: 0, totalDurationSeconds: 0 }
  }

  const tripStart = new Date(date + 'T' + TRIP_START_HOURS[type])
  const tripId = crypto.randomUUID()

  // Insert trip
  const { error: tripErr } = await supabase.from('Trip').insert({
    id: tripId,
    driverId,
    date,
    type,
    status: 'SCHEDULED',
    totalDistanceMeters: optimizationResult.totalDistanceMeters,
    totalDurationSeconds: optimizationResult.totalDurationSeconds,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  if (tripErr) {
    console.error('[createSingleTrip] Failed to insert trip:', tripErr)
    return undefined
  }

  // Insert stops
  const tripStops = optimizationResult.stops.map(s => {
    const scheduledTime = timeToDate(date, startMinutes + s.estimatedArrivalMinutes)
    return {
      id: crypto.randomUUID(),
      tripId,
      childId: s.childId,
      type: s.type,
      stopOrder: s.stopOrder,
      address: s.address,
      lat: s.lat,
      lng: s.lng,
      scheduledTime,
      estimatedTime: scheduledTime,
      status: 'PENDING',
      notes: s.notes ?? null,
    }
  })

  const { error: stopsErr } = await supabase.from('TripStop').insert(tripStops)
  if (stopsErr) {
    console.error('[createSingleTrip] Failed to insert stops:', stopsErr)
    // Clean up the trip
    await supabase.from('Trip').delete().eq('id', tripId)
    return undefined
  }

  return tripId
}

export async function generateTripsForAllDrivers(date: string): Promise<number> {
  const { data: drivers } = await supabase
    .from('Driver')
    .select('id')
    .eq('status', 'ACTIVE')

  let generated = 0
  for (const driver of drivers ?? []) {
    try {
      const result = await generateTripsForDriver(driver.id, date)
      if (result.morningTripId) generated++
      if (result.afternoonTripId) generated++
    } catch (err) {
      console.error(`[generate-all] Failed for driver ${driver.id}:`, err)
    }
  }
  return generated
}
