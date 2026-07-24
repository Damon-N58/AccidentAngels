'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PhoneInput } from '@/components/shared/PhoneInput'
import { Button } from '@/components/ui/button'
import { isValidSAPhone, normalizeSAPhone } from '@/lib/utils/validators'
import { Logo } from '@/components/ui/Logo'

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

      sessionStorage.setItem('otp_phone', normalized)
      sessionStorage.setItem('otp_role', 'DRIVER')
      router.push('/driver-app/verify')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#ec3d3a] flex flex-col">
      <div className="flex flex-col items-center pt-16 pb-8 px-6">
        <Logo size={80} className="mb-4 rounded-2xl object-contain bg-white p-2" />
        <h1 className="text-2xl font-bold text-white">GETS Driver</h1>
        <p className="text-white/70 text-sm mt-1">Your compliance dashboard</p>
      </div>

      <div className="flex-1 bg-[#F8F9FB] rounded-t-3xl px-6 pt-8">
        <h2 className="text-2xl font-bold text-[#0F1923] mb-1">Sign in</h2>
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
            className="w-full h-14 text-base font-semibold bg-[#ec3d3a] hover:bg-[#ec3d3a]/90 text-white rounded-xl"
          >
            {loading ? 'Sending code…' : 'Get code →'}
          </Button>
        </form>

        <p className="text-sm text-[#5A6474] text-center mt-8">
          A 6-digit code will be sent to your number via WhatsApp.
          <br />By continuing you agree to our Terms of Service.
        </p>
      </div>
    </div>
  )
}
