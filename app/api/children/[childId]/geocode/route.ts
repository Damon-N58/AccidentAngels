import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { verifyChildAccess } from '@/lib/auth/ownership'
import { supabase } from '@/lib/supabase'
import { geocodeAddress } from '@/lib/trips/geocode'
import { validateAndParseJson } from '@/lib/request-validation'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ childId: string }> },
) {
  const session = await getSession(request.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { childId } = await params

  const child = await verifyChildAccess(childId, session)
  if (!child) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [body, bodyErr] = await validateAndParseJson(request)
  if (bodyErr) return bodyErr
  const { pickupAddress, dropoffAddress } = body as Record<string, string>

  if (!pickupAddress && !dropoffAddress) {
    return NextResponse.json({ error: 'pickupAddress or dropoffAddress required' }, { status: 400 })
  }

  const updateData: Record<string, any> = {}

  if (pickupAddress) {
    const geo = await geocodeAddress(pickupAddress)
    if (geo) {
      updateData.pickupLat = geo.lat
      updateData.pickupLng = geo.lng
    }
  }

  if (dropoffAddress) {
    const geo = await geocodeAddress(dropoffAddress)
    if (geo) {
      updateData.dropoffLat = geo.lat
      updateData.dropoffLng = geo.lng
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'Geocoding failed for all addresses' }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('Child')
    .update(updateData)
    .eq('id', childId)
    .select()
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
