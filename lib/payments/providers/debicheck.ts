import type { PaymentProvider, SetupParams, SetupResult, ChargeParams, ChargeResult, CancelParams } from '../types'

export class DebiCheckProvider implements PaymentProvider {
  methodType = 'DEBICHECK' as const

  async setupMandate(_params: SetupParams): Promise<SetupResult> {
    throw new Error('DebiCheck not yet implemented. Set DEBICHECK_ENABLED=false.')
  }

  async chargeMandate(_params: ChargeParams): Promise<ChargeResult> {
    throw new Error('DebiCheck not yet implemented.')
  }

  async cancelMandate(_params: CancelParams): Promise<void> {
    throw new Error('DebiCheck not yet implemented.')
  }
}
