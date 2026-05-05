import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { sendSms, smsTemplates } from '@/lib/sms/africas-talking'

const ALL_DOC_TYPES = ['PDP', 'POLICE_CLEARANCE', 'PASSENGER_LIABILITY', 'ROADWORTHY_CERTIFICATE', 'VEHICLE_PHOTOS', 'DRIVER_LICENSE']

export async function POST(
  request: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const session = await getSession(request.headers.get('cookie'))
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { docId } = await params
    const { action, notes } = await request.json() as { action: 'APPROVED' | 'REJECTED'; notes?: string }

    if (action !== 'APPROVED' && action !== 'REJECTED') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const { data: doc } = await supabase
      .from('ComplianceDocument')
      .select('*, driver:Driver(*, user:User(*))')
      .eq('id', docId)
      .maybeSingle()
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    const now = new Date().toISOString()
    await supabase.from('ComplianceDocument').update({
      status:           action,
      reviewNotes:      notes ?? null,
      reviewedAt:       now,
      reviewedByUserId: session.userId,
      updatedAt:        now,
    }).eq('id', docId)

    const phone = doc.driver.user.phone
    if (action === 'APPROVED') {
      await sendSms(phone, smsTemplates.complianceApproved(doc.type.replace(/_/g, ' ')))
    } else {
      await sendSms(phone, smsTemplates.complianceRejected(doc.type.replace(/_/g, ' '), notes ?? 'See admin notes'))
    }

    if (action === 'APPROVED') {
      const { data: approvedDocs } = await supabase
        .from('ComplianceDocument')
        .select('type')
        .eq('driverId', doc.driverId)
        .eq('status', 'APPROVED')

      const approvedTypes = (approvedDocs ?? []).map((d: any) => d.type)
      const allApproved = ALL_DOC_TYPES.every(t => approvedTypes.includes(t))

      if (allApproved && doc.driver.status !== 'ACTIVE') {
        await supabase.from('Driver').update({
          status:            'ACTIVE',
          isVerifiedByAdmin: true,
          verifiedAt:        now,
          verifiedByUserId:  session.userId,
          updatedAt:         now,
        }).eq('id', doc.driverId)
      }
    }

    if (action === 'REJECTED' && doc.driver.status === 'ACTIVE') {
      await supabase.from('Driver').update({
        status:    'SUSPENDED',
        updatedAt: now,
      }).eq('id', doc.driverId)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[admin/compliance/review]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
