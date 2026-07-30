import { describe, it, expect } from 'vitest'
import { optimizeRoute } from '../optimize'
import type { StopToOptimize } from '../types'

const AVG_SPEED_KMH = 30
const STOP_BUFFER_MIN = 2

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function travelMinutesExact(distMeters: number): number {
  return (distMeters / 1000 / AVG_SPEED_KMH) * 60 + STOP_BUFFER_MIN
}

function makeLeg(
  childId: string,
  childName: string,
  home: { lat: number; lng: number },
  school: { lat: number; lng: number },
  tripType: 'MORNING' | 'AFTERNOON',
): StopToOptimize[] {
  const pickup = tripType === 'MORNING' ? home : school
  const dropoff = tripType === 'MORNING' ? school : home
  return [
    { childId, childName, type: 'PICKUP', address: `${childName} pickup`, lat: pickup.lat, lng: pickup.lng },
    { childId, childName, type: 'DROPOFF', address: `${childName} dropoff`, lat: dropoff.lat, lng: dropoff.lng },
  ]
}

// Johannesburg CBD and Pretoria CBD — known ~55km apart, well over the 1000m cluster threshold
const SCHOOL_A = { lat: -26.2041, lng: 28.0473 }
const SCHOOL_B = { lat: -25.7479, lng: 28.2293 }
const HOME_A1 = { lat: -26.21, lng: 28.05 }
const HOME_A2 = { lat: -26.20, lng: 28.04 }
const HOME_B1 = { lat: -25.75, lng: 28.23 }

describe('optimizeRoute', () => {
  it('returns an empty result for no stops', () => {
    const result = optimizeRoute([], 'MORNING')
    expect(result).toEqual({ stops: [], totalDistanceMeters: 0, totalDurationSeconds: 0 })
  })

  it('drops a child that only has a PICKUP with no matching DROPOFF', () => {
    const stops: StopToOptimize[] = [
      { childId: 'c1', childName: 'Orphan', type: 'PICKUP', address: 'a', lat: HOME_A1.lat, lng: HOME_A1.lng },
    ]
    const result = optimizeRoute(stops, 'MORNING')
    expect(result.stops).toEqual([])
  })

  it('single child MORNING trip: pickup at home then dropoff at school', () => {
    const stops = makeLeg('c1', 'Child One', HOME_A1, SCHOOL_A, 'MORNING')
    const result = optimizeRoute(stops, 'MORNING')
    expect(result.stops.map(s => s.type)).toEqual(['PICKUP', 'DROPOFF'])
    expect(result.stops.map(s => s.stopOrder)).toEqual([0, 1])
    expect(result.stops[0].lat).toBeCloseTo(HOME_A1.lat)
    expect(result.stops[1].lat).toBeCloseTo(SCHOOL_A.lat)
  })

  it('single child AFTERNOON trip: pickup at school then dropoff at home', () => {
    const stops = makeLeg('c1', 'Child One', HOME_A1, SCHOOL_A, 'AFTERNOON')
    const result = optimizeRoute(stops, 'AFTERNOON')
    expect(result.stops.map(s => s.type)).toEqual(['PICKUP', 'DROPOFF'])
    expect(result.stops[0].lat).toBeCloseTo(SCHOOL_A.lat)
    expect(result.stops[1].lat).toBeCloseTo(HOME_A1.lat)
  })

  it('clusters children whose schools are within 1000m into one group (homes then schools)', () => {
    const SCHOOL_A_NEAR = { lat: SCHOOL_A.lat + 0.004, lng: SCHOOL_A.lng } // ~445m north, under the 1000m threshold
    const stops = [
      ...makeLeg('c1', 'Child One', HOME_A1, SCHOOL_A, 'MORNING'),
      ...makeLeg('c2', 'Child Two', HOME_A2, SCHOOL_A_NEAR, 'MORNING'),
    ]
    const result = optimizeRoute(stops, 'MORNING')
    const types = result.stops.map(s => s.type)
    expect(types.slice(0, 2).sort()).toEqual(['PICKUP', 'PICKUP'])
    expect(types.slice(2, 4).sort()).toEqual(['DROPOFF', 'DROPOFF'])
  })

  it('keeps schools >1000m apart in separate clusters, nearest cluster visited first', () => {
    const stops = [
      ...makeLeg('c1', 'Near School A', HOME_A1, SCHOOL_A, 'MORNING'),
      ...makeLeg('c2', 'Near School B', HOME_B1, SCHOOL_B, 'MORNING'),
    ]
    const result = optimizeRoute(stops, 'MORNING', HOME_A1)
    const childIds = result.stops.map(s => s.childId)
    // Started right next to cluster A's school — its whole cluster should be
    // fully visited before cluster B begins.
    expect(childIds.lastIndexOf('c1')).toBeLessThan(childIds.indexOf('c2'))
  })

  it('with no start point, the first stop has zero distance/ETA (route begins there)', () => {
    const stops = makeLeg('c1', 'Child One', HOME_A1, SCHOOL_A, 'MORNING')
    const result = optimizeRoute(stops, 'MORNING')
    expect(result.stops[0].distanceFromPrevMeters).toBe(0)
    expect(result.stops[0].estimatedArrivalMinutes).toBe(0)
  })

  it('a start point adds a real first-leg distance/ETA from that location', () => {
    const stops = makeLeg('c1', 'Child One', HOME_A1, SCHOOL_A, 'MORNING')
    const withoutStart = optimizeRoute(stops, 'MORNING')
    const withStart = optimizeRoute(stops, 'MORNING', SCHOOL_B)
    expect(withStart.stops[0].distanceFromPrevMeters).toBeGreaterThan(0)
    expect(withStart.totalDurationSeconds).toBeGreaterThan(withoutStart.totalDurationSeconds)
  })

  it('computes cumulative ETA and total distance from haversine + 30km/h + 2min buffer', () => {
    const stops = makeLeg('c1', 'Child One', HOME_A1, SCHOOL_A, 'MORNING')
    const result = optimizeRoute(stops, 'MORNING')
    const dist = haversine(HOME_A1.lat, HOME_A1.lng, SCHOOL_A.lat, SCHOOL_A.lng)
    const minutesExact = travelMinutesExact(dist)

    expect(result.stops[1].distanceFromPrevMeters).toBe(Math.round(dist))
    expect(result.stops[1].estimatedArrivalMinutes).toBe(Math.round(minutesExact))
    expect(result.totalDistanceMeters).toBe(Math.round(dist))
    expect(result.totalDurationSeconds).toBe(Math.round(minutesExact * 60))
  })
})

