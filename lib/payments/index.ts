import type { PaymentMethodType, PaymentProvider } from './types'
import { PaystackCardProvider } from './providers/paystack-card'
import { DebiCheckProvider } from './providers/debicheck'
import { CapitecPayVRPProvider } from './providers/capitec-pay-vrp'

export function getPaymentProvider(type: PaymentMethodType): PaymentProvider {
  switch (type) {
    case 'PAYSTACK_CARD':   return new PaystackCardProvider()
    case 'DEBICHECK':       return new DebiCheckProvider()
    case 'CAPITEC_PAY_VRP': return new CapitecPayVRPProvider()
    default:
      throw new Error(`Unknown payment method type: ${type}`)
  }
}
