import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

const MAX_LIMIT = 50
const DEFAULT_LIMIT = 20

export async function GET(request: Request) {
  try {
    const session = await getSession(request.headers.get('cookie'))
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(request.url)

    const VALID_STATUSES = ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED']
    const rawStatus = searchParams.get('status')
    const status = rawStatus && VALID_STATUSES.includes(rawStatus) ? rawStatus : undefined

    const parsedLimit  = parseInt(searchParams.get('limit')  ?? String(DEFAULT_LIMIT), 10)
    const parsedOffset = parseInt(searchParams.get('offset') ?? '0', 10)
    const limit  = Math.min(isNaN(parsedLimit)  ? DEFAULT_LIMIT : parsedLimit,  MAX_LIMIT)
    const offset = Math.max(isNaN(parsedOffset) ? 0              : parsedOffset, 0)

    // Base query — join parent→user and driver→user for name/phone
    let query = supabase
      .from('Report')
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
        `,
        { count: 'exact' } // ask PostgREST for total row count alongside data
      )
      .order('createdAt', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const { data: reports, count, error } = await query

    if (error) {
      console.error('[admin/reports GET]', error)
      return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    }

    return NextResponse.json({ reports: reports ?? [], total: count ?? 0 })
  } catch (err) {
    console.error('[admin/reports GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
