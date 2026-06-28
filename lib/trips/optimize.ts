import type { StopToOptimize, OptimizedStop, OptimizationResult } from './types'

const AVG_SPEED_KMH = 30
const STOP_BUFFER_MIN = 2
const SCHOOL_CLUSTER_METERS = 1000

interface Pt { lat: number; lng: number }

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function distBetween(a: Pt, b: Pt): number {
  return haversineDistance(a.lat, a.lng, b.lat, b.lng)
}

function centroid(pts: Pt[]): Pt {
  const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length
  const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length
  return { lat, lng }
}

/** Order items by nearest-neighbor, starting from `from`. Pure — does not mutate input. */
function nearestNeighborOrder<T extends Pt>(items: T[], from: Pt): T[] {
  const remaining = [...items]
  const ordered: T[] = []
  let cur: Pt = from
  while (remaining.length > 0) {
    let bestIdx = 0
    let bestDist = Infinity
    for (let i = 0; i < remaining.length; i++) {
      const d = distBetween(cur, remaining[i])
      if (d < bestDist) { bestDist = d; bestIdx = i }
    }
    const next = remaining.splice(bestIdx, 1)[0]
    ordered.push(next)
    cur = next
  }
  return ordered
}

interface ChildLegs { pickup: StopToOptimize; dropoff: StopToOptimize }

/**
 * Route optimization using per-school "milk runs".
 *
 * Children are grouped by the school they share (proximity-clustered). School
 * clusters are visited in nearest-neighbor order. This avoids the cross-city
 * backtracking that occurs when you do ALL home pickups before ANY school
 * dropoff — which is wrong when children attend different, far-apart schools.
 *
 * MORNING   per school cluster:  pick up homes (nearest-neighbor) → drop at school
 * AFTERNOON per school cluster:  collect at school → drop homes (nearest-neighbor)
 *
 * @param start optional driver start location (e.g. live GPS). When omitted,
 *              the route begins at the first stop it would naturally reach.
 */
export function optimizeRoute(
  stops: StopToOptimize[],
  tripType: 'MORNING' | 'AFTERNOON',
  start?: Pt,
): OptimizationResult {
  // Pair stops into per-child legs (each child has one PICKUP and one DROPOFF)
  const byChild = new Map<string, Partial<ChildLegs>>()
  for (const s of stops) {
    const entry = byChild.get(s.childId) ?? {}
    if (s.type === 'PICKUP') entry.pickup = s
    else entry.dropoff = s
    byChild.set(s.childId, entry)
  }
  const children = [...byChild.values()].filter(
    (c): c is ChildLegs => !!c.pickup && !!c.dropoff,
  )

  // School = where children converge: dropoff in the morning, pickup in the afternoon.
  const schoolOf = (c: ChildLegs) => (tripType === 'MORNING' ? c.dropoff : c.pickup)
  const homeOf = (c: ChildLegs) => (tripType === 'MORNING' ? c.pickup : c.dropoff)

  // Group children whose schools are within SCHOOL_CLUSTER_METERS of each other.
  const clusters: ChildLegs[][] = []
  const assigned = new Set<number>()
  for (let i = 0; i < children.length; i++) {
    if (assigned.has(i)) continue
    const group = [children[i]]
    assigned.add(i)
    const s0 = schoolOf(children[i])
    for (let j = i + 1; j < children.length; j++) {
      if (assigned.has(j)) continue
      if (distBetween(s0, schoolOf(children[j])) < SCHOOL_CLUSTER_METERS) {
        group.push(children[j])
        assigned.add(j)
      }
    }
    clusters.push(group)
  }

  // Visit school clusters in nearest-neighbor order (by school centroid).
  const clusterInfos = clusters.map(g => ({ group: g, school: centroid(g.map(schoolOf)) }))
  const orderedClusters: ChildLegs[][] = []
  {
    const remaining = [...clusterInfos]
    let cur: Pt = start ?? (remaining[0]?.school ?? { lat: 0, lng: 0 })
    while (remaining.length > 0) {
      let bestIdx = 0
      let bestDist = Infinity
      for (let i = 0; i < remaining.length; i++) {
        const d = distBetween(cur, remaining[i].school)
        if (d < bestDist) { bestDist = d; bestIdx = i }
      }
      const picked = remaining.splice(bestIdx, 1)[0]
      orderedClusters.push(picked.group)
      cur = picked.school
    }
  }

  // Build the ordered stop sequence.
  const sequence: StopToOptimize[] = []
  let cursor: Pt | null = start ?? null
  for (const group of orderedClusters) {
    if (tripType === 'MORNING') {
      const homes = group.map(homeOf)
      for (const h of nearestNeighborOrder(homes, cursor ?? homes[0])) {
        sequence.push(h); cursor = h
      }
      const schools = group.map(schoolOf)
      for (const s of nearestNeighborOrder(schools, cursor ?? schools[0])) {
        sequence.push(s); cursor = s
      }
    } else {
      const schools = group.map(schoolOf)
      for (const s of nearestNeighborOrder(schools, cursor ?? schools[0])) {
        sequence.push(s); cursor = s
      }
      const homes = group.map(homeOf)
      for (const h of nearestNeighborOrder(homes, cursor ?? homes[0])) {
        sequence.push(h); cursor = h
      }
    }
  }

  // Compute cumulative distance + ETA across the whole sequence.
  const result: OptimizedStop[] = []
  let prev: Pt | null = start ?? null
  let cumulativeMin = 0
  let totalDist = 0
  sequence.forEach((s, i) => {
    let dist = 0
    if (prev) {
      dist = distBetween(prev, s)
      cumulativeMin += (dist / 1000 / AVG_SPEED_KMH) * 60 + STOP_BUFFER_MIN
    }
    totalDist += dist
    result.push({
      childId: s.childId,
      childName: s.childName,
      type: s.type,
      address: s.address,
      lat: s.lat,
      lng: s.lng,
      stopOrder: i,
      estimatedArrivalMinutes: Math.round(cumulativeMin),
      distanceFromPrevMeters: Math.round(dist),
      notes: s.notes,
    })
    prev = s
  })

  return {
    stops: result,
    totalDistanceMeters: Math.round(totalDist),
    totalDurationSeconds: Math.round(cumulativeMin * 60),
  }
}
