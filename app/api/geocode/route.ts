import { NextResponse } from 'next/server'

// Geocoding provider. Defaults to the public Nominatim instance but is
// overridable so production can point at a self-hosted / keyed instance without
// a code change. Nominatim's usage policy REQUIRES a valid identifying
// User-Agent with contact info — a browser cannot set that header, which is why
// geocoding must be proxied server-side rather than called from the client.
const NOMINATIM_URL = process.env.NOMINATIM_URL ?? 'https://nominatim.openstreetmap.org'
const USER_AGENT = process.env.NOMINATIM_USER_AGENT ?? 'AccidentAngels/1.0 (support@accidentangels.co.za)'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '5', 10) || 5, 1), 10)

  if (!q || q.length < 3) return NextResponse.json([])

  const url =
    `${NOMINATIM_URL}/search?format=json&addressdetails=1` +
    `&limit=${limit}&q=${encodeURIComponent(`${q}, South Africa`)}`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return NextResponse.json([])

    const data = await res.json()
    // Return only the fields the client needs.
    const trimmed = (Array.isArray(data) ? data : []).map((r: { display_name: string; lat: string; lon: string }) => ({
      display_name: r.display_name,
      lat: r.lat,
      lon: r.lon,
    }))

    // Geocodes are stable; cache to cut repeat upstream calls (and stay within
    // the provider's rate policy).
    return NextResponse.json(trimmed, {
      headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
    })
  } catch {
    return NextResponse.json([])
  }
}
