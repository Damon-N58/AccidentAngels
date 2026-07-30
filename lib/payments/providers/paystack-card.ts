import type { PaymentProvider, SetupParams, SetupResult, ChargeParams, ChargeResult, CancelParams } from '../types'

const PAYSTACK_BASE = 'https://api.paystack.co'

// Paystack charge statuses that mean money DEFINITIVELY did not move, so a
// re-charge (under a fresh reference) is safe. Every OTHER non-success status
// — 'pending', 'ongoing', 'processing', 'queued', or anything unrecognised —
// is NOT settled and may still resolve to success; those must be treated as
// UNKNOWN so the charge is left on its reference for the reconcile cron rather
// than blindly re-charged (which would double-charge once the pending settles).
const DEFINITIVE_DECLINE_STATUSES = new Set(['failed', 'abandoned', 'reversed'])

// Paystack checkout channels offered during payment-method setup. Configurable
// via env (comma-separated) so Capitec Pay can be enabled once confirmed on the
// Paystack account; defaults to card only.
const PAYSTACK_CHANNELS = (process.env.PAYSTACK_CHANNELS ?? 'card')
  .split(',')
  .map(c => c.trim())
  .filter(Boolean)

async function paystackRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>
): Promise<T> {
  // Bounded timeout: a hung Paystack connection must not block the whole billing
  // run until the platform hard-kills it. Callers treat an abort as UNKNOWN, not
  // a definitive failure, so they never blind re-charge on a timeout.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  try {
    const res = await fetch(`${PAYSTACK_BASE}${path}`, {
      method,
      headers: {
        Authorization:  `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    const data = await res.json()
    if (!res.ok || !data.status) {
      throw new Error(data.message ?? `Paystack error: HTTP ${res.status}`)
    }
    return data.data as T
  } finally {
    clearTimeout(timer)
  }
}

export class PaystackCardProvider implements PaymentProvider {
  methodType = 'PAYSTACK_CARD' as const

  async setupMandate(params: SetupParams): Promise<SetupResult> {
    try {
      const reference = `setup_${params.parentId}_${Date.now()}`
      const data = await paystackRequest<{ authorization_url: string; reference: string }>(
        'POST',
        '/transaction/initialize',
        {
          email:    params.email ?? `${params.phone.replace('+', '')}@acc-angels.placeholder`,
          amount:   50,
          reference,
          metadata: { parentId: params.parentId, purpose: 'card_setup' },
          // Checkout channels are configurable so Capitec Pay (and other
          // Paystack ZA channels) can be offered without a code change — set
          // PAYSTACK_CHANNELS, e.g. "card,capitec". Defaults to card only.
          // NOTE: recurring monthly billing reuses the authorization_code from
          // this setup; confirm in test mode that a chosen channel returns a
          // reusable authorization before relying on it for unattended debits.
          channels: PAYSTACK_CHANNELS,
        }
      )
      return { success: true, authorizationUrl: data.authorization_url, reference: data.reference }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }

  async chargeMandate(params: ChargeParams): Promise<ChargeResult> {
    try {
      const { supabase } = await import('../../supabase')
      const { data: parent } = await supabase
        .from('Parent')
        .select('paystackAuthorizationCode, paystackAuthorizationEmail')
        .eq('id', params.parentId)
        .maybeSingle()

      if (!parent?.paystackAuthorizationCode || !parent.paystackAuthorizationEmail) {
        // Definitive: nothing was charged (we never called the gateway).
        return { success: false, outcome: 'failed', error: 'No authorization on file' }
      }

      const data = await paystackRequest<{ reference: string; id: number; status?: string; gateway_response?: string }>(
        'POST',
        '/transaction/charge_authorization',
        {
          authorization_code: parent.paystackAuthorizationCode,
          email:              parent.paystackAuthorizationEmail,
          amount:             params.amountCents,
          reference:          params.reference,
          // Inline multi-party split — routes each party's cut to its
          // subaccount; the rest settles to the main account. Omitted when
          // no party has a subaccount configured yet (params.split == null).
          ...(params.split ? { split: params.split } : {}),
          metadata: {
            parentId:     params.parentId,
            childId:      params.childId,
            driverId:     params.driverId,
            billingMonth: params.billingMonth,
            billingYear:  params.billingYear,
          },
        }
      )

      // CRITICAL: charge_authorization returns HTTP 200 + envelope status:true
      // even for a DECLINED card — the real outcome is data.status. Only a
      // 'success' means money moved. A definitive decline ('failed' etc.) is
      // safe to retry; anything else ('pending'/'ongoing'/'queued') is NOT
      // settled — treat it as UNKNOWN so it is never booked or re-charged.
      if (data.status !== 'success') {
        const definitiveDecline = data.status ? DEFINITIVE_DECLINE_STATUSES.has(data.status) : false
        return {
          success:   false,
          // Only a definitive decline may be retried under a fresh reference;
          // an unsettled status must be reconciled against THIS reference.
          outcome:   definitiveDecline ? 'failed' : 'unknown',
          error:     data.gateway_response ?? `Charge ${data.status ?? 'not successful'}`,
          errorCode: data.status ?? 'unknown',
        }
      }

      return {
        success:           true,
        outcome:           'success',
        providerReference: data.reference,
        providerChargeId:  String(data.id),
      }
    } catch (err) {
      // We never received a definitive success/failed envelope (timeout, abort,
      // network error, or non-2xx from paystackRequest). The charge MAY have
      // landed at Paystack — treat as UNKNOWN so the caller leaves it for the
      // reconcile cron to verify against this reference, never blind re-charging.
      return { success: false, outcome: 'unknown', error: (err as Error).message }
    }
  }

  async cancelMandate(_params: CancelParams): Promise<void> {
    // No server-side cancel needed for Paystack card
  }
}