function maxConcurrentOnboard(stops: { type: 'PICKUP' | 'DROPOFF' }[]): number {
  let onboard = 0
  let max = 0
  for (const s of stops) {
    if (s.type === 'PICKUP') { onboard++; max = Math.max(max, onboard) }
    else onboard--
  }
  return max
}

describe('optimizeRoute — vehicle capacity', () => {
  const homes = Array.from({ length: 5 }, (_, i) => ({ lat: HOME_A1.lat + i * 0.0002, lng: HOME_A1.lng }))
  const stops = homes.flatMap((home, i) => makeLeg(`c${i}`, `Child ${i}`, home, SCHOOL_A, 'MORNING'))

  it('without a capacity limit, all children may be onboard at once', () => {
    const result = optimizeRoute(stops, 'MORNING')
    expect(maxConcurrentOnboard(result.stops)).toBe(5)
  })

  it('with a capacity limit, occupancy never exceeds it, and every stop is still generated', () => {
    const result = optimizeRoute(stops, 'MORNING', undefined, { vehicleCapacity: 2 })
    expect(maxConcurrentOnboard(result.stops)).toBeLessThanOrEqual(2)
    expect(result.stops).toHaveLength(10)
    expect(new Set(result.stops.map(s => s.childId))).toEqual(new Set(stops.map(s => s.childId)))
  })
})

describe('optimizeRoute — payment status tie-break', () => {
  const START = { lat: -26.20, lng: 28.05 }
  const HOME_PAID = { lat: -26.19, lng: 28.05 }
  const HOME_OVERDUE = { lat: -26.21, lng: 28.05 }
  const SCHOOL = { lat: -26.20, lng: 28.06 }

  it('visits a near-equidistant paid stop before an overdue one', () => {
    const stops: StopToOptimize[] = [
      { childId: 'paid', childName: 'Paid', type: 'PICKUP', address: 'a', lat: HOME_PAID.lat, lng: HOME_PAID.lng, overdue: false },
      { childId: 'paid', childName: 'Paid', type: 'DROPOFF', address: 'b', lat: SCHOOL.lat, lng: SCHOOL.lng },
      { childId: 'overdue', childName: 'Overdue', type: 'PICKUP', address: 'c', lat: HOME_OVERDUE.lat, lng: HOME_OVERDUE.lng, overdue: true },
      { childId: 'overdue', childName: 'Overdue', type: 'DROPOFF', address: 'd', lat: SCHOOL.lat, lng: SCHOOL.lng },
    ]
    const result = optimizeRoute(stops, 'MORNING', START)
    expect(result.stops[0].childId).toBe('paid')
  })
})

