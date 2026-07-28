import { describe, it, expect } from 'vitest'
import { recalculateETAs } from '../eta'

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
  return (distMeters / 1000 / 30) * 60 + 2
}

const CURRENT_POSITION = { lat: -26.2041, lng: 28.0473 }
const STOP_A = { stopId: 's1', lat: -26.21, lng: 28.05, stopOrder: 0 }
const STOP_B = { stopId: 's2', lat: -26.22, lng: 28.06, stopOrder: 1 }

describe('recalculateETAs', () => {
  it('returns [] for no remaining stops', () => {
    expect(recalculateETAs([], CURRENT_POSITION, new Date('2026-08-03T06:00:00.000Z'))).toEqual([])
  })

  it('accumulates travel time from the current position across each remaining stop', () => {
    const currentTime = new Date('2026-08-03T06:00:00.000Z')
    const result = recalculateETAs([STOP_A, STOP_B], CURRENT_POSITION, currentTime)

    const minutesToA = travelMinutesExact(haversine(CURRENT_POSITION.lat, CURRENT_POSITION.lng, STOP_A.lat, STOP_A.lng))
    const minutesToB = minutesToA + travelMinutesExact(haversine(STOP_A.lat, STOP_A.lng, STOP_B.lat, STOP_B.lng))

    expect(result[0]).toEqual({
      stopId: 's1',
      estimatedMinutes: Math.round(minutesToA),
      estimatedTime: new Date(currentTime.getTime() + minutesToA * 60 * 1000),
    })
    expect(result[1]).toEqual({
      stopId: 's2',
      estimatedMinutes: Math.round(minutesToB),
      estimatedTime: new Date(currentTime.getTime() + minutesToB * 60 * 1000),
    })
  })

  it('preserves the input order of remainingStops rather than sorting by stopOrder', () => {
    // stopOrder deliberately reversed relative to array order — the function
    // should walk the array as given, not re-sort by stopOrder.
    const outOfOrder = [
      { stopId: 'first', lat: STOP_A.lat, lng: STOP_A.lng, stopOrder: 5 },
      { stopId: 'second', lat: STOP_B.lat, lng: STOP_B.lng, stopOrder: 1 },
    ]
    const result = recalculateETAs(outOfOrder, CURRENT_POSITION, new Date('2026-08-03T06:00:00.000Z'))
    expect(result.map(r => r.stopId)).toEqual(['first', 'second'])
  })

  it('zero distance still adds the 2-minute stop buffer', () => {
    const samePoint = [{ stopId: 's1', lat: CURRENT_POSITION.lat, lng: CURRENT_POSITION.lng, stopOrder: 0 }]
    const result = recalculateETAs(samePoint, CURRENT_POSITION, new Date('2026-08-03T06:00:00.000Z'))
    expect(result[0].estimatedMinutes).toBe(2)
  })
})
