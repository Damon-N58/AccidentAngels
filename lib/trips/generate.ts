import { supabase } from '@/lib/supabase'
import { optimizeRoute } from './optimize'
import type { StopToOptimize, OptimizationResult, ChildWithSchedule } from './types'
import { TRIP_START_HOURS } from './types'
import { getOverdueParentIds } from '@/lib/payments/overdue-parents'

async function getActiveChildrenWithSchedules(driverId: string, date: string) {
  const dayOfWeek = new Date(date).getDay()
  const datePrefix = date.slice(0, 10) // YYYY-MM-DD

  // Step 1: get all active children for this driver
  const { data: children, error: childErr } = await supabase
    .from('Child')
    .select('id, name, schoolName, driverId, parentId, pickupAddress, pickupLat, pickupLng, dropoffAddress, dropoffLat, dropoffLng')
    .eq('driverId', driverId)
    .eq('isActive', true)

  if (childErr) console.error('[generate] children fetch error:', childErr)
  if (!children?.length) return []

  const childIds = children.map(c => c.id)

  // Step 2: get all active schedules for those children
  const { data: schedules, error: schedErr } = await supabase
    .from('ChildSchedule')
    .select('id, childId, daysOfWeek, startDate, endDate, morningPickupEarliest, morningPickupLatest, morningDropoffEarliest, morningDropoffLatest, afternoonPickupEarliest, afternoonPickupLatest, afternoonDropoffEarliest, afternoonDropoffLatest')
    .in('childId', childIds)
    .eq('isActive', true)

  if (schedErr) console.error('[generate] schedules fetch error:', schedErr)
  if (!schedules?.length) return []

  // Step 3: filter by date + day of week in JavaScript (avoids JSONB cs.{} vs cs.[] issue)
  const activeSchedules = schedules.filter(s => {
    // startDate must be on or before today
    const start = (s.startDate as string).slice(0, 10)
    if (start > datePrefix) return false
    // endDate must not have passed
    if (s.endDate) {
      const end = (s.endDate as string).slice(0, 10)
      if (end < datePrefix) return false
    }
    // daysOfWeek must include today — handle both JSONB array and plain array
    const days: number[] = Array.isArray(s.daysOfWeek)
      ? s.daysOfWeek
      : (typeof s.daysOfWeek === 'string' ? JSON.parse(s.daysOfWeek) : Object.values(s.daysOfWeek ?? {}))
    return days.includes(dayOfWeek)
  })

  if (!activeSchedules.length) return []

  // Step 4: fetch SKIP overrides for today
  const activeChildIds = activeSchedules.map(s => s.childId)
  const { data: overrides } = await supabase
    .from('ScheduleOverride')
    .select('childId, action')
    .in('childId', activeChildIds)
    .eq('date', datePrefix)

  const skipSet = new Set((overrides ?? []).filter(o => o.action === 'SKIP').map(o => o.childId))

  // Step 5: combine — dedupe by childId so a child with multiple active
  // schedule rows only produces ONE set of stops (was causing duplicate stops)
  const childMap = new Map(children.map(c => [c.id, c]))
  const seenChildIds = new Set<string>()

  return activeSchedules
    .filter(s => !skipSet.has(s.childId))
    .filter(s => {
      if (seenChildIds.has(s.childId)) return false
      seenChildIds.add(s.childId)
      return true
    })
    .map(s => {
      const c = childMap.get(s.childId)!
      return {
        childId:                  c.id,
        childName:                c.name,
        schoolName:               c.schoolName,
        driverId:                 c.driverId,
        parentId:                 c.parentId,
        pickupAddress:            c.pickupAddress,
        pickupLat:                c.pickupLat,
        pickupLng:                c.pickupLng,
        dropoffAddress:           c.dropoffAddress,
        dropoffLat:               c.dropoffLat,
        dropoffLng:               c.dropoffLng,
        morningPickupEarliest:    s.morningPickupEarliest,
        morningPickupLatest:      s.morningPickupLatest,
        morningDropoffEarliest:   s.morningDropoffEarliest,
        morningDropoffLatest:     s.morningDropoffLatest,
        afternoonPickupEarliest:  s.afternoonPickupEarliest,
        afternoonPickupLatest:    s.afternoonPickupLatest,
        afternoonDropoffEarliest: s.afternoonDropoffEarliest,
        afternoonDropoffLatest:   s.afternoonDropoffLatest,
      }
    })
}

