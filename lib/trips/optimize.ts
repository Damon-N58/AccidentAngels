import type { StopToOptimize, OptimizedStop, OptimizationResult } from './types'

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/**
 * Greedy clustering: groups stops within ~1km of each other.
 * Used to detect children going to the same school.
 */
function clusterByProximity(stops: StopToOptimize[], thresholdMeters = 1000): StopToOptimize[][] {
  const clusters: StopToOptimize[][] = []
  const assigned = new Set<string>()

  for (let i = 0; i < stops.length; i++) {
    const key = `${stops[i].childId}:${stops[i].type}`
    if (assigned.has(key)) continue

    const cluster: StopToOptimize[] = [stops[i]]
    assigned.add(key)

    for (let j = i + 1; j < stops.length; j++) {
      const jKey = `${stops[j].childId}:${stops[j].type}`
      if (assigned.has(jKey)) continue

      const dist = haversineDistance(stops[i].lat, stops[i].lng, stops[j].lat, stops[j].lng)
      if (dist < thresholdMeters) {
        cluster.push(stops[j])
        assigned.add(jKey)
      }
    }
    clusters.push(cluster)
  }

  return clusters
}

/**
 * Nearest-neighbor ordering within a group of stops.
 * Assumes avg speed of 30 km/h with 2 min stop buffer.
 */
function nearestNeighbor(stops: StopToOptimize[]): OptimizedOrder[] {
  if (stops.length === 0) return []

  const unvisited = [...stops]
  const result: OptimizedOrder[] = []

  let current = unvisited.shift()!
  let order = 0
  let cumulativeMinutes = 0
  let prevLat = current.lat
  let prevLng = current.lng

  result.push({
    childId: current.childId,
    childName: current.childName,
    type: current.type,
    stopOrder: order++,
    estimatedArrivalMinutes: 0,
    distanceFromPrevMeters: 0,
    address: current.address,
    lat: current.lat,
    lng: current.lng,
    notes: current.notes,
  })

  while (unvisited.length > 0) {
    let nearestIdx = 0
    let nearestDist = haversineDistance(prevLat, prevLng, unvisited[0].lat, unvisited[0].lng)

    for (let i = 1; i < unvisited.length; i++) {
      const dist = haversineDistance(prevLat, prevLng, unvisited[i].lat, unvisited[i].lng)
      if (dist < nearestDist) {
        nearestDist = dist
        nearestIdx = i
      }
    }

    const next = unvisited[nearestIdx]
    unvisited.splice(nearestIdx, 1)

    const travelMinutes = (nearestDist / 1000 / 30) * 60
    cumulativeMinutes += travelMinutes + 2

    result.push({
      childId: next.childId,
      childName: next.childName,
      type: next.type,
      stopOrder: order++,
      estimatedArrivalMinutes: Math.round(cumulativeMinutes),
      distanceFromPrevMeters: Math.round(nearestDist),
      address: next.address,
      lat: next.lat,
      lng: next.lng,
      notes: next.notes,
    })

    prevLat = next.lat
    prevLng = next.lng
  }

  return result
}

interface OptimizedOrder {
  childId: string
  childName: string
  type: 'PICKUP' | 'DROPOFF'
  stopOrder: number
  estimatedArrivalMinutes: number
  distanceFromPrevMeters: number
  address: string
  lat: number
  lng: number
  notes?: string
}

/**
 * Main route optimization function.
 *
 * For MORNING trips:
 *   Phase 1: Pick up all children from home (nearest-neighbor)
 *   Phase 2: Drop off at school clusters (cluster A, then B, etc.)
 *
 * For AFTERNOON trips:
 *   Phase 1: Pick up at school clusters (cluster A, then B)
 *   Phase 2: Drop off children at home (nearest-neighbor)
 */
export function optimizeRoute(
  stops: StopToOptimize[],
  tripType: 'MORNING' | 'AFTERNOON',
): OptimizationResult {
  const pickups = stops.filter(s => s.type === 'PICKUP')
  const dropoffs = stops.filter(s => s.type === 'DROPOFF')

  const orderedStops: OptimizedOrder[] = []

  if (tripType === 'MORNING') {
    const pickupOrder = nearestNeighbor(pickups)
    orderedStops.push(...pickupOrder)

    // Group dropoffs (schools) by proximity, order clusters
    const dropoffClusters = clusterByProximity(dropoffs)
    const lastPickupMinutes = pickupOrder.length > 0
      ? pickupOrder[pickupOrder.length - 1].estimatedArrivalMinutes
      : 0

    let stopOrder = pickupOrder.length
    let cumulativeFromSchool = lastPickupMinutes + 5 // 5 min buffer arriving at school area

    for (const cluster of dropoffClusters) {
      const orderedCluster = nearestNeighbor(cluster)
      for (const stop of orderedCluster) {
        orderedStops.push({
          ...stop,
          stopOrder: stopOrder++,
          estimatedArrivalMinutes: cumulativeFromSchool + stop.estimatedArrivalMinutes + 5,
        })
      }
    }
  } else {
    // AFTERNOON
    const pickupClusters = clusterByProximity(pickups)

    let stopOrder = 0
    let cumulativeMinutes = 0

    for (const cluster of pickupClusters) {
      const orderedCluster = nearestNeighbor(cluster)
      for (const stop of orderedCluster) {
        orderedStops.push({
          ...stop,
          stopOrder: stopOrder++,
          estimatedArrivalMinutes: cumulativeMinutes + stop.estimatedArrivalMinutes,
        })
      }
      cumulativeMinutes = orderedStops.length > 0
        ? orderedStops[orderedStops.length - 1].estimatedArrivalMinutes + 5
        : 0
    }

    // Dropoff phase (home deliveries)
    const dropoffOrder = nearestNeighbor(dropoffs)
    for (const stop of dropoffOrder) {
      orderedStops.push({
        ...stop,
        stopOrder: stopOrder++,
        estimatedArrivalMinutes: cumulativeMinutes + stop.estimatedArrivalMinutes,
      })
    }
  }

  const totalDistance = orderedStops.reduce((sum, s) => sum + s.distanceFromPrevMeters, 0)
  const totalDuration = orderedStops.length > 0
    ? orderedStops[orderedStops.length - 1].estimatedArrivalMinutes * 60
    : 0

  return {
    stops: orderedStops.map((s, i) => ({
      childId: s.childId,
      childName: s.childName,
      type: s.type,
      address: s.address,
      lat: s.lat,
      lng: s.lng,
      stopOrder: i,
      estimatedArrivalMinutes: s.estimatedArrivalMinutes,
      distanceFromPrevMeters: s.distanceFromPrevMeters,
      notes: s.notes,
    })),
    totalDistanceMeters: totalDistance,
    totalDurationSeconds: totalDuration,
  }
}
