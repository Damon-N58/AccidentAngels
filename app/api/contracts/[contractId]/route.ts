import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ contractId: string }> }
) {
  try {
    const session = await getSession(request.headers.get('cookie'))
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { contractId } = await params

    const { data: contract } = await supabase
      .from('Contract')
      .select('*, child:Child(*), parent:Parent(user:User(*)), driver:Driver(user:User(*))')
      .eq('id', contractId)
      .maybeSingle()

    if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })

    const { data: driver } = await supabase.from('Driver').select('id').eq('userId', session.userId).maybeSingle()
    const { data: parent } = await supabase.from('Parent').select('id').eq('userId', session.userId).maybeSingle()

    const isDriver = driver?.id === contract.driverId
    const isParent = parent?.id === contract.parentId
    const isAdmin  = session.role === 'ADMIN'

    if (!isDriver && !isParent && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({
      id:                 contract.id,
      status:             contract.status,
      childName:          contract.child.name,
      parentName:         contract.parent.user.name,
      parentPhone:        contract.parent.user.phone,
      monthlyAmountCents: contract.monthlyAmountCents,
      startDate:          contract.startDate,
      driverSignedAt:     contract.driverSignedAt ?? null,
      parentSignedAt:     contract.parentSignedAt ?? null,
      pdfUrl:             contract.pdfUrl,
    })
  } catch (err) {
    console.error('[contracts/get]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
