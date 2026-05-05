import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const session = await getSession(request.headers.get('cookie'))
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') ?? 'UNDER_REVIEW'
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '25'), 100)
    const offset = Math.max(parseInt(searchParams.get('offset') ?? '0'), 0)

    const { data: docs, count } = await supabase
      .from('ComplianceDocument')
      .select('*, driver:Driver(*, user:User(*), association:Association(*))', { count: 'exact' })
      .eq('status', status)
      .order('createdAt', { ascending: true })
      .range(offset, offset + limit - 1)

    return NextResponse.json({
      items: (docs ?? []).map((doc: any) => ({
      id:             doc.id,
      type:           doc.type,
      status:         doc.status,
      fileUrl:        doc.fileUrl,
      fileName:       doc.fileName,
      expiryDate:     doc.expiryDate ?? null,
      issueDate:      doc.issueDate ?? null,
      documentNumber: doc.documentNumber,
      reviewNotes:    doc.reviewNotes,
      createdAt:      doc.createdAt,
      driver: {
        id:          doc.driver.id,
        name:        doc.driver.user.name,
        phone:       doc.driver.user.phone,
        association: doc.driver.association?.name ?? null,
        status:      doc.driver.status,
      },
    })),
    count,
    offset,
    limit,
  })
  } catch (err) {
    console.error('[admin/compliance]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
