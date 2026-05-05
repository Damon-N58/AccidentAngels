export interface SmsResult {
  success: boolean
  messageId?: string
  error?: string
}

// In dev/test, log to console instead of sending
const DEV_MODE = process.env.NODE_ENV !== 'production' || process.env.AT_API_KEY === undefined

async function sendViaPlatform(to: string, message: string): Promise<SmsResult> {
  const apiKey    = process.env.AT_API_KEY!
  const username  = process.env.AT_USERNAME!
  const senderId  = process.env.AT_SENDER_ID ?? 'AccidentAngels'

  const body = new URLSearchParams({
    username,
    to,
    message,
    from: senderId,
  })

  const res = await fetch('https://api.africastalking.com/version1/messaging', {
    method:  'POST',
    headers: {
      Accept:         'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      apiKey,
    },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    return { success: false, error: `HTTP ${res.status}: ${text}` }
  }

  const data = await res.json()
  const recipient = data?.SMSMessageData?.Recipients?.[0]
  if (recipient?.status !== 'Success') {
    return { success: false, error: recipient?.status ?? 'Unknown error' }
  }

  return { success: true, messageId: recipient.messageId }
}

export async function sendSms(to: string, message: string): Promise<SmsResult> {
  if (DEV_MODE) {
    console.log(`[SMS DEV] To: ${to}\n${message}`)
    return { success: true, messageId: 'dev-mode' }
  }
  return sendViaPlatform(to, message)
}

// Pre-built message templates
export const smsTemplates = {
  otp: (code: string) =>
    `Your Accident Angels code is: ${code}\nValid for 5 minutes. Do not share this code.`,

  driverInvite: (parentName: string, driverName: string, appUrl: string) =>
    `Hi ${parentName}, ${driverName} has registered your child on Accident Angels. Sign their transport agreement here: ${appUrl}`,

  contractSigning: (driverName: string, childName: string, signingUrl: string) =>
    `Hi, please sign the transport agreement for ${childName} with driver ${driverName}: ${signingUrl}\nValid for 72 hours.`,

  newTransportRequest: (parentName: string, childName: string, driverAppUrl: string) =>
    `Accident Angels: ${parentName} has requested transport for ${childName}. Log in to review and accept: ${driverAppUrl}`,

  contractAccepted: (driverName: string, childName: string) =>
    `Great news! ${driverName} has accepted the transport agreement for ${childName}. You're all set on Accident Angels.`,

  complianceApproved: (docType: string) =>
    `Accident Angels: Your ${docType} has been approved. ✓`,

  complianceRejected: (docType: string, reason: string) =>
    `Accident Angels: Your ${docType} was rejected. Reason: ${reason}. Please re-upload.`,

  complianceExpiring: (docType: string, days: number) =>
    `Accident Angels: Your ${docType} expires in ${days} days. Upload a new one to stay active.`,

  complianceExpired: (docType: string) =>
    `Accident Angels: Your ${docType} has expired. Your account is now suspended. Upload a new document immediately.`,
}
