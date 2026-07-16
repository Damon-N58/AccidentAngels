// lib/whatsapp/nineteen58.ts
//
// WhatsApp send adapter for OTP delivery via Nineteen58 (Meta Business API).
// Mirrors the shape of lib/sms/africas-talking.ts so callers can switch
// channel with a one-line import change.
//
// TODO(matt): real Nineteen58 endpoint/auth is not yet confirmed — this
// currently only has a dev-mode stub. Do not treat the "success" path as
// tested against a real API until credentials + docs arrive.

export interface WhatsAppResult {
  success: boolean
  messageId?: string
  raw?: unknown
}

const NINETEEN58_API_URL = process.env.NINETEEN58_API_URL
const NINETEEN58_API_KEY = process.env.NINETEEN58_API_KEY

function isConfigured(): boolean {
  return Boolean(NINETEEN58_API_URL && NINETEEN58_API_KEY)
}

/**
 * Sends a WhatsApp message via Nineteen58.
 *
 * Dev/sandbox behaviour matches sendSms(): if not configured (no env vars)
 * or NODE_ENV !== 'production', logs to console and returns a fake success
 * instead of making a real request. This keeps local testing working with
 * zero external dependencies.
 */
export async function sendWhatsapp(to: string, message: string): Promise<WhatsAppResult> {
  const isDev = process.env.NODE_ENV !== 'production'

  if (isDev || !isConfigured()) {
    console.log(`[whatsapp:DEV] to=${to} message="${message}"`)
    return { success: true, messageId: 'dev-stub' }
  }

  // TODO(matt): confirm actual Nineteen58 request shape (endpoint path,
  // auth header format, payload fields) before relying on this in
  // production. This is a placeholder matching the general REST pattern
  // described in the team's WhatsApp architecture notes.
  const response = await fetch(`${NINETEEN58_API_URL}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${NINETEEN58_API_KEY}`,
    },
    body: JSON.stringify({ to, message }),
  })

  if (!response.ok) {
    const raw = await response.text().catch(() => undefined)
    throw new Error(`[whatsapp] Nineteen58 send failed: ${response.status} ${raw ?? ''}`)
  }

  const raw = await response.json().catch(() => undefined)
  return { success: true, raw }
}

export const whatsappTemplates = {
  otp: (code: string): string =>
    `Your GETS code is: ${code}\nValid for 5 minutes. Do not share this code.`,
}
