import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  try {
    const session = await getSession(request.headers.get('cookie'))
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { notificationId } = await params

    // Ownership check: fetch the notification first, verify it belongs to this user
    const { data: notification } = await supabase
      .from('Notification')
      .select('id, userId')
      .eq('id', notificationId)
      .maybeSingle()

    if (!notification || notification.userId !== session.userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Mark as read now that ownership is confirmed
    const { error } = await supabase
      .from('Notification')
      .update({ isRead: true })
      .eq('id', notificationId)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[notifications/:id/read]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
