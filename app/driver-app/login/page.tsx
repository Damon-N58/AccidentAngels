'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PhoneInput } from '@/components/shared/PhoneInput'
import { Button } from '@/components/ui/button'
import { isValidSAPhone, normalizeSAPhone } from '@/lib/utils/validators'

export default function DriverLoginPage() {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const normalized = normalizeSAPhone(phone)
    if (!isValidSAPhone(normalized)) {
      toast.error('Please enter a valid South African mobile number')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalized, purpose: 'login', role: 'DRIVER' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to send code')

      if (data.devCode) {
        toast(`Dev OTP: ${data.devCode}`, { duration: 20000, description: 'Auto-hides in 20s' })
        setTimeout(() => toast.dismiss(), 20000)
      }

      sessionStorage.setItem('otp_phone', normalized)
      sessionStorage.setItem('otp_role', 'DRIVER')
      router.push('/verify')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#1A3F7A] flex flex-col">
      {/* Header */}
      <div className="flex flex-col items-center pt-16 pb-8 px-6">
        <img src="/logos/wings-icon.svg" alt="Accident Angels" className="w-16 h-16 mb-4" />
        <h1 className="text-2xl font-bold text-white">Angels Driver</h1>
        <p className="text-white/70 text-sm mt-1">Your compliance dashboard</p>
      </div>

      {/* Card */}
      <div className="flex-1 bg-[#F8F9FB] rounded-t-3xl px-6 pt-8">
        <h2 className="text-xl font-bold text-[#0F1923] mb-1">Sign in</h2>
        <p className="text-sm text-[#5A6474] mb-8">Enter your mobile number to get a code</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-[#0F1923] mb-2">
              Mobile number
            </label>
            <PhoneInput value={phone} onChange={setPhone} disabled={loading} />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-14 text-base font-semibold bg-[#1A3F7A] hover:bg-[#1A3F7A]/90 text-white rounded-xl"
          >
            {loading ? 'Sending code…' : 'Get code →'}
          </Button>
        </form>

        <p className="text-xs text-[#5A6474] text-center mt-8">
          A 6-digit code will be sent to your number via SMS.
          <br />By continuing you agree to our Terms of Service.
        </p>
      </div>
    </div>
  )
}
