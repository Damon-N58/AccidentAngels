const CACHE_TTL = 60 * 60 * 1000 // 1 hour
const MAX_CACHE_SIZE = 1000

interface CacheEntry {
  result: { lat: number; lng: number }
  timestamp: number
}

const cache = new Map<string, CacheEntry>()
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

let lastRequest = 0

function evictIfNeeded() {
  if (cache.size < MAX_CACHE_SIZE) return
  let oldest: string | null = null
  let oldestTime = Infinity
  for (const [key, entry] of cache) {
    if (entry.timestamp < oldestTime) {
      oldestTime = entry.timestamp
      oldest = key
    }
  }
  if (oldest) cache.delete(oldest)
}

function pruneExpired() {
  const cutoff = Date.now() - CACHE_TTL
  for (const [key, entry] of cache) {
    if (entry.timestamp < cutoff) cache.delete(key)
  }
}

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const key = address.toLowerCase().trim()
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.result

  // Rate limit: 1 request per second
  const now = Date.now()
  const elapsed = now - lastRequest
  if (elapsed < 1100) {
    await new Promise(r => setTimeout(r, 1100 - elapsed))
  }
  lastRequest = Date.now()

  try {
    const url = new URL(NOMINATIM_URL)
    url.searchParams.set('q', `${address}, South Africa`)
    url.searchParams.set('format', 'json')
    url.searchParams.set('limit', '1')

    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'AccidentAngels/1.0 (scholar-transport)',
        'Accept': 'application/json',
      },
    })

    if (!res.ok) return null

    const data = await res.json() as Array<{ lat: string; lon: string }>
    if (!data.length) return null

    const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    evictIfNeeded()
    cache.set(key, { result, timestamp: Date.now() })
    return result
  } catch {
    return null
  }
}
