import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { validateAndParseJson } from '@/lib/request-validation'

export async function PATCH(request: Request) {
  try {
    const session = await getSession(request.headers.get('cookie'))
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [body, bodyErr] = await validateAndParseJson(request)
    if (bodyErr) return bodyErr
    const { address, lat, lng } = body as Record<string, unknown>

    if (typeof address !== 'string' || !address.trim()) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 })
    }
    if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
      return NextResponse.json({ error: 'A valid pinned location is required' }, { status: 400 })
    }

    const { data: driver } = await supabase
      .from('Driver')
      .select('id')
      .eq('userId', session.userId)
      .maybeSingle()

    if (!driver) return NextResponse.json({ error: 'Driver profile not found' }, { status: 404 })

    const { error } = await supabase
      .from('Driver')
      .update({
        baseAddress: address.trim(),
        baseLat: lat,
        baseLng: lng,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', driver.id)

    if (error) {
      console.error('[driver/base-location]', error)
      return NextResponse.json({ error: 'Failed to update location' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[driver/base-location]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
