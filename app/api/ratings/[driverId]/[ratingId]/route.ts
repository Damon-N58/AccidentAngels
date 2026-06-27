import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ driverId: string; ratingId: string }> },
) {
  try {
    const session = await getSession(request.headers.get('cookie'))
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'DRIVER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { driverId, ratingId } = await params

    // Driver must own this driverId
    const { data: ownDriver } = await supabase
      .from('Driver')
      .select('id')
      .eq('userId', session.userId)
      .eq('id', driverId)
      .maybeSingle()

    if (!ownDriver) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    // Enforce that ONLY isHidden may be sent — no score manipulation possible
    const bodyKeys = Object.keys(body)
    if (bodyKeys.length !== 1 || bodyKeys[0] !== 'isHidden') {
      return NextResponse.json({ error: 'Only isHidden may be changed' }, { status: 400 })
    }

    if (typeof body.isHidden !== 'boolean') {
      return NextResponse.json({ error: 'isHidden must be a boolean' }, { status: 400 })
    }

    // Verify the rating row belongs to this driver
    const { data: rating } = await supabase
      .from('DriverRating')
      .select('id')
      .eq('id', ratingId)
      .eq('driverId', driverId)   // prevents cross-driver tampering
      .maybeSingle()

    if (!rating) return NextResponse.json({ error: 'Rating not found' }, { status: 404 })

    // Update ONLY isHidden — score is never touched, so aggregate stays intact
    const { error: updateError } = await supabase
      .from('DriverRating')
      .update({ isHidden: body.isHidden, updatedAt: new Date().toISOString() })
      .eq('id', ratingId)

    if (updateError) throw updateError

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[ratings/driverId/ratingId/patch]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
