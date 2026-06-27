import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendSms, smsTemplates } from '@/lib/sms/africas-talking'
import { addDays } from 'date-fns'

// Requires CRON_SECRET env var — set in Vercel dashboard and locally in .env.local
const CRON_SECRET = process.env.CRON_SECRET

function isCronAuthorized(request: Request): boolean {
  if (!CRON_SECRET) return false
  return request.headers.get('authorization') === `Bearer ${CRON_SECRET}`
}

async function getLastRun(): Promise<string> {
  const { data } = await supabase
    .from('PlatformConfig')
    .select('value')
    .eq('key', 'CRON_CHECK_EXPIRY_LAST_RUN')
    .maybeSingle()
  return data?.value ?? new Date(0).toISOString()
}

async function setLastRun(iso: string): Promise<void> {
  await supabase
    .from('PlatformConfig')
    .upsert(
      { id: crypto.randomUUID(), key: 'CRON_CHECK_EXPIRY_LAST_RUN', value: iso },
      { onConflict: 'key' }
    )
}

export async function POST(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const in30Days = addDays(now, 30).toISOString()
  let notified = 0
  let expired  = 0
  let skipped  = 0

  try {
    // Check if we ran recently (dedup across cold starts)
    const lastRun = await getLastRun()
    if (lastRun && Date.now() - new Date(lastRun).getTime() < 12 * 60 * 60 * 1000) {
      skipped = 1
      return NextResponse.json({ ok: true, notified, expired, skipped, reason: 'Already ran recently' })
    }

    // Docs expiring within 30 days
    const { data: expiring } = await supabase
      .from('ComplianceDocument')
      .select('id, type, driverId, expiryDate, driver:Driver(user:User(id, phone))')
      .eq('status', 'APPROVED')
      .gte('expiryDate', now.toISOString())
      .lte('expiryDate', in30Days)

    type ExpiringRow = { id: string; type: string; driverId: string; expiryDate: string; driver: { user: { id: string; phone: string } } }
    for (const doc of (expiring ?? []) as unknown as ExpiringRow[]) {
      const daysLeft = Math.ceil((new Date(doc.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      // Only fire at specific threshold windows to avoid daily spam
      let thresholdDays: number | null = null
      if (daysLeft >= 29 && daysLeft <= 30) thresholdDays = 30
      else if (daysLeft >= 13 && daysLeft <= 14) thresholdDays = 14
      else if (daysLeft >= 6  && daysLeft <= 7)  thresholdDays = 7
      else if (daysLeft >= 0  && daysLeft <= 1)  thresholdDays = 1

      if (thresholdDays !== null) {
        const docLabel = doc.type.replace(/_/g, ' ')
        const smsBody  = smsTemplates.complianceExpiring(docLabel, thresholdDays)
        await sendSms(doc.driver.user.phone, smsBody)

        // Non-blocking in-app notification
        try {
          await supabase.from('Notification').insert({
            userId:   doc.driver.user.id,
            type:     'COMPLIANCE_EXPIRY_WARNING',
            title:    'Document expiring soon',
            body:     smsBody,
            metadata: { docType: doc.type, daysLeft, docId: doc.id },
          })
        } catch (notifErr) {
          console.error('[cron/check-expiry] Notification insert failed (expiring):', notifErr)
        }

        notified++
      }
    }

    // Docs that have expired
    const { data: justExpired } = await supabase
      .from('ComplianceDocument')
      .select('id, type, driverId, driver:Driver(id, status, user:User(id, phone))')
      .eq('status', 'APPROVED')
      .lt('expiryDate', now.toISOString())

    type ExpiredRow = { id: string; type: string; driverId: string; driver: { status: string; user: { id: string; phone: string } } }
    const updateNow = now.toISOString()
    for (const doc of (justExpired ?? []) as unknown as ExpiredRow[]) {
      await supabase.from('ComplianceDocument').update({ status: 'EXPIRED', updatedAt: updateNow }).eq('id', doc.id)

      if (doc.driver.status === 'ACTIVE') {
        await supabase.from('Driver').update({ status: 'SUSPENDED', updatedAt: updateNow }).eq('id', doc.driverId)
      }

      const expiredSmsBody = smsTemplates.complianceExpired(doc.type.replace(/_/g, ' '))
      await sendSms(doc.driver.user.phone, expiredSmsBody)

      // Non-blocking in-app notification
      try {
        await supabase.from('Notification').insert({
          userId:   doc.driver.user.id,
          type:     'COMPLIANCE_EXPIRED',
          title:    'Document expired',
          body:     expiredSmsBody,
          metadata: { docType: doc.type, daysLeft: 0, docId: doc.id },
        })
      } catch (notifErr) {
        console.error('[cron/check-expiry] Notification insert failed (expired):', notifErr)
      }

      expired++
    }

    await setLastRun(now.toISOString())

    return NextResponse.json({ ok: true, notified, expired, skipped })
  } catch (err) {
    console.error('[cron/check-expiry]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
