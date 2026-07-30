import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { getSignedComplianceUrl } from '@/lib/storage/supabase'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ driverId: string }> }
) {
  try {
    const session = await getSession(request.headers.get('cookie'))
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { driverId } = await params

    const { data: driver } = await supabase
      .from('Driver')
      .select('*, user:User(*), association:Association(*)')
      .eq('id', driverId)
      .maybeSingle()

    if (!driver) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: complianceDocs } = await supabase
      .from('ComplianceDocument')
      .select('*')
      .eq('driverId', driverId)
      .order('updatedAt', { ascending: false })

    return NextResponse.json({
      id:                     driver.id,
      status:                 driver.status,
      getsRegistrationNumber: driver.getsRegistrationNumber,
      vehicleRegistration:    driver.vehicleRegistration,
      vehicleMake:            driver.vehicleMake,
      vehicleModel:           driver.vehicleModel,
      vehicleYear:            driver.vehicleYear,
      vehicleColour:          driver.vehicleColour,
      vehicleCapacity:        driver.vehicleCapacity,
      paystackSubAccountCode: driver.paystackSubAccountCode ?? null,
      monthlyFeeCents:        driver.monthlyFeeCents ?? 0,
      user: {
        name:  driver.user.name,
        phone: driver.user.phone,
        email: driver.user.email,
      },
      association: driver.association
        ? { name: driver.association.name, region: driver.association.region }
        : null,
      complianceDocs: await Promise.all((complianceDocs ?? []).map(async (d: any) => ({
        id:             d.id,
        type:           d.type,
        status:         d.status,
        fileUrl:        await getSignedComplianceUrl(d.fileUrl),
        fileName:       d.fileName,
        documentNumber: d.documentNumber,
        issueDate:      d.issueDate ?? null,
        expiryDate:     d.expiryDate ?? null,
        reviewNotes:    d.reviewNotes,
      }))),
    })
  } catch (err) {
    console.error('[admin/drivers/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** Admin: update a driver's monthly fee (the car's per-child rate, in cents). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ driverId: string }> },
) {
  const session = await getSession(request.headers.get('cookie'))
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { driverId } = await params
  const body = (await request.json().catch(() => null)) as Record<string, any> | null
  if (body?.monthlyFeeCents == null || !Number.isFinite(+body.monthlyFeeCents)) {
    return NextResponse.json({ error: 'monthlyFeeCents is required' }, { status: 400 })
  }
  const monthlyFeeCents = Math.max(0, Math.round(+body.monthlyFeeCents))
  const { error } = await supabase.from('Driver').update({ monthlyFeeCents }).eq('id', driverId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, monthlyFeeCents })
}
