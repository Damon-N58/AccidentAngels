import { supabase } from '@/lib/supabase'
import { randomUUID } from 'crypto'

/**
 * ============================================================================
 * ⚠️⚠️⚠️  WHATSAPP INTEGRATION IS NOT IMPLEMENTED — THIS IS A STUB  ⚠️⚠️⚠️
 * ============================================================================
 * Reminders are NOT actually delivered. This function only QUEUES the message
 * into the "WhatsAppOutbox" table so nothing is lost. Another developer must:
 *   1. Wire a WhatsApp provider (Meta Cloud API / Twilio / 360dialog).
 *   2. Add a worker that drains WhatsAppOutbox WHERE status='QUEUED' and sends.
 *   3. Flip status to SENT/FAILED accordingly.
 * See WHATSAPP_INTEGRATION_TODO.md.
 * ============================================================================
 */
export async function queueWhatsAppReminder(params: {
  toPhone: string
  body: string
  parentId?: string
  kind?: string
}): Promise<{ queued: boolean; delivered: false; gap: true }> {
  // Make the gap impossible to miss in logs.
  console.warn(
    '[WHATSAPP GAP — NOT SENT] Reminder queued only. Integration missing. ' +
      `to=${params.toPhone} kind=${params.kind ?? 'DUNNING'} body="${params.body}"`,
  )
  try {
    await supabase.from('WhatsAppOutbox').insert({
      id: randomUUID(),
      toPhone: params.toPhone,
      body: params.body,
      kind: params.kind ?? 'DUNNING',
      parentId: params.parentId ?? null,
      status: 'QUEUED',
      createdAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[WHATSAPP GAP] failed to even queue the reminder:', err)
  }
  return { queued: true, delivered: false, gap: true }
}
