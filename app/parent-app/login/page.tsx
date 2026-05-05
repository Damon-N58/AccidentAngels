'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PhoneInput } from '@/components/shared/PhoneInput'
import { Button } from '@/components/ui/button'
import { isValidSAPhone, normalizeSAPhone } from '@/lib/utils/validators'

export default function ParentLoginPage() {
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
        body: JSON.stringify({ phone: normalized, purpose: 'login', role: 'PARENT' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to send code')

      if (data.devCode) {
        toast(`Dev OTP: ${data.devCode}`, { duration: 20000, description: 'Auto-hides in 20s' })
        setTimeout(() => toast.dismiss(), 20000)
      }

      sessionStorage.setItem('otp_phone', normalized)
      sessionStorage.setItem('otp_role', 'PARENT')
      router.push('/parent-app/verify')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#1A3F7A] to-[#0F2A52] px-6 pt-16 pb-12 flex flex-col items-center text-center">
        <img src="/logos/wings-icon.svg" alt="Angels" className="w-20 h-20 mb-5" />
        <h1 className="text-3xl font-bold text-white mb-2">Angels</h1>
        <p className="text-white/70 text-base">Safe transport, every day</p>
      </div>

      {/* Form card */}
      <div className="flex-1 bg-[#F8F9FB] rounded-t-3xl -mt-4 px-6 pt-8">
        <h2 className="text-xl font-bold text-[#0F1923] mb-1">Welcome back</h2>
        <p className="text-sm text-[#5A6474] mb-8">Enter your number to sign in</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-[#0F1923] mb-2">Mobile number</label>
            <PhoneInput value={phone} onChange={setPhone} disabled={loading} />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-14 text-base font-semibold bg-[#F5A623] hover:bg-[#F5A623]/90 text-[#0F1923] rounded-xl"
          >
            {loading ? 'Sending code…' : 'Continue →'}
          </Button>
        </form>

        <p className="text-xs text-[#5A6474] text-center mt-8">
          New here? Sign up to add your child and choose a driver.
        </p>
      </div>
    </div>
  )
}
