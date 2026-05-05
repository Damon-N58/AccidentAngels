import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { getPublicUrl, COMPLIANCE_BUCKET } from '@/lib/storage/supabase'
import { validateRequest, safeParseJson } from '@/lib/request-validation'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const session = await getSession(request.headers.get('cookie'))
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const validationError = validateRequest(request)
    if (validationError) return validationError
    const body = await safeParseJson(request)
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

    const { docId } = await params
    const { path, docNumber, issueDate, expiryDate } = body as Record<string, any>

    if (!path) return NextResponse.json({ error: 'File path is required' }, { status: 400 })

    const { data: driver } = await supabase.from('Driver').select('id').eq('userId', session.userId).maybeSingle()
    if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })

    const { data: doc } = await supabase
      .from('ComplianceDocument')
      .select('id')
      .eq('id', docId)
      .eq('driverId', driver.id)
      .maybeSingle()
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    const fileUrl = getPublicUrl(COMPLIANCE_BUCKET, path)

    await supabase.from('ComplianceDocument').update({
      fileUrl,
      status:         'UNDER_REVIEW',
      documentNumber: docNumber?.trim() || null,
      issueDate:      issueDate ? new Date(issueDate).toISOString() : null,
      expiryDate:     expiryDate ? new Date(expiryDate).toISOString() : null,
      updatedAt:      new Date().toISOString(),
    }).eq('id', docId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[compliance/save]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
