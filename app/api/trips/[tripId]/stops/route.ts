import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { recalculateETAs } from '@/lib/trips/eta'
import { validateAndParseJson } from '@/lib/request-validation'
import { calcWaitingCharge } from '@/lib/trips/waiting-charge'
import { toUtcDate } from '@/lib/dates'
import { isPaymentsLive } from '@/lib/config'
import { sendSms, smsTemplates } from '@/lib/sms/africas-talking'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const session = await getSession(request.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (session.role !== 'DRIVER') {
    return NextResponse.json({ error: 'Only drivers can update stops' }, { status: 403 })
  }

  const { tripId } = await params
  const [rawBody, bodyErr] = await validateAndParseJson(request)
  if (bodyErr) return bodyErr
  const body = rawBody as Record<string, any>

  if (!body.stopId || !body.status) {
    return NextResponse.json({ error: 'stopId and status are required' }, { status: 400 })
  }

  if (!['COMPLETED', 'MISSED'].includes(body.status)) {
    return NextResponse.json({ error: 'status must be COMPLETED or MISSED' }, { status: 400 })
  }

  const { data: driver } = await supabase
    .from('Driver').select('id').eq('userId', session.userId).maybeSingle()
  if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })

  // Verify driver owns this trip
  const { data: trip } = await supabase
    .from('Trip').select('id, driverId, status').eq('id', tripId).maybeSingle()
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  if (trip.driverId !== driver.id) {
    return NextResponse.json({ error: 'You do not own this trip' }, { status: 403 })
  }

  const now = new Date().toISOString()

  // Fetch the stop first so we have arrivedAt for waiting-charge calculation
  const { data: stopBefore } = await supabase
    .from('TripStop')
    .select('id, childId, arrivedAt, status')
    .eq('id', body.stopId)
    .eq('tripId', tripId)
    .maybeSingle()

  if (!stopBefore) {
    return NextResponse.json({ error: 'Stop not found' }, { status: 404 })
  }
  // Idempotency: a finalised stop cannot be completed/missed again (prevents double-charge + double-notify)
  if (stopBefore.status === 'COMPLETED' || stopBefore.status === 'MISSED') {
    return NextResponse.json({ error: 'Stop already finalised', status: stopBefore.status }, { status: 409 })
  }

  // Compute waiting charge when completing a stop
  let waitingChargeCents = 0
  let waitingChargeResult: ReturnType<typeof calcWaitingCharge> | null = null
  if (body.status === 'COMPLETED' && stopBefore?.arrivedAt) {
    // arrivedAt comes from a TIMESTAMP(3) column (no tz) — parse as UTC, not local.
    waitingChargeResult = calcWaitingCharge(toUtcDate(stopBefore.arrivedAt), new Date(now))
    waitingChargeCents = waitingChargeResult.chargeCents
  }

  const updateFields: Record<string, any> = {
    status: body.status,
    actualTime: now,
    completedAt: now,
    waitingChargeCents, // always stamp (0 if no arrivedAt or within grace)
  }
  if (body.status === 'MISSED' && body.missedReason) {
    updateFields.missedReason = body.missedReason
  }
  if (body.lat != null && body.lng != null) {
    updateFields.lat = body.lat
    updateFields.lng = body.lng
  }

  const { error: stopError } = await supabase
    .from('TripStop')
    .update(updateFields)
    .eq('id', body.stopId)
    .eq('tripId', tripId)

  if (stopError) {
    return NextResponse.json({ error: stopError.message }, { status: 500 })
  }

  // --- Secondary effects (charge accrual + parent notifications) ---
  // The primary stop update above is already committed; these must never 500 the request.
  try {
  // --- TASK 2: Waiting charge on COMPLETED stop ---
  if (body.status === 'COMPLETED' && waitingChargeResult && waitingChargeResult.chargeCents > 0 && stopBefore?.arrivedAt) {
    // Resolve child → parent + driver ids for WaitingCharge row
    const { data: wChild } = await supabase
      .from('Child')
      .select('id, name, parentId, driverId')
      .eq('id', stopBefore.childId)
      .maybeSingle()

    if (wChild) {
      const live = await isPaymentsLive()

      // Upsert WaitingCharge — UNIQUE on tripStopId prevents duplicates
      await supabase.from('WaitingCharge').upsert(
        {
          tripStopId:     body.stopId,
          tripId,
          childId:        wChild.id,
          parentId:       wChild.parentId,
          driverId:       wChild.driverId ?? driver.id,
          arrivedAt:      stopBefore.arrivedAt,
          completedAt:    now,
          waitingSeconds: waitingChargeResult.waitingSeconds,
          graceSeconds:   180,
          billableMinutes: waitingChargeResult.billableMinutes,
          chargeCents:    waitingChargeResult.chargeCents,
          isLive:         live,
        },
        { onConflict: 'tripStopId' },
      )

      if (live) {
        // Resolve parent's user for notification + SMS
        const { data: wParent } = await supabase
          .from('Parent')
          .select('userId')
          .eq('id', wChild.parentId)
          .maybeSingle()

        if (wParent) {
          const { data: wParentUser } = await supabase
            .from('User')
            .select('id, phone')
            .eq('id', wParent.userId)
            .maybeSingle()

          if (wParentUser) {
            const amountRand = (waitingChargeResult.chargeCents / 100).toFixed(2)
            const chargeBody = smsTemplates.waitingChargeAccrued(
              wChild.name,
              waitingChargeResult.billableMinutes,
              amountRand,
            )

            try {
              await supabase.from('Notification').insert({
                userId:   wParentUser.id,
                type:     'WAITING_CHARGE_ACCRUED',
                title:    'Waiting charge recorded',
                body:     chargeBody,
                metadata: { tripId, stopId: body.stopId, chargeCents: waitingChargeResult.chargeCents, billableMinutes: waitingChargeResult.billableMinutes },
                isRead:   false,
              })
            } catch (notifErr) {
              console.error('[stops/patch] Waiting charge notification failed:', notifErr)
            }

            try {
              await sendSms(wParentUser.phone, chargeBody)
            } catch (smsErr) {
              console.error('[stops/patch] Waiting charge SMS failed:', smsErr)
            }
          }
        }
      }
    }
  }

  // --- TASK 3: Notify parent on MISSED stop ---
  if (body.status === 'MISSED' && stopBefore) {
    const { data: mChild } = await supabase
      .from('Child')
      .select('id, name, parentId')
      .eq('id', stopBefore.childId)
      .maybeSingle()

    if (mChild) {
      const { data: mParent } = await supabase
        .from('Parent')
        .select('userId')
        .eq('id', mChild.parentId)
        .maybeSingle()

      if (mParent) {
        const { data: mParentUser } = await supabase
          .from('User')
          .select('id, phone')
          .eq('id', mParent.userId)
          .maybeSingle()

        if (mParentUser) {
          const missedReason = body.missedReason ?? 'Not specified'
          const missedBody = smsTemplates.stopMissed(mChild.name, missedReason)

          try {
            await supabase.from('Notification').insert({
              userId:   mParentUser.id,
              type:     'STOP_MISSED',
              title:    'Child not collected',
              body:     missedBody,
              metadata: { tripId, stopId: body.stopId },
              isRead:   false,
            })
          } catch (notifErr) {
            console.error('[stops/patch] Missed-stop notification failed:', notifErr)
          }

          try {
            await sendSms(mParentUser.phone, missedBody)
          } catch (smsErr) {
            console.error('[stops/patch] Missed-stop SMS failed:', smsErr)
          }
        }
      }
    }
  }
  } catch (sideErr) {
    console.error('[stops/patch] secondary effect failed (stop update already committed):', sideErr)
  }

  // Check if all stops are done and auto-complete trip
  const { data: remaining } = await supabase
    .from('TripStop')
    .select('id, status, lat, lng, stopOrder, address, childId, type, estimatedTime, scheduledTime')
    .eq('tripId', tripId)
    .order('stopOrder', { ascending: true })

  const pendingStops = remaining?.filter(s => s.status === 'PENDING') ?? []
  let tripCompleted = false

  if (pendingStops.length === 0) {
    await supabase
      .from('Trip')
      .update({ status: 'COMPLETED', driverEndedAt: now })
      .eq('id', tripId)
    tripCompleted = true
  } else {
    // Recalculate ETAs for remaining stops
    const currentPosition = body.lat != null && body.lng != null
      ? { lat: body.lat, lng: body.lng }
      : { lat: pendingStops[0]?.lat ?? 0, lng: pendingStops[0]?.lng ?? 0 }

    const remainingWithCurrent = pendingStops.map(s => ({
      stopId: s.id,
      lat: s.lat ?? 0,
      lng: s.lng ?? 0,
      stopOrder: s.stopOrder,
    }))

    const etaResults = recalculateETAs(remainingWithCurrent, currentPosition, new Date())

    // Update estimated times
    for (let i = 0; i < Math.min(etaResults.length, pendingStops.length); i++) {
      const stopId = pendingStops[i].id
      const minutes = etaResults[i].estimatedMinutes
      const etaTime = new Date(Date.now() + minutes * 60000).toISOString()
      await supabase
        .from('TripStop')
        .update({ estimatedTime: etaTime })
        .eq('id', stopId)
    }
  }

  // Fetch updated trip
  const { data: updatedTrip } = await supabase
    .from('Trip')
    .select('*, stops:TripStop(*, child:Child(name, schoolName))')
    .eq('id', tripId)
    .maybeSingle()

  if (updatedTrip?.stops) {
    updatedTrip.stops.sort((a: any, b: any) => a.stopOrder - b.stopOrder)
  }

  return NextResponse.json({
    ...updatedTrip,
    tripCompleted,
  })
}