export function buildStopsForType(
  children: ChildWithSchedule[],
  tripType: 'MORNING' | 'AFTERNOON',
  overdueParentIds: Set<string>,
): StopToOptimize[] {
  if (tripType === 'MORNING') {
    // Morning: pick each child up at home (PICKUP), then drop at school (DROPOFF).
    // A child must have BOTH home and school coordinates to be routed.
    const routable = children.filter(c => {
      if (c.pickupLat == null || c.pickupLng == null) {
        console.warn(`[generate] Skipping child ${c.childId} (${c.childName}): missing home coordinates`)
        return false
      }
      if (c.dropoffLat == null || c.dropoffLng == null) {
        console.warn(`[generate] Skipping child ${c.childId} (${c.childName}): missing school coordinates`)
        return false
      }
      return true
    })

    const pickups = routable.map(c => ({
      childId: c.childId,
      childName: c.childName,
      type: 'PICKUP' as const,
      address: c.pickupAddress,
      lat: c.pickupLat!,
      lng: c.pickupLng!,
      windowEarliest: c.morningPickupEarliest ? parseTime(c.morningPickupEarliest) : undefined,
      windowLatest: c.morningPickupLatest ? parseTime(c.morningPickupLatest) : undefined,
      overdue: overdueParentIds.has(c.parentId),
    }))

    const dropoffs = routable.map(c => ({
      childId: c.childId,
      childName: c.childName,
      type: 'DROPOFF' as const,
      address: c.dropoffAddress, // school
      lat: c.dropoffLat!,
      lng: c.dropoffLng!,
      windowEarliest: c.morningDropoffEarliest ? parseTime(c.morningDropoffEarliest) : undefined,
      windowLatest: c.morningDropoffLatest ? parseTime(c.morningDropoffLatest) : undefined,
      overdue: overdueParentIds.has(c.parentId),
    }))

    return [...pickups, ...dropoffs]
  } else {
    // Afternoon: pickup at school, dropoff at home
    const schoolStops = children
      .filter(c => {
        if (c.dropoffLat == null || c.dropoffLng == null) {
          console.warn(`[generate] Skipping child ${c.childId} (${c.childName}): missing school coordinates`)
          return false
        }
        return true
      })
      .map(c => ({
        childId: c.childId,
        childName: c.childName,
        type: 'PICKUP' as const,
        address: c.dropoffAddress, // school = dropoff address from child record
        lat: c.dropoffLat!,
        lng: c.dropoffLng!,
        windowEarliest: c.afternoonPickupEarliest ? parseTime(c.afternoonPickupEarliest) : undefined,
        windowLatest: c.afternoonPickupLatest ? parseTime(c.afternoonPickupLatest) : undefined,
        overdue: overdueParentIds.has(c.parentId),
      }))

    // NOTE: do NOT deduplicate school pickups by coordinate. Each child needs
    // their OWN school PICKUP leg: optimizeRoute pairs stops by childId and
    // discards any child missing a pickup or dropoff. Collapsing same-school
    // pickups to one child stranded every other child at that school (they got
    // a home dropoff but no pickup, so they were dropped from the route and
    // never taken home). This mirrors the morning path, which emits one
    // per-child school DROPOFF with no dedup.
    const homeStops = children
      .filter(c => {
        if (c.pickupLat == null || c.pickupLng == null) return false
        return true
      })
      .map(c => ({
        childId: c.childId,
        childName: c.childName,
        type: 'DROPOFF' as const,
        address: c.pickupAddress, // home = pickup address
        lat: c.pickupLat!,
        lng: c.pickupLng!,
        windowEarliest: c.afternoonDropoffEarliest ? parseTime(c.afternoonDropoffEarliest) : undefined,
        windowLatest: c.afternoonDropoffLatest ? parseTime(c.afternoonDropoffLatest) : undefined,
        overdue: overdueParentIds.has(c.parentId),
      }))

    return [...schoolStops, ...homeStops]
  }
}

async function getDriverRouteContext(
  driverId: string,
): Promise<{ start?: { lat: number; lng: number }; vehicleCapacity?: number }> {
  const { data } = await supabase
    .from('Driver')
    .select('baseLat, baseLng, vehicleCapacity')
    .eq('id', driverId)
    .maybeSingle()

  return {
    start: data?.baseLat != null && data?.baseLng != null
      ? { lat: data.baseLat, lng: data.baseLng }
      : undefined,
    vehicleCapacity: data?.vehicleCapacity ?? undefined,
  }
}

function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function timeToDate(date: string, minutes: number): string {
  // TRIP_START_HOURS are South African local times (SAST = UTC+2, no DST).
  // Anchor to SAST midnight so the stored timestamp renders as the intended
  // local time; without the offset a 06:00 start was stored as 06:00Z and shown
  // to SA users as 08:00.
  const sastMidnight = Date.parse(date.slice(0, 10) + 'T00:00:00+02:00')
  return new Date(sastMidnight + minutes * 60_000).toISOString()
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

  let overdueParentIds = new Set<string>()
  try {
    overdueParentIds = await getOverdueParentIds(driverId)
  } catch (err) {
    console.error('[generate] payment check failed, defaulting all PAID:', err)
  }

  const stops = buildStopsForType(children, type, overdueParentIds)
  const startMinutes = parseTime(TRIP_START_HOURS[type])

  // Filter out stops with missing coordinates
  const geocodedStops = stops.filter(s => s.lat !== 0 && s.lng !== 0)

  let optimizationResult: OptimizationResult
  if (geocodedStops.length >= 2) {
    const { start, vehicleCapacity } = await getDriverRouteContext(driverId)
    optimizationResult = optimizeRoute(geocodedStops, type, start, { vehicleCapacity, tripStartMinutes: startMinutes })
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
      lateByMinutes: s.lateByMinutes ?? null,
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
