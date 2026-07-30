import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const session = await getSession(request.headers.get('cookie'))
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: drivers } = await supabase
      .from('Driver')
      .select('*, user:User(id, name, phone), association:Association(id, name, region), complianceDocs:ComplianceDocument(status)')
      // Only ACTIVE drivers are assignable — child creation rejects non-ACTIVE,
      // so offering PENDING_COMPLIANCE drivers here dead-ended parents at the
      // final step with a cryptic "Driver not found or not active".
      .eq('status', 'ACTIVE')
      .order('createdAt', { ascending: false })

    const result = (drivers ?? []).map((d: any) => ({
      id: d.id,
      profilePhotoUrl: d.profilePhotoUrl,
      vehicleMake: d.vehicleMake,
      vehicleModel: d.vehicleModel,
      vehicleYear: d.vehicleYear,
      vehicleColour: d.vehicleColour,
      vehicleCapacity: d.vehicleCapacity,
      vehicleRegistration: d.vehicleRegistration,
      getsRegistrationNumber: d.getsRegistrationNumber,
      user: { id: d.user.id, name: d.user.name },
      association: d.association
        ? { id: d.association.id, name: d.association.name, region: d.association.region }
        : null,
      approvedDocsCount: (d.complianceDocs ?? []).filter((c: any) => c.status === 'APPROVED').length,
      ratingAvg: d.ratingAvg ?? null,
      ratingCount: d.ratingCount ?? 0,
    }))

    return NextResponse.json(result)
  } catch (err) {
    console.error('[drivers/get]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
