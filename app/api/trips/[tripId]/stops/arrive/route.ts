import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { sendSms, smsTemplates } from '@/lib/sms/africas-talking'
import { validateAndParseJson } from '@/lib/request-validation'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  try {
    const session = await getSession(request.headers.get('cookie'))
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (session.role !== 'DRIVER') {
      return NextResponse.json({ error: 'Only drivers can mark arrival' }, { status: 403 })
    }

    const { tripId } = await params
    const [rawBody, bodyErr] = await validateAndParseJson(request)
    if (bodyErr) return bodyErr
    const body = rawBody as Record<string, any>

    if (!body.stopId) {
      return NextResponse.json({ error: 'stopId is required' }, { status: 400 })
    }

    // Verify driver exists and owns this trip (mirrors stops/route.ts pattern)
    const { data: driver } = await supabase
      .from('Driver').select('id, userId').eq('userId', session.userId).maybeSingle()
    if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })

    const { data: trip } = await supabase
      .from('Trip').select('id, driverId, status').eq('id', tripId).maybeSingle()
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
    if (trip.driverId !== driver.id) {
      return NextResponse.json({ error: 'You do not own this trip' }, { status: 403 })
    }

    // Fetch the stop (must belong to this trip)
    const { data: stop } = await supabase
      .from('TripStop')
      .select('id, tripId, status, arrivedAt, childId')
      .eq('id', body.stopId)
      .eq('tripId', tripId)
      .maybeSingle()
    if (!stop) return NextResponse.json({ error: 'Stop not found' }, { status: 404 })

    // Idempotency: already arrived → return without re-notifying
    if (stop.arrivedAt) {
      return NextResponse.json({ alreadyArrived: true, arrivedAt: stop.arrivedAt })
    }

    // Guard: can only arrive at a pending stop
    if (stop.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Cannot arrive at a completed or missed stop' },
        { status: 400 },
      )
    }

    const arrivedAt = new Date().toISOString()

    // Stamp arrivedAt on the stop
    const { error: updateErr } = await supabase
      .from('TripStop')
      .update({ arrivedAt })
      .eq('id', stop.id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // Resolve child → parent → user for notification + SMS
    const { data: child } = await supabase
      .from('Child')
      .select('id, name, parentId')
      .eq('id', stop.childId)
      .maybeSingle()

    // Resolve driver name via their User record
    const { data: driverUser } = await supabase
      .from('User')
      .select('id, name')
      .eq('id', driver.userId)
      .maybeSingle()
    const driverName = driverUser?.name ?? 'Your driver'

    if (child) {
      // Resolve parent user
      const { data: parent } = await supabase
        .from('Parent')
        .select('id, userId')
        .eq('id', child.parentId)
        .maybeSingle()

      if (parent) {
        const { data: parentUser } = await supabase
          .from('User')
          .select('id, phone')
          .eq('id', parent.userId)
          .maybeSingle()

        if (parentUser) {
          // In-app notification (Notification.id has a DB default — no id field, matches check-expiry pattern)
          try {
            await supabase.from('Notification').insert({
              userId:   parentUser.id,
              type:     'DRIVER_ARRIVED',
              title:    'Your driver has arrived',
              body:     smsTemplates.driverArrived(driverName, child.name),
              metadata: { tripId, stopId: stop.id, driverId: driver.id, childId: child.id },
              isRead:   false,
            })
          } catch (notifErr) {
            console.error('[stops/arrive] Notification insert failed:', notifErr)
          }

          // SMS — non-fatal
          try {
            await sendSms(parentUser.phone, smsTemplates.driverArrived(driverName, child.name))
          } catch (smsErr) {
            console.error('[stops/arrive] SMS failed:', smsErr)
          }
        }
      }
    }

    return NextResponse.json({ ok: true, arrivedAt })
  } catch (err) {
    console.error('[stops/arrive]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
