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

export interface ChargeParams {
  parentId: string
  childId: string
  driverId: string
  amountCents: number
  billingMonth: number
  billingYear: number
  reference: string
}

export interface ChargeResult {
  success: boolean
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
