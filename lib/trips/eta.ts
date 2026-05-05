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

interface RemainingStop {
  stopId: string
  lat: number
  lng: number
  stopOrder: number
}

interface EtaResult {
  stopId: string
  estimatedMinutes: number
  estimatedTime: Date
}

/**
 * Recalculate ETAs for remaining stops given current position and time.
 * Assumes 30 km/h average speed with 2 min stop buffer.
 */
export function recalculateETAs(
  remainingStops: RemainingStop[],
  currentPosition: { lat: number; lng: number },
  currentTime: Date,
): EtaResult[] {
  const results: EtaResult[] = []
  let cumulativeMinutes = 0
  let prevLat = currentPosition.lat
  let prevLng = currentPosition.lng

  for (const stop of remainingStops) {
    const dist = haversineDistance(prevLat, prevLng, stop.lat, stop.lng)
    const travelMinutes = (dist / 1000 / 30) * 60
    cumulativeMinutes += travelMinutes + 2

    const eta = new Date(currentTime.getTime() + cumulativeMinutes * 60 * 1000)
    results.push({ stopId: stop.stopId, estimatedMinutes: Math.round(cumulativeMinutes), estimatedTime: eta })

    prevLat = stop.lat
    prevLng = stop.lng
  }

  return results
}
