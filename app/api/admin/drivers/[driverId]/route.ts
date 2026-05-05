import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { decrypt } from '@/lib/auth/encryption'
import { supabase } from '@/lib/supabase'

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
      bankName:               driver.bankName,
      bankAccountNumber:      driver.bankAccountNumber ? decrypt(driver.bankAccountNumber) : null,
      bankBranchCode:         driver.bankBranchCode ? decrypt(driver.bankBranchCode) : null,
      bankAccountName:        driver.bankAccountName ? decrypt(driver.bankAccountName) : null,
      user: {
        name:  driver.user.name,
        phone: driver.user.phone,
        email: driver.user.email,
      },
      association: driver.association
        ? { name: driver.association.name, region: driver.association.region }
        : null,
      complianceDocs: (complianceDocs ?? []).map((d: any) => ({
        id:             d.id,
        type:           d.type,
        status:         d.status,
        fileUrl:        d.fileUrl,
        fileName:       d.fileName,
        documentNumber: d.documentNumber,
        issueDate:      d.issueDate ?? null,
        expiryDate:     d.expiryDate ?? null,
        reviewNotes:    d.reviewNotes,
      })),
    })
  } catch (err) {
    console.error('[admin/drivers/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
