import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateTripsForDriver } from '@/lib/trips/generate'

const CRON_SECRET = process.env.CRON_SECRET

/**
 * Maintenance endpoint: wipe SCHEDULED trips in a date range and regenerate
 * them with the current trip-generation logic. Used after changing route /
 * stop-building rules so stale trips don't linger.
 *
 * Auth: Bearer CRON_SECRET.
 * Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD  (inclusive; max 60 days)
 *
 * Only SCHEDULED trips are touched — IN_PROGRESS / COMPLETED are left alone.
 */
export async function GET(request: Request) {
  if (!CRON_SECRET || request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (!from || !to) {
    return NextResponse.json({ error: 'from and to (YYYY-MM-DD) required' }, { status: 400 })
  }

  const dates: string[] = []
  for (let d = new Date(from + 'T00:00:00Z'); d <= new Date(to + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().split('T')[0])
    if (dates.length > 60) return NextResponse.json({ error: 'range too large (max 60 days)' }, { status: 400 })
  }

  const { data: drivers } = await supabase.from('Driver').select('id')
  const driverIds = (drivers ?? []).map(d => d.id)

  let deleted = 0
  let generated = 0
  for (const date of dates) {
    // Delete SCHEDULED trips for this date (TripStop rows cascade)
    const { data: toDelete } = await supabase
      .from('Trip')
      .select('id')
      .eq('date', date)
      .eq('status', 'SCHEDULED')
    const ids = (toDelete ?? []).map(t => t.id)
    if (ids.length > 0) {
      await supabase.from('Trip').delete().in('id', ids)
      deleted += ids.length
    }
    // Regenerate for every driver
    for (const driverId of driverIds) {
      try {
        const r = await generateTripsForDriver(driverId, date)
        if (r.morningTripId) generated++
        if (r.afternoonTripId) generated++
      } catch (err) {
        console.error(`[regenerate] ${driverId} ${date}:`, err)
      }
    }
  }

  return NextResponse.json({ ok: true, dates: dates.length, deleted, generated })
}
