import { NextResponse } from 'next/server'
import { generateTripsForAllDrivers } from '@/lib/trips/generate'

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(request: Request) {
  if (!CRON_SECRET || request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dateStr = tomorrow.toISOString().split('T')[0]

  const generated = await generateTripsForAllDrivers(dateStr)
  return NextResponse.json({ ok: true, generated, date: dateStr })
}
