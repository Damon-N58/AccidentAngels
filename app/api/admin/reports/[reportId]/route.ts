import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

const VALID_STATUSES = ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'] as const
type ReportStatus = typeof VALID_STATUSES[number]

// Statuses that mark a report as closed and require resolvedAt + resolvedByUserId
const CLOSING_STATUSES: ReportStatus[] = ['RESOLVED', 'DISMISSED']

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const session = await getSession(request.headers.get('cookie'))
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { reportId } = await params

    const body = await request.json()
    const { status, adminNotes } = body as { status?: string; adminNotes?: string }

    // Validate status if provided
    if (status !== undefined && !VALID_STATUSES.includes(status as ReportStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    // Confirm the report exists before updating
    const { data: existing } = await supabase
      .from('Report')
      .select('id')
      .eq('id', reportId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    const now = new Date().toISOString()

    // Build the patch payload; updatedAt is always refreshed
    const patch: Record<string, unknown> = { updatedAt: now }

    if (status !== undefined) {
      patch.status = status
      // Closing a report stamps resolution metadata
      if (CLOSING_STATUSES.includes(status as ReportStatus)) {
        patch.resolvedAt         = now
        patch.resolvedByUserId   = session.userId
      }
    }

    if (adminNotes !== undefined) {
      patch.adminNotes = adminNotes
    }

    const { data: updated, error } = await supabase
      .from('Report')
      .update(patch)
      .eq('id', reportId)
      .select(
        `
        id,
        category,
        description,
        status,
        adminNotes,
        resolvedAt,
        resolvedByUserId,
        driverNotifiedAt,
        createdAt,
        updatedAt,
        childId,
        parent:Parent(id, user:User(name, phone)),
        driver:Driver(id, user:User(name, phone))
        `
      )
      .maybeSingle()

    if (error) {
      console.error('[admin/reports/:id PATCH]', error)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }

    return NextResponse.json({ report: updated })
  } catch (err) {
    console.error('[admin/reports/:id PATCH]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