describe('optimizeRoute — time windows', () => {
  it('does not evaluate windows at all when tripStartMinutes is omitted', () => {
    const stops: StopToOptimize[] = [
      { childId: 'c1', childName: 'C', type: 'PICKUP', address: 'a', lat: HOME_A1.lat, lng: HOME_A1.lng, windowLatest: 1 },
      { childId: 'c1', childName: 'C', type: 'DROPOFF', address: 'b', lat: SCHOOL_A.lat, lng: SCHOOL_A.lng },
    ]
    const result = optimizeRoute(stops, 'MORNING')
    expect(result.stops[0].lateByMinutes).toBeUndefined()
  })

  it('waits for windowEarliest rather than departing early', () => {
    const stops: StopToOptimize[] = [
      { childId: 'c1', childName: 'C', type: 'PICKUP', address: 'a', lat: HOME_A1.lat, lng: HOME_A1.lng, windowEarliest: 400 },
      { childId: 'c1', childName: 'C', type: 'DROPOFF', address: 'b', lat: SCHOOL_A.lat, lng: SCHOOL_A.lng },
    ]
    // Start exactly at the pickup point, so natural arrival is ~0 minutes — well before windowEarliest.
    const result = optimizeRoute(stops, 'MORNING', HOME_A1, { tripStartMinutes: 360 })
    expect(result.stops[0].estimatedArrivalMinutes).toBe(40) // 400 - 360
    expect(result.stops[0].lateByMinutes).toBeUndefined()
  })

  it('flags lateByMinutes when the estimated arrival falls after windowLatest', () => {
    const stops: StopToOptimize[] = [
      { childId: 'c1', childName: 'C', type: 'PICKUP', address: 'a', lat: HOME_A1.lat, lng: HOME_A1.lng, windowLatest: 365 },
      { childId: 'c1', childName: 'C', type: 'DROPOFF', address: 'b', lat: SCHOOL_A.lat, lng: SCHOOL_A.lng },
    ]
    // Starting from far-away SCHOOL_B makes the first leg long enough to blow past a 5-minute window.
    const result = optimizeRoute(stops, 'MORNING', SCHOOL_B, { tripStartMinutes: 360 })
    const dist = haversine(SCHOOL_B.lat, SCHOOL_B.lng, HOME_A1.lat, HOME_A1.lng)
    const minutesExact = travelMinutesExact(dist)
    const expectedLate = Math.round(360 + minutesExact - 365)

    expect(result.stops[0].estimatedArrivalMinutes).toBe(Math.round(minutesExact))
    expect(result.stops[0].lateByMinutes).toBe(expectedLate)
  })

  it('a tighter windowLatest deadline wins a near-equidistant tie', () => {
    const START = { lat: -26.20, lng: 28.05 }
    const HOME_TIGHT = { lat: -26.20, lng: 28.04 }
    const HOME_LOOSE = { lat: -26.20, lng: 28.06 }
    const SCHOOL = { lat: -26.20, lng: 28.05 }
    const stops: StopToOptimize[] = [
      { childId: 'tight', childName: 'Tight', type: 'PICKUP', address: 'a', lat: HOME_TIGHT.lat, lng: HOME_TIGHT.lng, windowLatest: 400 },
      { childId: 'tight', childName: 'Tight', type: 'DROPOFF', address: 'b', lat: SCHOOL.lat, lng: SCHOOL.lng },
      { childId: 'loose', childName: 'Loose', type: 'PICKUP', address: 'c', lat: HOME_LOOSE.lat, lng: HOME_LOOSE.lng, windowLatest: 500 },
      { childId: 'loose', childName: 'Loose', type: 'DROPOFF', address: 'd', lat: SCHOOL.lat, lng: SCHOOL.lng },
    ]
    const result = optimizeRoute(stops, 'MORNING', START)
    expect(result.stops[0].childId).toBe('tight')
  })
})
