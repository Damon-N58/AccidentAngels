import { Smartphone, CreditCard, FileText } from 'lucide-react'

type MethodType = 'PAYSTACK_CARD' | 'DEBICHECK' | 'CAPITEC_PAY_VRP'

const CFG: Record<MethodType, { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
  PAYSTACK_CARD:   { label: 'Card',         Icon: CreditCard  },
  DEBICHECK:       { label: 'DebiCheck',    Icon: FileText    },
  CAPITEC_PAY_VRP: { label: 'Capitec Pay',  Icon: Smartphone  },
}

export function PaymentMethodBadge({ type }: { type: MethodType }) {
  const { label, Icon } = CFG[type] ?? CFG.PAYSTACK_CARD
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0F6E56]/10 text-[#0F6E56] text-xs font-semibold">
      <Icon className="w-3 h-3" />
      {label}
    </span>
  )
}
