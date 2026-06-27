import { describe, it, expect } from 'vitest'
import { rankDrivers } from '../recommend'
import type { CandidateDriver } from '../recommend'

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Fully-eligible base driver; override fields as needed per test. */
function makeDriver(overrides: Partial<CandidateDriver> & { id: string }): CandidateDriver {
  return {
    ratingAvg: null,
    ratingCount: 0,
    centroidLat: null,
    centroidLng: null,
    vehicleCapacity: 8,
    activeChildCount: 0,
    approvedDocsCount: 6,
    status: 'ACTIVE',
    ...overrides,
  }
}

// Johannesburg CBD as the parent location reference
const PARENT_LAT = -26.2041
const PARENT_LNG = 28.0473

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('rankDrivers', () => {
  // ── Empty / single input ──────────────────────────────────────────────────

  it('returns [] for empty candidates', () => {
    expect(rankDrivers([], PARENT_LAT, PARENT_LNG)).toEqual([])
  })

  it('single eligible driver — no division-by-zero error', () => {
    const d = makeDriver({ id: 'd1', centroidLat: -26.2041, centroidLng: 28.0473, ratingAvg: 4 })
    const result = rankDrivers([d], PARENT_LAT, PARENT_LNG)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('d1')
    // distanceKm = 0 → dMax = 0 → proximityScore = 1
    expect(result[0].compositeScore).toBeCloseTo(0.6 * 1 + 0.4 * (4 / 5))
  })

  // ── Eligibility filtering ─────────────────────────────────────────────────

  it('excludes driver with status !== ACTIVE', () => {
    const ineligible = makeDriver({ id: 'suspended', status: 'SUSPENDED' })
    const eligible = makeDriver({ id: 'active' })
    const result = rankDrivers([ineligible, eligible], PARENT_LAT, PARENT_LNG)
    expect(result.map((d) => d.id)).toEqual(['active'])
  })

  it('excludes driver with approvedDocsCount !== 6', () => {
    const incomplete = makeDriver({ id: 'incomplete', approvedDocsCount: 5 })
    const complete = makeDriver({ id: 'complete' })
    const result = rankDrivers([incomplete, complete], PARENT_LAT, PARENT_LNG)
    expect(result.map((d) => d.id)).toEqual(['complete'])
  })

  it('excludes driver at vehicle capacity', () => {
    const full = makeDriver({ id: 'full', vehicleCapacity: 4, activeChildCount: 4 })
    const open = makeDriver({ id: 'open', vehicleCapacity: 4, activeChildCount: 3 })
    const result = rankDrivers([full, open], PARENT_LAT, PARENT_LNG)
    expect(result.map((d) => d.id)).toEqual(['open'])
  })

  it('includes driver with null vehicleCapacity (unlimited)', () => {
    const unlimited = makeDriver({ id: 'unlimited', vehicleCapacity: null, activeChildCount: 100 })
    const result = rankDrivers([unlimited], PARENT_LAT, PARENT_LNG)
    expect(result).toHaveLength(1)
  })

  it('returns [] when all candidates are ineligible', () => {
    const d = makeDriver({ id: 'd1', status: 'INACTIVE' })
    expect(rankDrivers([d], PARENT_LAT, PARENT_LNG)).toEqual([])
  })

  // ── Proximity outranks rating ─────────────────────────────────────────────

  it('closer driver outranks higher-rated farther driver', () => {
    // closerDriver is 1 km away; fartherDriver is 50 km away but has a 5-star rating
    const closer = makeDriver({
      id: 'closer',
      ratingAvg: 3,
      // ~1 km north of PARENT
      centroidLat: -26.1950,
      centroidLng: 28.0473,
    })
    const farther = makeDriver({
      id: 'farther',
      ratingAvg: 5,
      // Pretoria CBD, ~55 km north
      centroidLat: -25.7479,
      centroidLng: 28.2293,
    })
    const result = rankDrivers([closer, farther], PARENT_LAT, PARENT_LNG)
    expect(result[0].id).toBe('closer')
    expect(result[1].id).toBe('farther')
  })

  // ── Unknown distance ranks last ───────────────────────────────────────────

  it('null-distance driver ranks last among drivers with known distances', () => {
    // Use three drivers so that the two with known distances can spread their
    // proximity scores (0..1), while the null-distance driver is locked at 0.
    // The driver closest to the parent gets proximityScore=1, the next gets a
    // mid value; the null-distance driver can only compete on rating.
    // Give the null-distance driver a 5-star rating to make it a meaningful test:
    // even 5 stars (0.4 * 1.0 = 0.40) should lose to the nearest known-distance
    // driver (0.6 * 1 + 0.4 * (3/5) = 0.84).
    const near  = makeDriver({ id: 'near',  ratingAvg: 3, centroidLat: -26.2041, centroidLng: 28.0473 }) // at parent loc
    const far   = makeDriver({ id: 'far',   ratingAvg: 3, centroidLat: -25.7479, centroidLng: 28.2293 }) // ~55 km away
    const noPos = makeDriver({ id: 'noPos', ratingAvg: 5 }) // centroid null → proximityScore = 0
    const result = rankDrivers([noPos, far, near], PARENT_LAT, PARENT_LNG)
    // 'near' has proximityScore=1 → compositeScore=0.6*1+0.4*(3/5)=0.84 → ranks first
    // 'noPos' has proximityScore=0 → compositeScore=0+0.4*(5/5)=0.40
    // 'far'   has proximityScore=0 (dMax=near's distance, near distance=0 so dMax of far=far dist, near prox=1, far prox=0)
    // Actually: dMax = dist(near) vs dist(far). near is at parent so dist≈0, far≈55km. dMax=55km.
    // near: prox = 1 - 0/55 = 1. far: prox = 1 - 55/55 = 0. noPos: prox = 0.
    // near: 0.6*1 + 0.4*0.6 = 0.84.  far: 0.6*0 + 0.4*0.6 = 0.24.  noPos: 0 + 0.4*1 = 0.40
    expect(result[0].id).toBe('near')
    expect(result[1].id).toBe('noPos') // higher rating than 'far' wins the tie-break
    expect(result[2].id).toBe('far')
  })

  // ── Unrated driver uses neutral 3.0 ──────────────────────────────────────

  it('unrated driver (ratingAvg null) uses neutral 3.0 and is included', () => {
    const unrated = makeDriver({ id: 'unrated', ratingAvg: null })
    const rated = makeDriver({ id: 'rated', ratingAvg: 3.0 }) // same effective score
    const result = rankDrivers([unrated, rated], null, null) // no parent location
    // Both should be included; proximityScore = 0 for both; rating scores identical
    expect(result).toHaveLength(2)
    const ids = result.map((d) => d.id)
    expect(ids).toContain('unrated')
    expect(ids).toContain('rated')
  })

  // ── All-equal distance → rank by rating ──────────────────────────────────

  it('all same distance → ranked by rating score', () => {
    // Place all drivers at the same coords → dMax = 0 → proximityScore = 1 for all
    const sameCoords = { centroidLat: -26.2041, centroidLng: 28.0473 }
    const d1 = makeDriver({ id: 'd1', ratingAvg: 2, ...sameCoords })
    const d2 = makeDriver({ id: 'd2', ratingAvg: 5, ...sameCoords })
    const d3 = makeDriver({ id: 'd3', ratingAvg: 4, ...sameCoords })
    const result = rankDrivers([d1, d2, d3], PARENT_LAT, PARENT_LNG)
    expect(result.map((d) => d.id)).toEqual(['d2', 'd3', 'd1'])
  })

  // ── Parent location null → proximity 0 for all, rank by rating ───────────

  it('parent location null → proximityScore 0 for all → rank by rating only', () => {
    const low = makeDriver({ id: 'low', ratingAvg: 2, centroidLat: -26.2, centroidLng: 28.0 })
    const high = makeDriver({ id: 'high', ratingAvg: 5, centroidLat: -25.7, centroidLng: 28.2 })
    const result = rankDrivers([low, high], null, null)
    // All distanceKm = null → proximityScore = 0 for all → winner is higher rating
    expect(result[0].id).toBe('high')
    expect(result[1].id).toBe('low')
    // compositeScore = 0.6*0 + 0.4*(rating/5)
    expect(result[0].compositeScore).toBeCloseTo(0.4 * (5 / 5))
    expect(result[1].compositeScore).toBeCloseTo(0.4 * (2 / 5))
  })

  // ── RankedDriver shape ────────────────────────────────────────────────────

  it('returned objects include distanceKm and compositeScore fields', () => {
    const d = makeDriver({ id: 'd1', centroidLat: -26.2, centroidLng: 28.0, ratingAvg: 4 })
    const result = rankDrivers([d], PARENT_LAT, PARENT_LNG)
    expect(result[0]).toHaveProperty('distanceKm')
    expect(result[0]).toHaveProperty('compositeScore')
    expect(typeof result[0].distanceKm).toBe('number')
  })
})
