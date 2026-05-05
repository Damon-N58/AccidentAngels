import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendSms, smsTemplates } from '@/lib/sms/africas-talking'
import { addDays } from 'date-fns'

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
      .select('*, driver:Driver(user:User(*))')
      .eq('status', 'APPROVED')
      .gte('expiryDate', now.toISOString())
      .lte('expiryDate', in30Days)

    for (const doc of expiring ?? []) {
      const daysLeft = Math.ceil((new Date(doc.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (daysLeft <= 7 || daysLeft <= 30) {
        await sendSms(doc.driver.user.phone, smsTemplates.complianceExpiring(doc.type.replace(/_/g, ' '), daysLeft))
        notified++
      }
    }

    // Docs that have expired
    const { data: justExpired } = await supabase
      .from('ComplianceDocument')
      .select('*, driver:Driver(*, user:User(*))')
      .eq('status', 'APPROVED')
      .lt('expiryDate', now.toISOString())

    const updateNow = now.toISOString()
    for (const doc of justExpired ?? []) {
      await supabase.from('ComplianceDocument').update({ status: 'EXPIRED', updatedAt: updateNow }).eq('id', doc.id)

      if (doc.driver.status === 'ACTIVE') {
        await supabase.from('Driver').update({ status: 'SUSPENDED', updatedAt: updateNow }).eq('id', doc.driverId)
      }

      await sendSms(doc.driver.user.phone, smsTemplates.complianceExpired(doc.type.replace(/_/g, ' ')))
      expired++
    }

    await setLastRun(now.toISOString())

    return NextResponse.json({ ok: true, notified, expired, skipped })
  } catch (err) {
    console.error('[cron/check-expiry]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
