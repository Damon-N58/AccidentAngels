import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ driverId: string }> },
) {
  try {
    const session = await getSession(request.headers.get('cookie'))
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { driverId } = await params

    // Fetch the Driver row for ratingAvg and ratingCount
    const { data: driver, error: driverError } = await supabase
      .from('Driver')
      .select('id, ratingAvg, ratingCount')
      .eq('id', driverId)
      .maybeSingle()

    if (driverError) throw driverError
    if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })

    if (session.role === 'DRIVER') {
      // Driver must own this driverId
      const { data: ownDriver } = await supabase
        .from('Driver')
        .select('id')
        .eq('userId', session.userId)
        .eq('id', driverId)
        .maybeSingle()

      if (!ownDriver) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

      // Return all ratings for this driver — never expose parentId or parent name.
      // The driver sees their OWN comments in full (including ones they've hidden
      // from parents) so they can manage visibility; isHidden marks what parents can't see.
      const { data: ratings, error: ratingsError } = await supabase
        .from('DriverRating')
        .select('id, score, comment, isHidden, createdAt')
        .eq('driverId', driverId)
        .order('createdAt', { ascending: false })

      if (ratingsError) throw ratingsError

      return NextResponse.json({
        ratingAvg: driver.ratingAvg ?? null,
        ratingCount: driver.ratingCount ?? 0,
        ratings: (ratings ?? []).map((r: any) => ({
          id: r.id,
          score: r.score,
          comment: r.comment,
          isHidden: r.isHidden,
          createdAt: r.createdAt,
        })),
      })
    }

    if (session.role === 'PARENT') {
      // Resolve parent; return only this parent's own rating — no other parents' data exposed
      const { data: parent } = await supabase
        .from('Parent')
        .select('id')
        .eq('userId', session.userId)
        .maybeSingle()

      if (!parent) return NextResponse.json({ error: 'Parent profile not found' }, { status: 404 })

      const { data: myRatingRow, error: myRatingError } = await supabase
        .from('DriverRating')
        .select('score, comment, isHidden')
        .eq('driverId', driverId)
        .eq('parentId', parent.id)   // scoped to THIS parent only
        .maybeSingle()

      if (myRatingError) throw myRatingError

      return NextResponse.json({
        ratingAvg: driver.ratingAvg ?? null,
        ratingCount: driver.ratingCount ?? 0,
        myRating: myRatingRow
          ? {
              score: myRatingRow.score,
              comment: myRatingRow.comment,
              isHidden: myRatingRow.isHidden,
            }
          : null,
      })
    }

    if (session.role === 'ADMIN') {
      // Admins see aggregate only — no comments in Phase 1
      return NextResponse.json({
        ratingAvg: driver.ratingAvg ?? null,
        ratingCount: driver.ratingCount ?? 0,
      })
    }

    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  } catch (err) {
    console.error('[ratings/driverId/get]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
