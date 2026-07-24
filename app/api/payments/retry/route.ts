import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { validateRequest, safeParseJson } from '@/lib/request-validation'

/**
 * Manually re-queue a FAILED payment for another attempt. A parent can retry
 * their own failed charge; an admin can retry any. The charge worker
 * (/api/cron/billing-charge) picks it up on its next run.
 */
export async function POST(request: Request) {
  try {
    const session = await getSession(request.headers.get('cookie'))
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const validationError = validateRequest(request)
    if (validationError) return validationError
    const body = (await safeParseJson(request)) as { transactionId?: string } | null
    if (!body?.transactionId) {
      return NextResponse.json({ error: 'transactionId is required' }, { status: 400 })
    }

    const { data: tx } = await supabase
      .from('Transaction')
      .select('id, status, parentId, parent:Parent(userId)')
      .eq('id', body.transactionId)
      .maybeSingle()
    if (!tx) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })

    // Ownership: parents may only retry their own charges.
    const parentUserId = (tx.parent as unknown as { userId: string } | null)?.userId
    if (session.role !== 'ADMIN' && parentUserId !== session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Only a terminally FAILED charge can be manually retried.
    if (tx.status !== 'FAILED') {
      return NextResponse.json(
        { error: `Cannot retry a transaction in status ${tx.status}` },
        { status: 409 },
      )
    }

    const now = new Date().toISOString()
    await supabase
      .from('Transaction')
      .update({ status: 'PENDING', nextRetryAt: null, claimedAt: null, failureReason: null, updatedAt: now })
      .eq('id', tx.id)
      .eq('status', 'FAILED') // race-safe: only flip if still FAILED

    return NextResponse.json({ ok: true, queued: true })
  } catch (err) {
    console.error('[payments/retry]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
