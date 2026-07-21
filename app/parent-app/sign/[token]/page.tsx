'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { OtpInput } from '@/components/shared/OtpInput'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { CheckCircle2, FileText, ChevronDown, ChevronUp } from 'lucide-react'
import { formatZAR } from '@/lib/utils/cents'
import { Logo } from '@/components/ui/Logo'

interface ContractInfo {
  driverName: string
  childName: string
  pickupAddress: string
  dropoffAddress: string
  monthlyAmountCents: number
  startDate: string
  parentPhone: string
  pdfUrl: string | null
}

type SignStep = 'cover' | 'review' | 'agree' | 'sign' | 'done'

export default function ParentSignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const router = useRouter()
  const [info, setInfo] = useState<ContractInfo | null>(null)
  const [error, setError] = useState('')
  const [step, setStep] = useState<SignStep>('cover')
  const [expanded, setExpanded] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [otp, setOtp] = useState('')
  const [signing, setSigning] = useState(false)

  useEffect(() => {
    fetch(`/api/contracts/sign-info/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return }
        setInfo(data)
      })
      .catch(() => setError('Invalid or expired link'))
  }, [token])

  async function requestOtp() {
    if (!info) return
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: info.parentPhone, purpose: 'contract_sign', role: 'PARENT' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to send code')
      if (data.devCode) {
        toast(`Dev OTP: ${data.devCode}`, { duration: 20000, description: 'Auto-hides in 20s' })
        setTimeout(() => toast.dismiss(), 20000)
      }
      setStep('sign')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function handleSign() {
    if (otp.length !== 6 || !info) return
    setSigning(true)
    try {
      const res = await fetch('/api/contracts/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, otp, role: 'PARENT' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Signing failed')
      setStep('done')
    } catch (err) {
      toast.error((err as Error).message)
      setOtp('')
    } finally {
      setSigning(false)
    }
  }

  useEffect(() => { if (otp.length === 6 && step === 'sign') handleSign() }, [otp, step])

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center bg-[#F8F9FB]">
      <div>
        <Logo size={48} className="mx-auto mb-4 rounded-xl object-contain opacity-40" />
        <p className="text-[#E24B4A] font-semibold mb-2">Link expired or invalid</p>
        <p className="text-sm text-[#5A6474]">Ask your driver to send a new contract link.</p>
      </div>
    </div>
  )

  if (!info) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FB]">
      <div className="text-center">
        <Logo size={48} className="mx-auto mb-3 rounded-xl object-contain bg-white animate-pulse" />
        <p className="text-sm text-[#5A6474]">Loading agreement…</p>
      </div>
    </div>
  )

  // Done screen
  if (step === 'done') return (
    <div className="min-h-screen bg-[#F8F9FB] flex flex-col items-center justify-center px-6 text-center">
      <div className="w-20 h-20 bg-[#0F6E56]/10 rounded-full flex items-center justify-center mb-6">
        <CheckCircle2 className="w-10 h-10 text-[#0F6E56]" />
      </div>
      <h1 className="text-2xl font-bold text-[#0F1923] mb-2">Agreement signed ✓</h1>
      <p className="text-sm text-[#5A6474] mb-8">
        The transport agreement for {info.childName} has been signed by both parties.
      </p>
      <Button
        onClick={() => router.push('/parent-app/login')}
        className="w-full h-14 bg-[#fdc73e] text-[#0F1923] font-semibold rounded-xl mb-3"
      >
        Set up my account →
      </Button>
      <button onClick={() => router.push('/parent-app/login')} className="text-sm text-[#5A6474]">I&apos;ll do this later</button>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex flex-col">
      {/* Header */}
      <div className="bg-[#ec3d3a] px-6 pt-12 pb-8 text-white">
        <div className="flex items-center gap-2 mb-4">
          <Logo size={32} className="rounded-lg object-contain bg-white" />
          <span className="font-bold">GETS</span>
        </div>
        <h1 className="text-xl font-bold mb-1">Transport Agreement</h1>
        <p className="text-white/70 text-sm">{info.driverName} &amp; {info.childName}</p>
      </div>

      <div className="flex-1 px-6 py-6 space-y-5">
        {(step === 'cover' || step === 'review') && (
          <>
            {/* Summary */}
            <div className="bg-white rounded-2xl p-4 border border-[rgba(236,61,58,0.10)] space-y-2.5">
              {[
                ['Child', info.childName],
                ['Driver', info.driverName],
                ['Pickup', info.pickupAddress],
                ['Dropoff', info.dropoffAddress],
                ['Monthly fee', formatZAR(info.monthlyAmountCents)],
                ['Start date', new Date(info.startDate).toLocaleDateString('en-ZA')],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-[#5A6474]">{label}</span>
                  <span className="font-medium text-[#0F1923] text-right max-w-[55%]">{val}</span>
                </div>
              ))}
            </div>

            {/* Expand PDF button */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center justify-between bg-white rounded-2xl p-4 border border-[rgba(236,61,58,0.10)] text-sm font-medium text-[#ec3d3a]"
            >
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                View full agreement
              </span>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {expanded && info.pdfUrl && (
              <iframe src={info.pdfUrl} className="w-full h-96 rounded-xl border" />
            )}

            {step === 'review' && (
              <>
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox
                    checked={agreed}
                    onCheckedChange={v => setAgreed(Boolean(v))}
                    className="mt-0.5"
                  />
                  <span className="text-sm text-[#0F1923]">
                    I have read and agree to the terms of this transport agreement
                  </span>
                </label>
                <Button
                  onClick={requestOtp}
                  disabled={!agreed}
                  className="w-full h-14 bg-[#fdc73e] text-[#0F1923] font-semibold rounded-xl"
                >
                  Sign agreement →
                </Button>
              </>
            )}
          </>
        )}

        {step === 'cover' && (
          <Button
            onClick={() => setStep('review')}
            className="w-full h-14 bg-[#fdc73e] text-[#0F1923] font-semibold rounded-xl"
          >
            Review agreement →
          </Button>
        )}

        {step === 'sign' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-lg font-bold text-[#0F1923] mb-1">Enter your code</h2>
              <p className="text-sm text-[#5A6474]">
                We sent a code to your number to confirm your signature
              </p>
            </div>
            <OtpInput value={otp} onChange={setOtp} disabled={signing} />
            <Button
              onClick={handleSign}
              disabled={otp.length !== 6 || signing}
              className="w-full h-14 bg-[#fdc73e] text-[#0F1923] font-semibold rounded-xl"
            >
              {signing ? 'Signing…' : 'Sign & confirm'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
