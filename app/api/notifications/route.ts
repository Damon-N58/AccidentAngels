import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const session = await getSession(request.headers.get('cookie'))
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Fetch up to 20 most recent notifications for this user, any read status
    const { data: notifications, error } = await supabase
      .from('Notification')
      .select('id, type, title, body, isRead, metadata, createdAt')
      .eq('userId', session.userId)
      .order('createdAt', { ascending: false })
      .limit(20)

    if (error) throw error

    const rows = notifications ?? []

    // Count only the unread ones among the fetched rows (and across all — see note below)
    // Spec: unreadCount = false entries. We count across ALL user notifications, not just the 20 returned.
    const { count: unreadCount } = await supabase
      .from('Notification')
      .select('id', { count: 'exact', head: true })
      .eq('userId', session.userId)
      .eq('isRead', false)

    return NextResponse.json({
      notifications: rows,
      unreadCount:   unreadCount ?? 0,
    })
  } catch (err) {
    console.error('[notifications/get]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
