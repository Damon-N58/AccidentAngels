'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { OtpInput } from '@/components/shared/OtpInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function AdminLoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [devCode, setDevCode] = useState('')

  async function sendOtp() {
    if (!phone.trim()) { toast.error('Enter your phone number'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, purpose: 'admin_login' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to send code')
      if (data.devCode) setDevCode(data.devCode)
      setStep('otp')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify() {
    if (otp.length !== 6) return
    setLoading(true)
    try {
      const res = await fetch('/api/auth/admin-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: otp }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Invalid code')
      router.push('/admin/dashboard')
    } catch (err) {
      toast.error((err as Error).message)
      setOtp('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#1A3F7A] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logos/wings-icon.svg" alt="Accident Angels" className="w-14 h-14 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white">Admin Portal</h1>
          <p className="text-white/60 text-sm mt-1">Sign in to manage the platform</p>
        </div>

        <div className="bg-white rounded-2xl p-6 space-y-5">
          {step === 'phone' ? (
            <>
              <div className="space-y-2">
                <Label>Phone number</Label>
                <Input
                  type="tel"
                  placeholder="+27 12 345 6789"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="h-12"
                  autoFocus
                />
              </div>
              <Button
                onClick={sendOtp}
                disabled={loading || phone.length < 5}
                className="w-full h-12 bg-[#1A3F7A] hover:bg-[#1A3F7A]/90 text-white font-semibold rounded-xl"
              >
                {loading ? 'Sending code…' : 'Sign in →'}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-center text-[#5A6474]">
                Enter the code sent to {phone}
              </p>
              <OtpInput value={otp} onChange={setOtp} disabled={loading} />
              {devCode && (
                <p className="text-xs text-center text-[#5A6474] bg-[#F5A623]/10 rounded-lg p-2">
                  Dev OTP: {devCode}
                </p>
              )}
              <Button
                onClick={handleVerify}
                disabled={otp.length !== 6 || loading}
                className="w-full h-12 bg-[#1A3F7A] hover:bg-[#1A3F7A]/90 text-white font-semibold rounded-xl"
              >
                {loading ? 'Verifying…' : 'Verify →'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
