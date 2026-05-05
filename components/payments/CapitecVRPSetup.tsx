'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PhoneInput } from '@/components/shared/PhoneInput'
import { normalizeSAPhone, isValidSAPhone } from '@/lib/utils/validators'
import { Smartphone } from 'lucide-react'

export function CapitecVRPSetup() {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  async function handleSetup() {
    const normalized = normalizeSAPhone(phone)
    if (!isValidSAPhone(normalized)) {
      toast.error('Please enter a valid South African mobile number')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/payments/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'CAPITEC_PAY_VRP', phone: normalized }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Setup failed')

      setCountdown(300) // 5 min
      const interval = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) { clearInterval(interval); intervalRef.current = null; return 0 }
          return c - 1
        })
      }, 1000)
      intervalRef.current = interval

      toast.success('Enrollment request sent. Open your Capitec app to approve.')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 bg-[#1A3F7A]/04 rounded-xl p-3">
        <Smartphone className="w-5 h-5 text-[#1A3F7A] mt-0.5 shrink-0" />
        <p className="text-xs text-[#0F1923]">
          We&apos;ll send a payment approval request to your Capitec app. Open the app within 5 minutes to approve.
        </p>
      </div>

      {countdown > 0 ? (
        <div className="text-center py-4">
          <p className="text-3xl font-bold text-[#1A3F7A] tabular-nums">
            {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
          </p>
          <p className="text-xs text-[#5A6474] mt-1">Open your Capitec app now to approve</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#0F1923]">Your Capitec number</label>
            <PhoneInput value={phone} onChange={setPhone} />
          </div>
          <Button
            onClick={handleSetup}
            disabled={loading || phone.length < 9}
            className="w-full h-12 bg-[#1A3F7A] text-white font-semibold rounded-xl"
          >
            {loading ? 'Sending request…' : 'Set up Capitec Pay'}
          </Button>
        </>
      )}
    </div>
  )
}
