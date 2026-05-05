import type { PaymentProvider, SetupParams, SetupResult, ChargeParams, ChargeResult, CancelParams } from '../types'

const PAYSTACK_BASE = 'https://api.paystack.co'

async function paystackRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    method,
    headers: {
      Authorization:  `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json()
  if (!res.ok || !data.status) {
    throw new Error(data.message ?? `Paystack error: HTTP ${res.status}`)
  }
  return data.data as T
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
          channels: ['card'],
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
        return { success: false, error: 'No authorization on file' }
      }

      const data = await paystackRequest<{ reference: string; id: number }>(
        'POST',
        '/transaction/charge_authorization',
        {
          authorization_code: parent.paystackAuthorizationCode,
          email:              parent.paystackAuthorizationEmail,
          amount:             params.amountCents,
          reference:          params.reference,
          metadata: {
            parentId:     params.parentId,
            childId:      params.childId,
            driverId:     params.driverId,
            billingMonth: params.billingMonth,
            billingYear:  params.billingYear,
          },
        }
      )

      return {
        success:           true,
        providerReference: data.reference,
        providerChargeId:  String(data.id),
      }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }

  async cancelMandate(_params: CancelParams): Promise<void> {
    // No server-side cancel needed for Paystack card
  }
}
