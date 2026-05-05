'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { CreditCard, Lock } from 'lucide-react'

export function PaystackCardSetup() {
  const [loading, setLoading] = useState(false)

  async function handleSetup() {
    setLoading(true)
    try {
      const res = await fetch('/api/payments/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'PAYSTACK_CARD' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Setup failed')
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl
      }
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 bg-[#1A3F7A]/04 rounded-xl p-3">
        <Lock className="w-4 h-4 text-[#1A3F7A] mt-0.5 shrink-0" />
        <p className="text-xs text-[#0F1923]">
          You&apos;ll be redirected to a secure Paystack page to enter your card details.
          A R0.50 verification charge is made and immediately refunded.
        </p>
      </div>
      <Button
        onClick={handleSetup}
        disabled={loading}
        className="w-full h-12 bg-[#1A3F7A] text-white font-semibold rounded-xl flex items-center gap-2"
      >
        <CreditCard className="w-4 h-4" />
        {loading ? 'Redirecting…' : 'Add debit / credit card'}
      </Button>
    </div>
  )
}
