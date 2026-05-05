import { NextResponse } from 'next/server'
import { verifyParentSigningToken } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const payload = await verifyParentSigningToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 400 })
    }

    const { data: contract } = await supabase
      .from('Contract')
      .select('*, child:Child(*), driver:Driver(user:User(*)), parent:Parent(user:User(*))')
      .eq('parentSigningToken', token)
      .maybeSingle()

    if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    if (contract.status === 'FULLY_SIGNED') return NextResponse.json({ error: 'Contract already signed' }, { status: 400 })
    if (contract.status === 'CANCELLED') return NextResponse.json({ error: 'This contract has been cancelled' }, { status: 400 })

    return NextResponse.json({
      driverName:         contract.driver.user.name,
      childName:          contract.child.name,
      pickupAddress:      contract.child.pickupAddress,
      dropoffAddress:     contract.child.dropoffAddress,
      monthlyAmountCents: contract.monthlyAmountCents,
      startDate:          contract.startDate,
      parentPhone:        contract.parent.user.phone,
      pdfUrl:             contract.pdfUrl,
    })
  } catch (err) {
    console.error('[contracts/sign-info]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
