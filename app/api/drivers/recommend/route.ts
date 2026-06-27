import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { rankDrivers, CandidateDriver } from '@/lib/drivers/recommend'
import { centroidOf } from '@/lib/geo'

export async function GET(request: Request) {
  try {
    const session = await getSession(request.headers.get('cookie'))
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'PARENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const childId = searchParams.get('childId')

    if (!childId) {
      return NextResponse.json({ error: 'childId is required' }, { status: 400 })
    }

    // Resolve parent
    const { data: parent } = await supabase
      .from('Parent')
      .select('id')
      .eq('userId', session.userId)
      .maybeSingle()

    if (!parent) return NextResponse.json({ error: 'Parent profile not found' }, { status: 404 })

    // Verify the child belongs to this parent — prevents cross-parent data leakage
    const { data: child } = await supabase
      .from('Child')
      .select('id, pickupLat, pickupLng')
      .eq('id', childId)
      .eq('parentId', parent.id)   // ownership enforced here
      .maybeSingle()

    if (!child) {
      return NextResponse.json({ error: 'Child not found or not yours' }, { status: 403 })
    }

    const childPickupLat: number | null = child.pickupLat ?? null
    const childPickupLng: number | null = child.pickupLng ?? null

    // Fetch all ACTIVE drivers with the fields rankDrivers needs
    const { data: rawDrivers, error: driversError } = await supabase
      .from('Driver')
      .select(
        'id, status, vehicleCapacity, profilePhotoUrl, vehicleMake, vehicleModel, vehicleColour, ratingAvg, ratingCount, user:User(id, name), association:Association(name, region), complianceDocs:ComplianceDocument(status), children:Child(id, isActive, pickupLat, pickupLng)',
      )
      .eq('status', 'ACTIVE')

    if (driversError) throw driversError

    // Build CandidateDriver[] — computing centroid from the driver's active children's pickups
    const candidates: CandidateDriver[] = (rawDrivers ?? []).map((d: any) => {
      const activeChildren = (d.children ?? []).filter((c: any) => c.isActive)
      const approvedDocsCount = (d.complianceDocs ?? []).filter(
        (doc: any) => doc.status === 'APPROVED',
      ).length

      // Centroid of active pickup locations (skip nulls)
      const pickupPoints = activeChildren
        .filter((c: any) => c.pickupLat != null && c.pickupLng != null)
        .map((c: any) => ({ lat: c.pickupLat as number, lng: c.pickupLng as number }))

      const centroid = centroidOf(pickupPoints)

      return {
        id: d.id,
        status: d.status,
        ratingAvg: d.ratingAvg ?? null,
        ratingCount: d.ratingCount ?? 0,
        centroidLat: centroid?.lat ?? null,
        centroidLng: centroid?.lng ?? null,
        vehicleCapacity: d.vehicleCapacity ?? null,
        activeChildCount: activeChildren.length,
        approvedDocsCount,
        // keep raw driver data for response mapping
        _raw: d,
      } as CandidateDriver & { _raw: any }
    })

    // Rank and slice top 20
    const ranked = rankDrivers(candidates as CandidateDriver[], childPickupLat, childPickupLng).slice(0, 20)

    // Map to response shape — eligible drivers always have 6 approved docs
    const result = ranked.map((rd) => {
      const raw = (rd as any)._raw
      return {
        id: rd.id,
        user: { name: raw.user?.name ?? null },
        vehicleMake: raw.vehicleMake ?? null,
        vehicleModel: raw.vehicleModel ?? null,
        vehicleColour: raw.vehicleColour ?? null,
        vehicleCapacity: raw.vehicleCapacity ?? null,
        profilePhotoUrl: raw.profilePhotoUrl ?? null,
        association: raw.association
          ? { name: raw.association.name, region: raw.association.region }
          : null,
        ratingAvg: rd.ratingAvg,
        ratingCount: rd.ratingCount,
        // Round distance to 1 decimal place (in km) or null when location unknown
        distanceKm:
          rd.distanceKm !== null ? Math.round(rd.distanceKm * 10) / 10 : null,
        approvedDocsCount: 6, // all eligible drivers have exactly 6
      }
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[drivers/recommend/get]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
