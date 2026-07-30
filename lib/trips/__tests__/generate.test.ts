import { describe, it, expect, beforeEach, vi } from 'vitest'

// A minimal in-memory stand-in for the Supabase query builder, covering only
// the chains generate.ts actually uses: select/eq/neq/in (filtered read),
// insert, and delete().eq(). Shared with the mock factory via vi.hoisted so
// tests can seed/reset table state directly.
const mocks = vi.hoisted(() => {
  const tables: Record<string, Record<string, unknown>[]> = {}

  function makeQuery(table: string) {
    const rows = tables[table] ?? []
    const filters: Array<(row: Record<string, unknown>) => boolean> = []
    const builder = {
      select: () => builder,
      eq: (col: string, val: unknown) => { filters.push(r => r[col] === val); return builder },
      neq: (col: string, val: unknown) => { filters.push(r => r[col] !== val); return builder },
      in: (col: string, vals: unknown[]) => { filters.push(r => vals.includes(r[col])); return builder },
      insert: (payload: unknown) => {
        const arr = Array.isArray(payload) ? payload : [payload]
        tables[table] = [...(tables[table] ?? []), ...(arr as Record<string, unknown>[])]
        return Promise.resolve({ error: null })
      },
      delete: () => ({
        eq: (col: string, val: unknown) => {
          tables[table] = (tables[table] ?? []).filter(r => r[col] !== val)
          return Promise.resolve({ error: null })
        },
      }),
      maybeSingle: () => {
        const filtered = rows.filter(r => filters.every(f => f(r)))
        return Promise.resolve({ data: filtered[0] ?? null, error: null })
      },
      then: (resolve: (v: { data: unknown[]; error: null }) => void) => {
        resolve({ data: rows.filter(r => filters.every(f => f(r))), error: null })
      },
    }
    return builder
  }

  return { tables, makeQuery }
})

vi.mock('@/lib/supabase', () => ({
  supabase: { from: (table: string) => mocks.makeQuery(table) },
}))

const { generateTripsForDriver, generateTripsForAllDrivers } = await import('../generate')

function seed(table: string, rows: Record<string, unknown>[]) {
  mocks.tables[table] = rows
}

beforeEach(() => {
  for (const key of Object.keys(mocks.tables)) delete mocks.tables[key]
})

const TEST_DATE = '2026-08-03'
const TEST_DOW = new Date(TEST_DATE).getDay()

const CHILD = {
  id: 'child-1',
  name: 'Test Child',
  schoolName: 'Test School',
  driverId: 'driver-1',
  parentId: 'parent-1',
  isActive: true,
  pickupAddress: '1 Home St',
  pickupLat: -26.21,
  pickupLng: 28.05,
  dropoffAddress: '2 School Rd',
  dropoffLat: -26.2041,
  dropoffLng: 28.0473,
}

function fullDaySchedule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sched-1',
    childId: 'child-1',
    daysOfWeek: [TEST_DOW],
    startDate: '2020-01-01',
    endDate: null,
    isActive: true,
    morningPickupEarliest: '06:30',
    morningPickupLatest: '07:00',
    morningDropoffEarliest: '07:15',
    morningDropoffLatest: '07:30',
    afternoonPickupEarliest: '13:30',
    afternoonPickupLatest: '13:45',
    afternoonDropoffEarliest: '14:00',
    afternoonDropoffLatest: '14:15',
    ...overrides,
  }
}

