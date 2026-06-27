/**
 * lib/drivers/recommend.ts — pure driver-ranking logic (no Supabase imports).
 *
 * Composite score weights:
 *   60 % proximity  (1 − d/dMax; 0 if distance unknown)
 *   40 % rating     ((ratingAvg ?? 3.0) / 5)
 *
 * Eligibility criteria:
 *   - status === 'ACTIVE'
 *   - approvedDocsCount === 6  (all 6 compliance docs approved)
 *   - vehicleCapacity == null || activeChildCount < vehicleCapacity
 */

import { haversineKm } from '../geo'

export interface CandidateDriver {
  id: string
  ratingAvg: number | null
  ratingCount: number
  centroidLat: number | null  // centroid of the driver's pickup stops
  centroidLng: number | null
  vehicleCapacity: number | null
  activeChildCount: number
  approvedDocsCount: number
  status: string
}

export interface RankedDriver extends CandidateDriver {
  distanceKm: number | null
  compositeScore: number
}

/** Returns eligible drivers sorted descending by compositeScore. */
export function rankDrivers(
  candidates: CandidateDriver[],
  parentLat: number | null,
  parentLng: number | null,
): RankedDriver[] {
  // ── 1. Eligibility filter ────────────────────────────────────
  const eligible = candidates.filter(
    (d) =>
      d.status === 'ACTIVE' &&
      d.approvedDocsCount === 6 &&
      (d.vehicleCapacity == null || d.activeChildCount < d.vehicleCapacity),
  )

  if (eligible.length === 0) return []

  // ── 2. Compute distance for each eligible driver ─────────────
  const withDistance: RankedDriver[] = eligible.map((d) => {
    const distanceKm =
      parentLat != null &&
      parentLng != null &&
      d.centroidLat != null &&
      d.centroidLng != null
        ? haversineKm(parentLat, parentLng, d.centroidLat, d.centroidLng)
        : null

    return { ...d, distanceKm, compositeScore: 0 } // score computed below
  })

  // ── 3. Proximity score (normalised across eligible set) ──────
  const knownDistances = withDistance
    .map((d) => d.distanceKm)
    .filter((d): d is number => d !== null)

  const dMax = knownDistances.length > 0 ? Math.max(...knownDistances) : 0

  // ── 4. Composite score ───────────────────────────────────────
  for (const d of withDistance) {
    let proximityScore: number
    if (d.distanceKm === null) {
      // Unknown location — penalise to bottom of proximity dimension
      proximityScore = 0
    } else if (dMax === 0) {
      // All eligible drivers are co-located (or only one driver)
      proximityScore = 1
    } else {
      proximityScore = 1 - d.distanceKm / dMax
    }

    const ratingScore = (d.ratingAvg ?? 3.0) / 5

    d.compositeScore = 0.6 * proximityScore + 0.4 * ratingScore
  }

  // ── 5. Sort descending by composite score ────────────────────
  withDistance.sort((a, b) => b.compositeScore - a.compositeScore)

  return withDistance
}
