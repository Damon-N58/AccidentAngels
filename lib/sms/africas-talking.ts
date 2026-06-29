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
  const senderId  = process.env.AT_SENDER_ID ?? 'GETS'

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
    `Your GETS code is: ${code}\nValid for 5 minutes. Do not share this code.`,

  driverInvite: (parentName: string, driverName: string, appUrl: string) =>
    `Hi ${parentName}, ${driverName} has registered your child on GETS. Sign their transport agreement here: ${appUrl}`,

  contractSigning: (driverName: string, childName: string, signingUrl: string) =>
    `Hi, please sign the transport agreement for ${childName} with driver ${driverName}: ${signingUrl}\nValid for 72 hours.`,

  newTransportRequest: (parentName: string, childName: string, driverAppUrl: string) =>
    `GETS: ${parentName} has requested transport for ${childName}. Log in to review and accept: ${driverAppUrl}`,

  contractAccepted: (driverName: string, childName: string) =>
    `Great news! ${driverName} has accepted the transport agreement for ${childName}. You're all set on GETS.`,

  complianceApproved: (docType: string) =>
    `GETS: Your ${docType} has been approved. ✓`,

  complianceRejected: (docType: string, reason: string) =>
    `GETS: Your ${docType} was rejected. Reason: ${reason}. Please re-upload.`,

  complianceExpiring: (docType: string, days: number) =>
    `GETS: Your ${docType} expires in ${days} days. Upload a new one to stay active.`,

  complianceExpired: (docType: string) =>
    `GETS: Your ${docType} has expired. Your account is now suspended. Upload a new document immediately.`,

  driverArrived: (driverName: string, childName: string) =>
    `GETS: Your driver ${driverName} has arrived for ${childName}. Please be ready. A 3-minute grace applies before waiting charges.`,

  stopMissed: (childName: string, reason: string) =>
    `GETS: ${childName} was not collected on this trip. Reason: ${reason}. Please contact your driver.`,

  waitingChargeAccrued: (childName: string, minutes: number, amountRand: string) =>
    `GETS: A waiting charge of R${amountRand} (${minutes} min) was recorded for ${childName} and will appear on your next invoice.`,
}
