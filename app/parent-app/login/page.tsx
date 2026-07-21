'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PhoneInput } from '@/components/shared/PhoneInput'
import { Button } from '@/components/ui/button'
import { isValidSAPhone, normalizeSAPhone } from '@/lib/utils/validators'
import { Logo } from '@/components/ui/Logo'

export default function ParentLoginPage() {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [devCode, setDevCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
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

      sessionStorage.setItem('otp_phone', normalized)
      sessionStorage.setItem('otp_role', 'PARENT')

      if (data.devCode) {
        sessionStorage.setItem('otp_dev_code', data.devCode)
        setDevCode(data.devCode)
        setCodeSent(true)
      } else {
        router.push('/parent-app/verify')
      }
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="bg-gradient-to-br from-[#ec3d3a] to-[#c81c19] px-6 pt-16 pb-12 flex flex-col items-center text-center">
        <Logo size={80} className="mb-5 rounded-2xl object-contain bg-white p-2" />
        <h1 className="text-3xl font-bold text-white mb-2">GETS</h1>
        <p className="text-white/70 text-base">Safe transport, every day</p>
      </div>

      <div className="flex-1 bg-[#F8F9FB] rounded-t-3xl -mt-4 px-6 pt-8">
        {codeSent ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-[#0F1923] mb-1">Code sent!</h2>
              <p className="text-sm text-[#5A6474]">Use the code below to sign in.</p>
            </div>

            <div className="bg-[#fdc73e] rounded-2xl p-6 text-center shadow-sm">
              <p className="text-sm font-semibold text-[#0F1923] mb-2 uppercase tracking-wide">Your login code</p>
              <p className="text-5xl font-bold tracking-[0.25em] text-[#0F1923]">{devCode}</p>
              <p className="text-xs text-[#0F1923]/60 mt-3">Valid for 5 minutes</p>
            </div>

            <Button
              onClick={() => router.push('/parent-app/verify')}
              className="w-full h-14 text-base font-semibold bg-[#fdc73e] hover:bg-[#fdc73e]/90 text-[#0F1923] rounded-xl"
            >
              Continue to verify →
            </Button>

            <button
              onClick={() => { setCodeSent(false); setDevCode('') }}
              className="w-full text-sm text-[#5A6474] text-center"
            >
              ← Use a different number
            </button>
          </div>
        ) : (
          <>
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
                className="w-full h-14 text-base font-semibold bg-[#fdc73e] hover:bg-[#fdc73e]/90 text-[#0F1923] rounded-xl"
              >
                {loading ? 'Sending code…' : 'Continue →'}
              </Button>
            </form>

            <p className="text-xs text-[#5A6474] text-center mt-8">
              New here? Sign up to add your child and choose a driver.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
