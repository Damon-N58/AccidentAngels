import { describe, it, expect } from 'vitest'
import { haversineKm, haversineMeters, centroidOf } from '../geo'

describe('haversineMeters', () => {
  it('same point → 0 m', () => {
    expect(haversineMeters(-26.2041, 28.0473, -26.2041, 28.0473)).toBe(0)
  })
})

describe('haversineKm', () => {
  // Johannesburg CBD ↔ Pretoria CBD — known airline distance ~55 km
  it('JHB ↔ PTA is approximately 50–60 km', () => {
    const km = haversineKm(-26.2041, 28.0473, -25.7479, 28.2293)
    expect(km).toBeGreaterThan(50)
    expect(km).toBeLessThan(60)
  })

  it('symmetric: A→B equals B→A', () => {
    const ab = haversineKm(-26.2041, 28.0473, -25.7479, 28.2293)
    const ba = haversineKm(-25.7479, 28.2293, -26.2041, 28.0473)
    expect(ab).toBeCloseTo(ba, 6)
  })
})

describe('centroidOf', () => {
  it('returns null for an empty array', () => {
    expect(centroidOf([])).toBeNull()
  })

  it('centroid of a single point is the point itself', () => {
    const result = centroidOf([{ lat: -26.2, lng: 28.05 }])
    expect(result).toEqual({ lat: -26.2, lng: 28.05 })
  })

  it('centroid of two symmetric points is their midpoint', () => {
    const result = centroidOf([
      { lat: -26.0, lng: 28.0 },
      { lat: -27.0, lng: 29.0 },
    ])
    expect(result).not.toBeNull()
    expect(result!.lat).toBeCloseTo(-26.5)
    expect(result!.lng).toBeCloseTo(28.5)
  })

  it('centroid of three points', () => {
    const result = centroidOf([
      { lat: 0, lng: 0 },
      { lat: 3, lng: 3 },
      { lat: 6, lng: 6 },
    ])
    expect(result).not.toBeNull()
    expect(result!.lat).toBeCloseTo(3)
    expect(result!.lng).toBeCloseTo(3)
  })
})
