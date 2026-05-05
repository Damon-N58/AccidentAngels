import type { PaymentProvider, SetupParams, SetupResult, ChargeParams, ChargeResult, CancelParams } from '../types'

export class CapitecPayVRPProvider implements PaymentProvider {
  methodType = 'CAPITEC_PAY_VRP' as const

  async setupMandate(_params: SetupParams): Promise<SetupResult> {
    throw new Error('Capitec Pay VRP not yet implemented. Set CAPITEC_VRP_ENABLED=false.')
  }

  async chargeMandate(_params: ChargeParams): Promise<ChargeResult> {
    throw new Error('Capitec Pay VRP not yet implemented.')
  }

  async cancelMandate(_params: CancelParams): Promise<void> {
    throw new Error('Capitec Pay VRP not yet implemented.')
  }
}
