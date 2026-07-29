export type PaymentMethodType = 'PAYSTACK_CARD' | 'DEBICHECK' | 'CAPITEC_PAY_VRP'

export interface SetupParams {
  parentId: string
  phone: string
  email?: string
  amount?: number // cents
}

export interface SetupResult {
  success: boolean
  authorizationUrl?: string  // redirect URL if needed
  reference?: string
  error?: string
}

import type { PaystackSplitPayload } from './splits'

export interface ChargeParams {
  parentId: string
  childId: string
  driverId: string
  amountCents: number
  billingMonth: number
  billingYear: number
  reference: string
  /**
   * Optional gateway-level split. Providers that support it (Paystack card)
   * route money to subaccounts at charge time; providers that don't (DebiCheck,
   * Capitec VRP) ignore it — the accounting split still applies via
   * TransactionSplit records.
   */
  split?: PaystackSplitPayload
}

export interface ChargeResult {
  success: boolean
  /**
   * Definitive outcome of the charge attempt:
   *  - 'success' — money moved.
   *  - 'failed'  — a definitive gateway decline (money did NOT move); safe to retry.
   *  - 'unknown' — timeout / network / pre-charge error; the charge MAY have
   *                landed. Callers must NOT re-charge; leave the row for the
   *                reconcile cron to verify against the gateway.
   * Absent implies 'failed' for backwards compatibility.
   */
  outcome?: 'success' | 'failed' | 'unknown'
  providerReference?: string
  providerChargeId?: string
  error?: string
  errorCode?: string
}

export interface CancelParams {
  parentId: string
  reference: string
}

export interface PaymentProvider {
  methodType: PaymentMethodType
  setupMandate(params: SetupParams): Promise<SetupResult>
  chargeMandate(params: ChargeParams): Promise<ChargeResult>
  cancelMandate(params: CancelParams): Promise<void>
}
