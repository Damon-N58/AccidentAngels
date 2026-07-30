import { describe, it, expect } from 'vitest'
import { buildStopsForType } from '../generate'
import { optimizeRoute } from '../optimize'
import type { ChildWithSchedule } from '../types'

// Minimal ChildWithSchedule builder for routing tests.
function child(over: Partial<ChildWithSchedule> & { childId: string }): ChildWithSchedule {
  return {
    childName: over.childId,
    schoolName: 'School',
    driverId: 'd1',
    parentId: `p-${over.childId}`,
    pickupAddress: 'home',
    pickupLat: 0,
    pickupLng: 0,
    dropoffAddress: 'school',
    dropoffLat: 0,
    dropoffLng: 0,
    ...over,
  }
}

// Regression: one driver, kids sharing a school. The afternoon path used to
// dedupe school pickups by coordinate, which made optimizeRoute drop every
// child but one per school (no route home). These lock in that EVERY child is
// routed with both legs.
describe('trip generation — multiple children, multiple schools', () => {
  it('AFTERNOON: 3 children sharing one school all get picked up AND dropped home', () => {
    const kids = [
      child({ childId: 'a', pickupLat: -26.20, pickupLng: 28.00, dropoffLat: -26.10, dropoffLng: 28.05 }),
      child({ childId: 'b', pickupLat: -26.21, pickupLng: 28.01, dropoffLat: -26.10, dropoffLng: 28.05 }),
      child({ childId: 'c', pickupLat: -26.22, pickupLng: 28.02, dropoffLat: -26.10, dropoffLng: 28.05 }),
    ]

    const stops = buildStopsForType(kids, 'AFTERNOON', new Set())
    // One school PICKUP + one home DROPOFF per child (no coordinate dedup).
    expect(stops.filter(s => s.type === 'PICKUP')).toHaveLength(3)
    expect(stops.filter(s => s.type === 'DROPOFF')).toHaveLength(3)

    // The optimizer must keep all three children (both legs paired).
    const result = optimizeRoute(stops, 'AFTERNOON')
    const routedChildIds = new Set(result.stops.map(s => s.childId))
    expect(routedChildIds).toEqual(new Set(['a', 'b', 'c']))
    for (const k of kids) {
      expect(result.stops.filter(s => s.childId === k.childId)).toHaveLength(2)
    }
  })

  it('MORNING: children across two schools are all routed, pickup before dropoff', () => {
    const kids = [
      child({ childId: 'a1', pickupLat: -26.20, pickupLng: 28.00, dropoffLat: -26.10, dropoffLng: 28.05 }), // school 1
      child({ childId: 'a2', pickupLat: -26.21, pickupLng: 28.01, dropoffLat: -26.10, dropoffLng: 28.05 }), // school 1
      child({ childId: 'b1', pickupLat: -26.40, pickupLng: 28.30, dropoffLat: -26.50, dropoffLng: 28.40 }), // school 2 (far)
      child({ childId: 'b2', pickupLat: -26.41, pickupLng: 28.31, dropoffLat: -26.50, dropoffLng: 28.40 }), // school 2
    ]

    const stops = buildStopsForType(kids, 'MORNING', new Set())
    const result = optimizeRoute(stops, 'MORNING')

    const routedChildIds = new Set(result.stops.map(s => s.childId))
    expect(routedChildIds).toEqual(new Set(['a1', 'a2', 'b1', 'b2']))

    for (const k of kids) {
      const legs = result.stops
        .filter(s => s.childId === k.childId)
        .sort((x, y) => x.stopOrder - y.stopOrder)
      expect(legs).toHaveLength(2)
      expect(legs[0].type).toBe('PICKUP') // picked up at home...
      expect(legs[1].type).toBe('DROPOFF') // ...before being dropped at school
    }
  })
})
