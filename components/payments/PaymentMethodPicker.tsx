'use client'

import { useState } from 'react'
import { Smartphone, CreditCard, FileText } from 'lucide-react'
import { PaystackCardSetup } from './PaystackCardSetup'
import { cn } from '@/lib/utils'

type Method = 'CAPITEC_PAY_VRP' | 'PAYSTACK_CARD' | 'DEBICHECK' | null

export function PaymentMethodPicker() {
  const [selected, setSelected] = useState<Method>(null)

  const options = [
    {
      id: 'CAPITEC_PAY_VRP' as Method,
      icon: <Smartphone className="w-5 h-5" />,
      title: 'Capitec Pay',
      desc: 'Recurring debit via your Capitec app. Most popular.',
      recommended: true,
      enabled: false,
    },
    {
      id: 'PAYSTACK_CARD' as Method,
      icon: <CreditCard className="w-5 h-5" />,
      title: 'Debit or credit card',
      desc: 'Visa, Mastercard. Card is securely stored for monthly billing.',
      recommended: false,
      enabled: true,
    },
    {
      id: 'DEBICHECK' as Method,
      icon: <FileText className="w-5 h-5" />,
      title: 'Debit order (DebiCheck)',
      desc: 'Bank-to-bank recurring debit. Confirm via your bank app.',
      recommended: false,
      enabled: false,
    },
  ]

  return (
    <div className="space-y-3">
      {options.map(opt => (
        <div key={opt.id as string}>
          <button
            onClick={() => setSelected(selected === opt.id ? null : opt.id)}
            className={cn(
              'w-full text-left rounded-2xl p-4 border-2 transition-colors',
              selected === opt.id
                ? 'border-[#ec3d3a] bg-[#ec3d3a]/04'
                : 'border-[rgba(236,61,58,0.15)] bg-white'
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                selected === opt.id ? 'bg-[#ec3d3a] text-white' : 'bg-[#ec3d3a]/10 text-[#ec3d3a]'
              )}>
                {opt.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm text-[#0F1923]">{opt.title}</p>
                  {opt.recommended && (
                    <span className="text-xs bg-[#fdc73e]/20 text-[#fdc73e] px-1.5 py-0.5 rounded font-medium">
                      Popular
                    </span>
                  )}
                  {!opt.enabled && (
                    <span className="text-xs bg-[#5A6474]/10 text-[#5A6474] px-1.5 py-0.5 rounded font-medium">
                      Coming soon
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#5A6474] mt-0.5">{opt.desc}</p>
              </div>
            </div>
          </button>

          {selected === opt.id && (
            <div className="mt-2 rounded-2xl border border-[rgba(236,61,58,0.15)] bg-white p-4">
              {opt.id === 'PAYSTACK_CARD' && <PaystackCardSetup />}
              {(opt.id === 'CAPITEC_PAY_VRP' || opt.id === 'DEBICHECK') && (
                <p className="text-sm text-center text-[#5A6474] py-4">
                  This payment method is coming soon. In the meantime, please use a debit or credit card.
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
