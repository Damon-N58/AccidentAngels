import { supabase } from '@/lib/supabase'
import { randomUUID } from 'crypto'

/**
 * ============================================================================
 * WhatsApp reminder queue (native WhatsApp transport NOT built yet)
 * ============================================================================
 * This queues a reminder into "WhatsAppOutbox". Delivery is handled
 * asynchronously by the dunning consumer cron (app/api/cron/dunning), which
 * currently sends via SMS as the interim transport so failed-payment reminders
 * actually reach parents. To finish the native integration, a developer must:
 *   1. Wire a WhatsApp provider (Meta Cloud API / Twilio / 360dialog).
 *   2. Swap the sendSms call in the dunning consumer for the WhatsApp provider.
 * See WHATSAPP_INTEGRATION_TODO.md.
 * ============================================================================
 */
export async function queueWhatsAppReminder(params: {
  toPhone: string
  body: string
  parentId?: string
  kind?: string
}): Promise<{ queued: boolean; delivered: false; gap: true }> {
  console.info(
    '[dunning] reminder queued for async delivery (SMS interim). ' +
      `to=${params.toPhone} kind=${params.kind ?? 'DUNNING'}`,
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
