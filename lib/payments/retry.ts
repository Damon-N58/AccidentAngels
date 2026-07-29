import { supabase } from '../supabase'
import { addDays } from 'date-fns'
import { queueWhatsAppReminder } from '../notifications/whatsapp'

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

/**
 * Terminal dunning: all automatic retries are exhausted. Queue a WhatsApp
 * reminder (⚠️ NOT actually delivered yet — see WHATSAPP_INTEGRATION_TODO.md)
 * so the parent can be prompted to top up / update their card and self-retry.
 */
async function runDunning(transactionId: string): Promise<void> {
  const { data: tx } = await supabase
    .from('Transaction')
    .select('parentId, grossAmountCents, parent:Parent(whatsappPhone, user:User(name, phone))')
    .eq('id', transactionId)
    .maybeSingle()
  if (!tx) return

  const parent = tx.parent as unknown as {
    whatsappPhone: string | null
    user: { name: string; phone: string }
  } | null
  const toPhone = parent?.whatsappPhone || parent?.user?.phone
  if (!toPhone) return

  const rand = (tx.grossAmountCents / 100).toFixed(2)
  await queueWhatsAppReminder({
    toPhone,
    parentId: tx.parentId,
    kind: 'DUNNING',
    body:
      `Hi ${parent?.user?.name ?? ''}, your GETS transport payment of R${rand} could not be collected ` +
      `after several attempts. Please top up / update your payment method to keep your child's transport active.`,
  })
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

  // <=1 (not ===1) for the first retry: a charge whose first attempt came back
  // UNKNOWN (attemptCount never incremented) and was later confirmed failed by
  // reconcile still has attemptCount 0 — it must get its first retry, not skip
  // straight to FAILED + dunning.
  let nextRetryAt: string | null = null
  if (tx.attemptCount <= 1) nextRetryAt = addDays(now, day1).toISOString()
  else if (tx.attemptCount === 2) nextRetryAt = addDays(now, day2).toISOString()

  await supabase.from('Transaction').update({
    status:        nextRetryAt ? 'RETRY_SCHEDULED' : 'FAILED',
    nextRetryAt,
    lastAttemptAt: now.toISOString(),
    // Always release the claim: the charge worker only picks up rows with
    // claimedAt IS NULL, so a retry scheduled by reconcile (which may run on a
    // still-claimed row) would otherwise be stranded and never re-charged.
    claimedAt:     null,
    updatedAt:     now.toISOString(),
  }).eq('id', transactionId)

  // No more automatic retries left -> dunning.
  if (!nextRetryAt) await runDunning(transactionId)
}
