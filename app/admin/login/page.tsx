'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PhoneInput } from '@/components/shared/PhoneInput'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/Logo'
import { normalizeSAPhone } from '@/lib/utils/validators'

export default function AdminLoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.trim()) { toast.error('Enter your phone number'); return }

    const normalized = normalizeSAPhone(phone)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalized, purpose: 'admin_login' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to send code')

      sessionStorage.setItem('otp_phone', normalized)
      router.push('/admin/verify')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#c1272d] flex flex-col">
      <div className="flex flex-col items-center pt-16 pb-8 px-6">
        <Logo size={80} className="mb-4 rounded-2xl object-contain bg-white p-2" />
        <h1 className="text-2xl font-bold text-white">Admin Portal</h1>
        <p className="text-white/70 text-sm mt-1">Sign in to manage the platform</p>
      </div>

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
            className="w-full h-14 text-base font-semibold bg-[#c1272d] hover:bg-[#c1272d]/90 text-white rounded-xl"
          >
            {loading ? 'Sending code…' : 'Get code →'}
          </Button>
        </form>

        <p className="text-xs text-[#5A6474] text-center mt-8">
          A 6-digit code will be sent to your number via WhatsApp.
        </p>
      </div>
    </div>
  )
}
