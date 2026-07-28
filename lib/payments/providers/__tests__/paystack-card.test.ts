import { describe, it, expect, vi, beforeEach } from 'vitest'

// The provider looks up the parent's authorization via the Supabase client
// (dynamic import of ../../supabase). Mock it to a parent that has a card on file.
vi.mock('../../../supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: {
                paystackAuthorizationCode: 'AUTH_xyz',
                paystackAuthorizationEmail: 'parent@example.com',
              },
            }),
        }),
      }),
    }),
  },
}))

import { PaystackCardProvider } from '../paystack-card'

const params = {
  parentId: 'p1',
  childId: 'c1',
  driverId: 'd1',
  amountCents: 150_00,
  billingMonth: 7,
  billingYear: 2026,
  reference: 'bill_c1_202607',
}

beforeEach(() => {
  process.env.PAYSTACK_SECRET_KEY = 'sk_test_x'
  vi.unstubAllGlobals()
})

describe('PaystackCardProvider.chargeMandate outcome classification', () => {
  it('returns outcome=success when the gateway settles the charge', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: true, data: { status: 'success', reference: 'r1', id: 42 } }),
      }),
    )
    const r = await new PaystackCardProvider().chargeMandate(params)
    expect(r.success).toBe(true)
    expect(r.outcome).toBe('success')
    expect(r.providerReference).toBe('r1')
  })

  it('returns outcome=failed on a definitive decline (money did NOT move)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: true, data: { status: 'failed', gateway_response: 'Declined' } }),
      }),
    )
    const r = await new PaystackCardProvider().chargeMandate(params)
    expect(r.success).toBe(false)
    expect(r.outcome).toBe('failed')
  })

  it('returns outcome=unknown on a timeout/abort — must never be re-charged blindly', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })),
    )
    const r = await new PaystackCardProvider().chargeMandate(params)
    expect(r.success).toBe(false)
    expect(r.outcome).toBe('unknown')
  })

  it('returns outcome=unknown on a non-2xx gateway response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => ({}) }),
    )
    const r = await new PaystackCardProvider().chargeMandate(params)
    expect(r.success).toBe(false)
    expect(r.outcome).toBe('unknown')
  })
})
