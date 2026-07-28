import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendSms } from '@/lib/sms/africas-talking'
import { isCronAuthorized } from '@/lib/cron-auth'

export const maxDuration = 120

const BATCH = 100
const CONCURRENCY = 5
// Give up (mark FAILED) on reminders that have not sent for this long, so a
// permanently-unreachable number does not retry forever.
const GIVE_UP_MS = 72 * 60 * 60 * 1000

/**
 * Dunning outbox drain.
 *
 * Reminders for failed payments are written to WhatsAppOutbox by the billing
 * retry logic. The WhatsApp integration is not built yet, so this consumer
 * delivers them via the existing SMS channel as the interim transport — the
 * important thing is that a parent whose card fails is actually told. When
 * WhatsApp lands, swap the sendSms call for the WhatsApp provider.
 *
 * A row that fails to send is left QUEUED and retried on the next run until it
 * ages past GIVE_UP_MS, after which it is marked FAILED.
 */
export async function POST(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: rows } = await supabase
    .from('WhatsAppOutbox')
    .select('id, toPhone, body, createdAt')
    .eq('status', 'QUEUED')
    .order('createdAt', { ascending: true })
    .limit(BATCH)

  let sent = 0,
    failed = 0,
    retryLater = 0

  const work = rows ?? []
  for (let i = 0; i < work.length; i += CONCURRENCY) {
    const chunk = work.slice(i, i + CONCURRENCY)
    const results = await Promise.all(chunk.map(row => deliverOne(row)))
    for (const r of results) {
      if (r === 'sent') sent++
      else if (r === 'failed') failed++
      else retryLater++
    }
  }

  return NextResponse.json({ ok: true, scanned: work.length, sent, failed, retryLater })
}

type OutboxRow = { id: string; toPhone: string; body: string; createdAt: string }

async function deliverOne(row: OutboxRow): Promise<'sent' | 'failed' | 'retry'> {
  const now = new Date().toISOString()
  try {
    const result = await sendSms(row.toPhone, row.body)
    if (result.success) {
      await supabase.from('WhatsAppOutbox').update({ status: 'SENT', sentAt: now }).eq('id', row.id)
      return 'sent'
    }
    // Delivery declined by the provider.
    if (Date.now() - new Date(row.createdAt).getTime() > GIVE_UP_MS) {
      await supabase.from('WhatsAppOutbox').update({ status: 'FAILED' }).eq('id', row.id)
      console.error(`[dunning] giving up on outbox ${row.id} after ${result.error ?? 'delivery failure'}`)
      return 'failed'
    }
    console.warn(`[dunning] outbox ${row.id} not delivered (${result.error ?? 'unknown'}); will retry`)
    return 'retry'
  } catch (err) {
    // Transient error — leave QUEUED for the next run unless it has aged out.
    if (Date.now() - new Date(row.createdAt).getTime() > GIVE_UP_MS) {
      await supabase.from('WhatsAppOutbox').update({ status: 'FAILED' }).eq('id', row.id)
      console.error(`[dunning] giving up on outbox ${row.id}:`, err)
      return 'failed'
    }
    console.warn(`[dunning] outbox ${row.id} threw; will retry:`, err)
    return 'retry'
  }
}

// Vercel Cron triggers scheduled jobs with a GET request (carrying the
// `Authorization: Bearer $CRON_SECRET` header), so expose the same handler on
// GET. POST is retained for internal/manual invocation.
export const GET = POST
