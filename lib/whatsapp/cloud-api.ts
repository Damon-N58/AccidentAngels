export interface WhatsappResult {
  success: boolean
  messageId?: string
  error?: string
}

// 'driver' is also used for admin OTPs — admin shares the driver WhatsApp number/channel.
export type WhatsappChannel = 'driver' | 'parent'

const API_VERSION = 'v22.0'

function channelCredentials(channel: WhatsappChannel) {
  const prefix = channel === 'parent' ? 'PARENT' : 'DRIVER'
  return {
    phoneNumberId: process.env[`WHATSAPP_PHONE_NUMBER_ID_${prefix}`],
    accessToken: process.env[`WHATSAPP_ACCESS_TOKEN_${prefix}`],
  }
}

// Meta expects digits only, no leading '+'
function toWhatsappId(phone: string): string {
  return phone.replace(/\D/g, '')
}

export async function sendWhatsappOtp(to: string, code: string, channel: WhatsappChannel): Promise<WhatsappResult> {
  const { phoneNumberId, accessToken } = channelCredentials(channel)
  const mode = process.env.OTP_MODE

  if (mode === 'dev') {
    console.log(`[WHATSAPP DEV] (${channel}) To: ${to}\nOTP: ${code}`)
    return { success: true, messageId: 'dev-mode' }
  }

  // Missing credentials is a misconfiguration, not a deliberate dev choice —
  // fail loudly instead of silently pretending the OTP was sent.
  if (!phoneNumberId || !accessToken) {
    return { success: false, error: `WhatsApp credentials not configured for channel "${channel}"` }
  }

  // Hybrid: send a real WhatsApp message but also log the code, so it's
  // visible without needing the phone at hand during testing.
  if (mode === 'hybrid') {
    console.log(`[WHATSAPP HYBRID] (${channel}) To: ${to}\nOTP: ${code}`)
  }

  const templateName = process.env.WHATSAPP_TEMPLATE_NAME ?? 'otp_auth'
  const templateLang = process.env.WHATSAPP_TEMPLATE_LANG ?? 'en_US'

  const components = [
    {
      type: 'body',
      parameters: [{ type: 'text', text: code }],
    },
    {
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: code }],
    },
  ]

  const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: toWhatsappId(to),
      type: 'template',
      template: {
        name: templateName,
        language: { code: templateLang },
        components,
      },
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    return { success: false, error: `HTTP ${res.status}: ${text}` }
  }

  const data = await res.json()
  const messageId = data?.messages?.[0]?.id
  if (!messageId) {
    return { success: false, error: 'No message id in response' }
  }

  return { success: true, messageId }
}
