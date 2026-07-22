export interface WhatsappResult {
  success: boolean
  messageId?: string
  error?: string
}

const API_VERSION = 'v22.0'
const DEV_MODE = process.env.WHATSAPP_ACCESS_TOKEN === undefined || process.env.WHATSAPP_PHONE_NUMBER_ID === undefined

// Meta expects digits only, no leading '+'
function toWhatsappId(phone: string): string {
  return phone.replace(/\D/g, '')
}

export async function sendWhatsappOtp(to: string, code: string): Promise<WhatsappResult> {
  if (DEV_MODE) {
    console.log(`[WHATSAPP DEV] To: ${to}\nOTP: ${code}`)
    return { success: true, messageId: 'dev-mode' }
  }

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN!
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
