import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getPaymentProvider } from '@/lib/payments'
import { scheduleRetry } from '@/lib/payments/retry'
import { randomUUID } from 'crypto'

const CRON_SECRET = process.env.CRON_SECRET

function isCronAuthorized(request: Request): boolean {
  if (!CRON_SECRET) return false
  return request.headers.get('authorization') === `Bearer ${CRON_SECRET}`
}

async function getConfig(key: string): Promise<string | null> {
  const { data } = await supabase.from('PlatformConfig').select('value').eq('key', key).maybeSingle()
  return data?.value ?? null
}

export async function POST(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const paymentsLive = await getConfig('PAYMENTS_LIVE')
  if (paymentsLive !== 'true') {
    return NextResponse.json({ ok: true, skipped: true, reason: 'PAYMENTS_LIVE is false' })
  }

  const platformFeeCents = parseInt(await getConfig('PLATFORM_FEE_CENTS') ?? '0')
  const tccSplitCents    = parseInt(await getConfig('TCC_SPLIT_CENTS') ?? '0')

  const now = new Date()
  const nowIso = now.toISOString()
  const billingMonth = now.getMonth() + 1
  const billingYear  = now.getFullYear()

  let charged = 0, failed = 0, retried = 0

  // Process overdue retries
  const { data: pendingRetries } = await supabase
    .from('Transaction')
    .select('*, parent:Parent(*), driver:Driver(*)')
    .eq('status', 'RETRY_SCHEDULED')
    .lte('nextRetryAt', nowIso)
    .limit(100)

  for (const tx of pendingRetries ?? []) {
    if (!tx.parent.paymentMethodType) continue
    try {
      const provider = getPaymentProvider(tx.parent.paymentMethodType)
      const result = await provider.chargeMandate({
        parentId: tx.parentId, childId: tx.childId, driverId: tx.driverId,
        amountCents: tx.grossAmountCents, billingMonth: tx.billingMonth,
        billingYear: tx.billingYear, reference: `retry_${tx.id}_${Date.now()}`,
      })

      if (result.success) {
        await supabase.from('Transaction').update({
          status: 'SUCCESS', providerReference: result.providerReference,
          providerChargeId: result.providerChargeId, attemptCount: tx.attemptCount + 1,
          lastAttemptAt: nowIso, nextRetryAt: null, updatedAt: nowIso,
        }).eq('id', tx.id)
        retried++
      } else {
        await supabase.from('Transaction').update({
          attemptCount: tx.attemptCount + 1, failureReason: result.error,
          failureCode: result.errorCode, lastAttemptAt: nowIso, updatedAt: nowIso,
        }).eq('id', tx.id)
        await scheduleRetry(tx.id)
        failed++
      }
    } catch (err) {
      console.error(`[billing] retry error for tx ${tx.id}:`, err)
    }
  }

  // New monthly billing — process in batches of 50
  let offset = 0
  const BATCH_SIZE = 50
  let batchContracts: any[] = []
  let totalProcessed = 0

  do {
    const { data: contracts } = await supabase
      .from('Contract')
      .select('*, parent:Parent(*), driver:Driver(association:Association(*))')
      .eq('status', 'FULLY_SIGNED')
      .range(offset, offset + BATCH_SIZE - 1)
    batchContracts = contracts ?? []
    totalProcessed += batchContracts.length

    for (const contract of batchContracts) {
      const { data: child } = await supabase.from('Child').select('isActive').eq('id', contract.childId).maybeSingle()
      if (!child?.isActive) continue
      const { data: existing } = await supabase
        .from('Transaction')
        .select('id')
        .eq('parentId', contract.parentId)
        .eq('childId', contract.childId)
        .eq('billingMonth', billingMonth)
        .eq('billingYear', billingYear)
        .neq('status', 'CANCELLED')
        .maybeSingle()
      if (existing) continue
      if (!contract.parent.paymentMethodType || !contract.parent.isPaymentSetup) continue

      const grossAmountCents     = contract.monthlyAmountCents
      const gatewayFeeCents      = Math.round(grossAmountCents * 0.015) + 200
      const associationLevyCents = contract.driver.association?.monthlyLevy ?? 0
      const driverNetCents       = grossAmountCents - gatewayFeeCents - platformFeeCents - associationLevyCents - tccSplitCents
      const reference            = `bill_${contract.id}_${billingYear}${String(billingMonth).padStart(2, '0')}_${randomUUID().slice(0, 8)}`

      const { data: tx } = await supabase.from('Transaction').insert({
        id: randomUUID(), parentId: contract.parentId, driverId: contract.driverId,
        childId: contract.childId, billingMonth, billingYear,
        grossAmountCents, gatewayFeeCents, platformFeeCents, associationLevyCents,
        tccSplitCents, driverNetCents, paymentMethodType: contract.parent.paymentMethodType,
        status: 'PENDING', providerReference: reference, attemptCount: 0,
        createdAt: nowIso, updatedAt: nowIso,
      }).select().single()

      try {
        const provider = getPaymentProvider(contract.parent.paymentMethodType)
        const result = await provider.chargeMandate({
          parentId: contract.parentId, childId: contract.childId, driverId: contract.driverId,
          amountCents: grossAmountCents, billingMonth, billingYear, reference,
        })
        if (result.success) {
          await supabase.from('Transaction').update({
            status: 'SUCCESS', providerReference: result.providerReference ?? reference,
            providerChargeId: result.providerChargeId, attemptCount: 1,
            lastAttemptAt: nowIso, updatedAt: nowIso,
          }).eq('id', tx.id)
          charged++
        } else {
          await supabase.from('Transaction').update({
            status: 'FAILED', failureReason: result.error, failureCode: result.errorCode,
            attemptCount: 1, lastAttemptAt: nowIso, updatedAt: nowIso,
          }).eq('id', tx.id)
          await scheduleRetry(tx.id)
          failed++
        }
      } catch (err) {
        console.error(`[billing] charge error for contract ${contract.id}:`, err)
        await supabase.from('Transaction').update({
          status: 'FAILED', failureReason: String(err),
          attemptCount: 1, lastAttemptAt: nowIso, updatedAt: nowIso,
        }).eq('id', tx.id)
        await scheduleRetry(tx.id)
        failed++
      }
    }

    offset += BATCH_SIZE
  } while (totalProcessed < offset)

  return NextResponse.json({ ok: true, charged, failed, retried })
}
