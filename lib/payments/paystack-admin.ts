/**
 * Paystack account management via the secret key — no dashboard required.
 *
 * Everything we create on Paystack is namespaced and traceable: subaccounts are
 * named `AccidentAngels — <party>` and carry a `metadata.ref` back to the row
 * that owns them, so the Paystack account stays organised and auditable.
 */
const PAYSTACK_BASE = 'https://api.paystack.co'

async function paystackRequest<T>(
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  try {
    const res = await fetch(`${PAYSTACK_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
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

/** Authoritative status of a charge — used by the reconciliation cron. */
export interface VerifyResult {
  status: string // 'success' | 'failed' | 'abandoned' | 'pending' | ...
  amount: number
  reference: string
  id: number
}

export async function verifyTransaction(reference: string): Promise<VerifyResult> {
  return paystackRequest<VerifyResult>('GET', `/transaction/verify/${encodeURIComponent(reference)}`)
}

export interface PaystackBank {
  name: string
  code: string
  currency: string
}

/** List settlement banks for a currency (ZA by default). Populates the UI picker. */
export async function listBanks(currency = 'ZAR'): Promise<PaystackBank[]> {
  const banks = await paystackRequest<PaystackBank[]>('GET', `/bank?currency=${encodeURIComponent(currency)}`)
  return banks.map(b => ({ name: b.name, code: b.code, currency: b.currency }))
}

export interface SubAccountInput {
  /** party/driver/association label — becomes part of the Paystack business_name */
  displayName: string
  bankCode: string
  accountNumber: string
  /** our owning-row reference, stored in metadata for traceability */
  ownerRef: string
  /** default per-transaction share Paystack applies if we DON'T send an inline
   * split. We always send inline flat splits, so this stays 0. */
  percentageCharge?: number
}

export interface SubAccount {
  subaccount_code: string
  id: number
  business_name: string
  account_number: string
  settlement_bank: string
  active: boolean
}

/** Create a subaccount (a payout destination) for a party. */
export async function createSubAccount(input: SubAccountInput): Promise<SubAccount> {
  return paystackRequest<SubAccount>('POST', '/subaccount', {
    business_name: `AccidentAngels — ${input.displayName}`,
    settlement_bank: input.bankCode,
    account_number: input.accountNumber,
    percentage_charge: input.percentageCharge ?? 0,
    metadata: { ref: input.ownerRef, source: 'accident-angels-splits' },
  })
}

export async function updateSubAccount(code: string, patch: Partial<SubAccountInput>): Promise<SubAccount> {
  const body: Record<string, unknown> = {}
  if (patch.displayName) body.business_name = `AccidentAngels — ${patch.displayName}`
  if (patch.bankCode) body.settlement_bank = patch.bankCode
  if (patch.accountNumber) body.account_number = patch.accountNumber
  if (patch.percentageCharge !== undefined) body.percentage_charge = patch.percentageCharge
  return paystackRequest<SubAccount>('PUT', `/subaccount/${code}`, body)
}

/** List every subaccount on the Paystack account — for reconciliation / audit. */
export async function listSubAccounts(): Promise<SubAccount[]> {
  return paystackRequest<SubAccount[]>('GET', '/subaccount?perPage=100')
}
