'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { DriverTopBar } from '@/components/driver/DriverTopBar'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { OtpInput } from '@/components/shared/OtpInput'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Card, CardContent } from '@/components/ui/card'
import { FileText, CheckCircle2, PenLine } from 'lucide-react'

interface ContractData {
  id: string
  status: string
  childName: string
  parentName: string
  parentPhone: string
  monthlyAmountCents: number
  startDate: string
  driverSignedAt: string | null
  parentSignedAt: string | null
  pdfUrl: string | null
}

export default function ContractDetailPage({ params }: { params: Promise<{ contractId: string }> }) {
  const { contractId } = use(params)
  const router = useRouter()
  const [contract, setContract] = useState<ContractData | null>(null)
  const [contractError, setContractError] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [otp, setOtp] = useState('')
  const [signing, setSigning] = useState(false)

  useEffect(() => {
    fetch(`/api/contracts/${contractId}`)
      .then(async r => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error ?? 'Failed to load contract')
        return data
      })
      .then(setContract)
      .catch(err => setContractError(err.message))
  }, [contractId])

  async function requestOtp() {
    if (!contract) return
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose: 'contract_sign',
          phone: contract.parentPhone,
          role: 'DRIVER',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to send code')
      setSheetOpen(true)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function handleSign() {
    if (otp.length !== 6) return
    setSigning(true)
    try {
      const res = await fetch('/api/contracts/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId, otp, role: 'DRIVER' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Signing failed')
      setSheetOpen(false)
      setOtp('')
      toast.success('Contract signed. Parent signing link sent.')
      router.refresh()
    } catch (err) {
      toast.error((err as Error).message)
      setOtp('')
    } finally {
      setSigning(false)
    }
  }

  useEffect(() => {
    if (otp.length === 6 && sheetOpen) handleSign()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, sheetOpen])

  if (contractError) return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <DriverTopBar title="Contract" />
      <div className="p-6 text-center">
        <p className="text-[#E24B4A] font-medium">Failed to load contract</p>
        <p className="text-sm text-[#5A6474] mt-1">{contractError}</p>
        <Button onClick={() => router.refresh()} className="mt-4">Retry</Button>
      </div>
    </div>
  )

  if (!contract) return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <DriverTopBar title="Contract" />
      <div className="p-6 text-center text-[#5A6474]">Loading…</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <DriverTopBar title="Contract" />
      <div className="px-4 py-4 space-y-4">
        <Card className="rounded-2xl border-[rgba(26,63,122,0.10)] shadow-none">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#1A3F7A]" />
                <span className="font-semibold text-sm">Contract details</span>
              </div>
              <StatusBadge status={contract.status as any} />
            </div>
            {[
              ['Child', contract.childName],
              ['Parent', contract.parentName],
              ['Monthly fee', `R ${(contract.monthlyAmountCents / 100).toFixed(0)}`],
              ['Start date', new Date(contract.startDate).toLocaleDateString('en-ZA')],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-[#5A6474]">{label}</span>
                <span className="font-medium">{val}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Signatures */}
        <Card className="rounded-2xl border-[rgba(26,63,122,0.10)] shadow-none">
          <CardContent className="p-4 space-y-3">
            <p className="font-semibold text-sm">Signatures</p>
            {[
              { label: 'Driver', signed: contract.driverSignedAt, date: contract.driverSignedAt },
              { label: 'Parent', signed: contract.parentSignedAt, date: contract.parentSignedAt },
            ].map(({ label, signed, date }) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-[#5A6474]">{label}</span>
                {signed ? (
                  <span className="text-[#0F6E56] flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Signed {new Date(date!).toLocaleDateString('en-ZA')}
                  </span>
                ) : (
                  <span className="text-[#F59E0B]">Pending</span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {contract.status === 'PENDING_DRIVER_SIGNATURE' && (
          <div className="fixed bottom-20 left-4 right-4">
            <Button onClick={requestOtp} className="w-full h-14 bg-[#1A3F7A] text-white text-base font-semibold rounded-xl shadow-lg">
              <PenLine className="w-5 h-5 mr-2" /> Sign this contract
            </Button>
          </div>
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-safe px-6 pt-6">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-lg font-bold text-[#0F1923]">Sign contract</SheetTitle>
            <p className="text-sm text-[#5A6474]">
              By entering your code, you confirm you accept the terms of this transport agreement.
            </p>
          </SheetHeader>
          <OtpInput value={otp} onChange={setOtp} disabled={signing} />
          <Button
            onClick={handleSign}
            disabled={otp.length !== 6 || signing}
            className="w-full h-14 mt-6 bg-[#1A3F7A] text-white text-base font-semibold rounded-xl"
          >
            {signing ? 'Signing…' : 'Sign & submit'}
          </Button>
        </SheetContent>
      </Sheet>
    </div>
  )
}
