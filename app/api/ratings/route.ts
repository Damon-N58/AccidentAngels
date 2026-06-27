import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const session = await getSession(request.headers.get('cookie'))
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'PARENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { driverId, score, comment } = body

    if (!driverId) {
      return NextResponse.json({ error: 'driverId is required' }, { status: 400 })
    }

    // Score must be an integer 1–5
    if (
      score == null ||
      !Number.isInteger(score) ||
      score < 1 ||
      score > 5
    ) {
      return NextResponse.json({ error: 'score must be an integer between 1 and 5' }, { status: 400 })
    }

    // Comment, if present, must be a string within a sane length
    if (comment != null && (typeof comment !== 'string' || comment.length > 1000)) {
      return NextResponse.json({ error: 'comment must be a string up to 1000 characters' }, { status: 400 })
    }

    // Resolve parent record from session
    const { data: parent } = await supabase
      .from('Parent')
      .select('id')
      .eq('userId', session.userId)
      .maybeSingle()

    if (!parent) return NextResponse.json({ error: 'Parent profile not found' }, { status: 404 })

    // Eligibility: parent must have a child currently assigned to this driver
    const { data: linkedChild } = await supabase
      .from('Child')
      .select('id')
      .eq('parentId', parent.id)
      .eq('driverId', driverId)
      .limit(1)
      .maybeSingle()

    if (!linkedChild) {
      return NextResponse.json(
        { error: 'You can only rate a driver assigned to your child' },
        { status: 403 },
      )
    }

    // One rating per (driver, parent). Read-then-branch so a re-rating UPDATEs the
    // existing row and PRESERVES isHidden (a blind upsert would reset it to the
    // column default, re-exposing a comment the driver had hidden).
    const { data: existing } = await supabase
      .from('DriverRating')
      .select('id')
      .eq('driverId', driverId)
      .eq('parentId', parent.id)
      .maybeSingle()

    if (existing) {
      const { error: updErr } = await supabase
        .from('DriverRating')
        .update({ score, comment: comment ?? null, updatedAt: new Date().toISOString() })
        .eq('id', existing.id)
      if (updErr) throw updErr
    } else {
      const { error: insErr } = await supabase
        .from('DriverRating')
        .insert({ driverId, parentId: parent.id, score, comment: comment ?? null })
      if (insErr) throw insErr
    }

    // Recompute aggregate from all ratings for this driver
    const { data: allRatings, error: aggError } = await supabase
      .from('DriverRating')
      .select('score')
      .eq('driverId', driverId)

    if (aggError) throw aggError

    const rows = allRatings ?? []
    const ratingCount = rows.length
    const ratingAvg =
      ratingCount > 0
        ? rows.reduce((sum, r) => sum + r.score, 0) / ratingCount
        : null

    const { error: updateError } = await supabase
      .from('Driver')
      .update({ ratingAvg, ratingCount })
      .eq('id', driverId)

    if (updateError) throw updateError

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[ratings/post]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