describe('generateTripsForDriver', () => {
  it('creates a MORNING and an AFTERNOON trip with 2 ordered stops each', async () => {
    seed('Child', [CHILD])
    seed('ChildSchedule', [fullDaySchedule()])
    seed('ScheduleOverride', [])
    seed('Trip', [])

    const result = await generateTripsForDriver('driver-1', TEST_DATE)

    expect(result.morningTripId).toBeTruthy()
    expect(result.afternoonTripId).toBeTruthy()

    const trips = mocks.tables['Trip']
    expect(trips).toHaveLength(2)
    expect(trips.map(t => t.type).sort()).toEqual(['AFTERNOON', 'MORNING'])

    const stops = mocks.tables['TripStop']
    expect(stops).toHaveLength(4) // 2 stops per trip x 2 trips
    const morningStops = stops.filter(s => s.tripId === result.morningTripId)
    expect(morningStops.map(s => s.type)).toEqual(['PICKUP', 'DROPOFF'])
    expect(morningStops.map(s => s.stopOrder)).toEqual([0, 1])
  })

  it("uses the driver's base location as the route's start point", async () => {
    seed('Child', [CHILD]) // home/school both near Johannesburg CBD, close together
    seed('ChildSchedule', [fullDaySchedule()])
    seed('ScheduleOverride', [])
    seed('Trip', [])
    // Base location ~55km away in Pretoria — should add a large first leg
    // that wouldn't exist if optimizeRoute were called with no start at all.
    seed('Driver', [{ id: 'driver-1', baseLat: -25.7479, baseLng: 28.2293 }])

    const result = await generateTripsForDriver('driver-1', TEST_DATE)

    const morningTrip = mocks.tables['Trip'].find(t => t.id === result.morningTripId)
    expect(morningTrip?.totalDistanceMeters as number).toBeGreaterThan(10000)
  })

  it("respects the driver's vehicleCapacity when generating stop order", async () => {
    const CHILD_2 = {
      ...CHILD,
      id: 'child-2',
      name: 'Test Child 2',
      parentId: 'parent-2',
      pickupLat: -26.2101,
      pickupLng: 28.0501,
    }
    seed('Child', [CHILD, CHILD_2])
    seed('ChildSchedule', [fullDaySchedule(), fullDaySchedule({ id: 'sched-2', childId: 'child-2' })])
    seed('ScheduleOverride', [])
    seed('Trip', [])
    seed('Driver', [{ id: 'driver-1', vehicleCapacity: 1 }])

    const result = await generateTripsForDriver('driver-1', TEST_DATE)

    const morningStops = mocks.tables['TripStop']
      .filter(s => s.tripId === result.morningTripId)
      .sort((a, b) => (a.stopOrder as number) - (b.stopOrder as number))

    let onboard = 0
    let maxOnboard = 0
    for (const s of morningStops) {
      if (s.type === 'PICKUP') { onboard++; maxOnboard = Math.max(maxOnboard, onboard) }
      else onboard--
    }
    expect(maxOnboard).toBeLessThanOrEqual(1) // vehicleCapacity: 1
    expect(morningStops).toHaveLength(4) // both children still routed, 2 stops each
  })

  it('does not recreate a trip type that already exists for that driver/date', async () => {
    seed('Child', [CHILD])
    seed('ChildSchedule', [fullDaySchedule()])
    seed('ScheduleOverride', [])
    seed('Trip', [{ id: 'existing-morning', driverId: 'driver-1', date: TEST_DATE, type: 'MORNING', status: 'SCHEDULED' }])

    const result = await generateTripsForDriver('driver-1', TEST_DATE)

    expect(result.morningTripId).toBeUndefined()
    expect(result.afternoonTripId).toBeTruthy()
    expect(mocks.tables['Trip']).toHaveLength(2) // the pre-existing one + the new afternoon one
  })

  it('returns no trips when no schedule matches the requested day of week', async () => {
    seed('Child', [CHILD])
    const otherDay = (TEST_DOW + 1) % 7
    seed('ChildSchedule', [fullDaySchedule({ daysOfWeek: [otherDay] })])
    seed('ScheduleOverride', [])
    seed('Trip', [])

    const result = await generateTripsForDriver('driver-1', TEST_DATE)

    expect(result).toEqual({})
    expect(mocks.tables['Trip'] ?? []).toHaveLength(0)
  })

  it('excludes a child with an active SKIP override for the date', async () => {
    seed('Child', [CHILD])
    seed('ChildSchedule', [fullDaySchedule()])
    seed('ScheduleOverride', [{ childId: 'child-1', date: TEST_DATE, action: 'SKIP' }])
    seed('Trip', [])

    const result = await generateTripsForDriver('driver-1', TEST_DATE)

    expect(result).toEqual({})
  })

  it('falls back to naive i*5-minute ordering when fewer than 2 stops have real coordinates', async () => {
    // Dropoff coordinates are (0, 0) — a non-null placeholder, so the child
    // still passes the "routable" check, but optimize.ts's geocoded-stop
    // filter (lat !== 0 && lng !== 0) drops it, leaving only 1 geocoded stop.
    const childWithBadCoords = { ...CHILD, dropoffLat: 0, dropoffLng: 0 }
    seed('Child', [childWithBadCoords])
    seed('ChildSchedule', [fullDaySchedule()])
    seed('ScheduleOverride', [])
    seed('Trip', [])

    const result = await generateTripsForDriver('driver-1', TEST_DATE)

    const morningStops = mocks.tables['TripStop']
      .filter(s => s.tripId === result.morningTripId)
      .sort((a, b) => (a.stopOrder as number) - (b.stopOrder as number))

    expect(morningStops).toHaveLength(2) // fallback keeps both raw stops, including the invalid one
    const times = morningStops.map(s => new Date(s.scheduledTime as string).getTime())
    expect((times[1] - times[0]) / 60000).toBe(5) // i*5 naive spacing, not real ETA math

    const morningTrip = mocks.tables['Trip'].find(t => t.id === result.morningTripId)
    expect(morningTrip?.totalDistanceMeters).toBe(0)
  })
})

describe('generateTripsForAllDrivers', () => {
  it('only processes ACTIVE drivers and sums trips generated across them', async () => {
    seed('Driver', [
      { id: 'driver-1', status: 'ACTIVE' },
      { id: 'driver-2', status: 'INACTIVE' },
    ])
    seed('Child', [CHILD])
    seed('ChildSchedule', [fullDaySchedule()])
    seed('ScheduleOverride', [])
    seed('Trip', [])

    const count = await generateTripsForAllDrivers(TEST_DATE)

    expect(count).toBe(2) // driver-1's morning + afternoon trips; driver-2 never queried for children
  })

  it('continues past a driver whose schedule data throws, still counting others', async () => {
    seed('Driver', [
      { id: 'driver-broken', status: 'ACTIVE' },
      { id: 'driver-1', status: 'ACTIVE' },
    ])
    seed('Child', [
      { ...CHILD, id: 'child-broken', driverId: 'driver-broken' },
      CHILD,
    ])
    seed('ChildSchedule', [
      // Malformed JSON string for daysOfWeek throws inside JSON.parse, which
      // generateTripsForAllDrivers's try/catch must swallow per-driver.
      fullDaySchedule({ id: 'sched-broken', childId: 'child-broken', daysOfWeek: '{not valid json' }),
      fullDaySchedule(),
    ])
    seed('ScheduleOverride', [])
    seed('Trip', [])

    const count = await generateTripsForAllDrivers(TEST_DATE)

    expect(count).toBe(2) // only driver-1's two trips; driver-broken's failure didn't stop the loop
  })
})
