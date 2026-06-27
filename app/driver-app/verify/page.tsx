'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { OtpInput } from '@/components/shared/OtpInput'
import { Button } from '@/components/ui/button'
import { formatPhone } from '@/lib/utils/formatters'
import { Logo } from '@/components/ui/Logo'

export default function DriverVerifyPage() {
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(30)
  const [phone, setPhone] = useState('')
  const [devCode, setDevCode] = useState('')
  const router = useRouter()
  const verifyingRef = useRef(false)
  const succeededRef = useRef(false)

  useEffect(() => {
    const p = sessionStorage.getItem('otp_phone')
    if (!p) { router.replace('/driver-app/login'); return }
    setPhone(p)
    const code = sessionStorage.getItem('otp_dev_code')
    if (code) setDevCode(code)
  }, [router])

  useEffect(() => {
    if (resendTimer <= 0) return
    const t = setInterval(() => setResendTimer(s => s - 1), 1000)
    return () => clearInterval(t)
  }, [resendTimer])

  async function handleVerify() {
    if (succeededRef.current || verifyingRef.current || loading) return
    verifyingRef.current = true
    if (otp.length !== 6) { verifyingRef.current = false; return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: otp, purpose: 'login', role: 'DRIVER' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Invalid code')

      succeededRef.current = true
      sessionStorage.removeItem('otp_phone')
      sessionStorage.removeItem('otp_role')
      sessionStorage.removeItem('otp_dev_code')

      router.push(data.isNewUser ? '/driver-app/onboarding' : '/driver-app/dashboard')
    } catch (err) {
      toast.error((err as Error).message)
      setOtp('')
    } finally {
      setLoading(false)
      verifyingRef.current = false
    }
  }

  async function handleResend() {
    if (resendTimer > 0) return
    try {
      await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, purpose: 'login', role: 'DRIVER' }),
      })
      setResendTimer(30)
      toast.success('New code sent')
    } catch {
      toast.error('Failed to resend code')
    }
  }

  // Auto-submit when 6 digits entered
  useEffect(() => { if (otp.length === 6 && !loading) handleVerify() }, [otp, loading])

  return (
    <div className="min-h-screen bg-[#1A3F7A] flex flex-col">
      <div className="flex flex-col items-center pt-16 pb-8 px-6">
        <Logo size={64} className="mb-4 rounded-2xl object-contain bg-white p-1" />
      </div>

      <div className="flex-1 bg-[#F8F9FB] rounded-t-3xl px-6 pt-8">
        <h2 className="text-xl font-bold text-[#0F1923] mb-1">Enter your code</h2>
        <p className="text-sm text-[#5A6474] mb-8">
          We sent a 6-digit code to {phone ? formatPhone(phone) : '…'}
        </p>

        {devCode && (
          <div className="mb-4 px-4 py-3 bg-[#F5A623]/15 border border-[#F5A623]/40 rounded-xl text-center">
            <p className="text-xs text-[#0F1923] font-medium mb-0.5">Your code (SMS unavailable)</p>
            <p className="text-2xl font-bold tracking-[0.3em] text-[#0F1923]">{devCode}</p>
          </div>
        )}

        <div className="mb-8">
          <OtpInput value={otp} onChange={setOtp} disabled={loading} />
        </div>

        <Button
          onClick={handleVerify}
          disabled={otp.length !== 6 || loading}
          className="w-full h-14 text-base font-semibold bg-[#1A3F7A] hover:bg-[#1A3F7A]/90 text-white rounded-xl mb-4"
        >
          {loading ? 'Verifying…' : 'Verify'}
        </Button>

        <div className="text-center">
          {resendTimer > 0 ? (
            <p className="text-sm text-[#5A6474]">Resend code in {resendTimer}s</p>
          ) : (
            <button onClick={handleResend} className="text-sm font-medium text-[#1A3F7A]">
              Resend code
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
