import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const session = await getSession(request.headers.get('cookie'))
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (session.role !== 'PARENT') {
      return NextResponse.json({ error: 'Only parents can view waiting charges' }, { status: 403 })
    }

    // Resolve parentId from session user
    const { data: parent } = await supabase
      .from('Parent')
      .select('id')
      .eq('userId', session.userId)
      .maybeSingle()

    if (!parent) {
      return NextResponse.json({ error: 'Parent not found' }, { status: 404 })
    }

    // Fetch unbilled, live waiting charges for this parent, newest first.
    // isLive=true ensures charges recorded before billing went live are not surfaced/owed.
    const { data: charges, error } = await supabase
      .from('WaitingCharge')
      .select('*, child:Child(name)')
      .eq('parentId', parent.id)
      .eq('isLive', true)
      .is('billedAt', null)
      .order('createdAt', { ascending: false })

    if (error) throw error

    const rows = charges ?? []
    const totalUnbilledCents = rows.reduce((sum, c) => sum + (c.chargeCents ?? 0), 0)

    return NextResponse.json({ charges: rows, totalUnbilledCents })
  } catch (err) {
    console.error('[waiting-charges/get]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
