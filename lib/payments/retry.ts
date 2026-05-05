import { supabase } from '../supabase'
import { addDays } from 'date-fns'

async function getRetryDays(): Promise<{ day1: number; day2: number }> {
  const { data: rows } = await supabase
    .from('PlatformConfig')
    .select('key, value')
    .in('key', ['RETRY_DAY_1', 'RETRY_DAY_2'])

  const map = Object.fromEntries((rows ?? []).map(r => [r.key, r.value]))
  return {
    day1: map['RETRY_DAY_1'] ? parseInt(map['RETRY_DAY_1']) : 3,
    day2: map['RETRY_DAY_2'] ? parseInt(map['RETRY_DAY_2']) : 7,
  }
}

export async function scheduleRetry(transactionId: string): Promise<void> {
  const { data: tx } = await supabase
    .from('Transaction')
    .select('attemptCount')
    .eq('id', transactionId)
    .maybeSingle()

  if (!tx) return

  const { day1, day2 } = await getRetryDays()
  const now = new Date()

  let nextRetryAt: string | null = null
  if (tx.attemptCount === 1) nextRetryAt = addDays(now, day1).toISOString()
  else if (tx.attemptCount === 2) nextRetryAt = addDays(now, day2).toISOString()

  await supabase.from('Transaction').update({
    status:        nextRetryAt ? 'RETRY_SCHEDULED' : 'FAILED',
    nextRetryAt,
    lastAttemptAt: now.toISOString(),
    updatedAt:     now.toISOString(),
  }).eq('id', transactionId)
}
