'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { OtpInput } from '@/components/shared/OtpInput'
import { Button } from '@/components/ui/button'
import { formatPhone } from '@/lib/utils/formatters'

export default function ParentVerifyPage() {
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(30)
  const [phone, setPhone] = useState('')
  const router = useRouter()
  const verifyingRef = useRef(false)

  useEffect(() => {
    const p = sessionStorage.getItem('otp_phone')
    if (!p) { router.replace('/parent-app/login'); return }
    setPhone(p)
  }, [router])

  useEffect(() => {
    if (resendTimer <= 0) return
    const t = setInterval(() => setResendTimer(s => s - 1), 1000)
    return () => clearInterval(t)
  }, [resendTimer])

  async function handleVerify() {
    // Prevent double-fire from React 18 Strict Mode or rapid typing
    if (verifyingRef.current || loading) return
    verifyingRef.current = true
    if (otp.length !== 6) { verifyingRef.current = false; return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: otp, purpose: 'login', role: 'PARENT' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Invalid code')

      sessionStorage.removeItem('otp_phone')
      sessionStorage.removeItem('otp_role')

      router.push(data.isNewUser ? '/parent-app/onboarding' : '/parent-app/dashboard')
    } catch (err) {
      toast.error((err as Error).message)
      setOtp('')
    } finally {
      setLoading(false)
      verifyingRef.current = false
    }
  }

  useEffect(() => { if (otp.length === 6 && !loading) handleVerify() }, [otp, loading])

  async function handleResend() {
    if (resendTimer > 0) return
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, purpose: 'login', role: 'PARENT' }),
      })
      if (!res.ok) throw new Error('Failed to resend')
      setResendTimer(30)
      toast.success('Code resent')
    } catch {
      toast.error('Failed to resend code')
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="bg-gradient-to-br from-[#1A3F7A] to-[#0F2A52] px-6 pt-16 pb-12 flex flex-col items-center">
        <img src="/logos/wings-icon.svg" alt="Angels" className="w-16 h-16" />
      </div>
      <div className="flex-1 bg-[#F8F9FB] rounded-t-3xl -mt-4 px-6 pt-8">
        <h2 className="text-xl font-bold text-[#0F1923] mb-1">Enter your code</h2>
        <p className="text-sm text-[#5A6474] mb-8">
          We sent a 6-digit code to {phone ? formatPhone(phone) : '…'}
        </p>
        <div className="mb-8"><OtpInput value={otp} onChange={setOtp} disabled={loading} /></div>
        <Button
          onClick={handleVerify}
          disabled={otp.length !== 6 || loading}
          className="w-full h-14 font-semibold bg-[#F5A623] hover:bg-[#F5A623]/90 text-[#0F1923] rounded-xl mb-4"
        >
          {loading ? 'Verifying…' : 'Verify'}
        </Button>
        <div className="text-center">
          {resendTimer > 0
            ? <p className="text-sm text-[#5A6474]">Resend in {resendTimer}s</p>
            : <button onClick={handleResend} className="text-sm font-medium text-[#1A3F7A]">Resend code</button>
          }
        </div>
      </div>
    </div>
  )
}
