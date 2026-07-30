'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { CreditCard } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Bank { name: string; code: string }

/**
 * Driver-facing payout account setup. Lets a driver choose their bank + account
 * number, which creates their Paystack subaccount so their share of each payment
 * routes to them. Once set, shows the read-only "Account code" for dispute refs.
 */
export function DriverPayoutSetup({ initialAccountCode }: { initialAccountCode: string | null }) {
  const [accountCode, setAccountCode] = useState<string | null>(initialAccountCode)
  const [banks, setBanks] = useState<Bank[]>([])
  const [bankCode, setBankCode] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (accountCode || !open || banks.length) return
    fetch('/api/driver/payout')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.banks)) setBanks(d.banks); if (d.accountCode) setAccountCode(d.accountCode) })
      .catch(() => {})
  }, [open, accountCode, banks.length])

  async function submit() {
    if (!bankCode || !accountNumber.trim()) { toast.error('Choose your bank and enter your account number'); return }
    setBusy(true)
    try {
      const res = await fetch('/api/driver/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankCode, accountNumber }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not set up payout account')
      setAccountCode(data.accountCode)
      toast.success('Payout account set up — you’re ready to get paid')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (accountCode) {
    return (
      <Card className="rounded-2xl border-[rgba(236,61,58,0.10)] shadow-none">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-4 h-4 text-[var(--brand-ink)]" />
            <span className="font-semibold text-sm text-[#0F1923]">Payout account · Account code</span>
          </div>
          <p className="text-xs text-[#5A6474] mb-2">You&apos;re set up to receive payments. Quote this code if you ever query a payment.</p>
          <code className="font-mono text-sm text-[#0F1923] bg-[#F8F9FB] px-2 py-1 rounded inline-block">{accountCode}</code>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-2xl border-[#fdc73e]/40 bg-[#fdc73e]/5 shadow-none">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <CreditCard className="w-4 h-4 text-[#b8860b]" />
          <span className="font-semibold text-sm text-[#0F1923]">Set up your payout account</span>
        </div>
        <p className="text-xs text-[#5A6474] mb-3">Add the bank account you want to be paid into. Required before payments can reach you.</p>

        {!open ? (
          <Button onClick={() => setOpen(true)} className="h-11 w-full bg-[#c1272d] hover:bg-[#c1272d]/90 text-white rounded-xl text-sm font-semibold">
            Set up payout account
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-[#5A6474]">Bank</label>
              <select
                value={bankCode}
                onChange={e => setBankCode(e.target.value)}
                className="h-11 w-full rounded-xl border border-[rgba(236,61,58,0.15)] bg-white px-3 text-base outline-none focus:border-[#c1272d]"
              >
                <option value="">{banks.length ? 'Select your bank…' : 'Loading banks…'}</option>
                {banks.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[#5A6474]">Account number</label>
              <input
                type="text"
                inputMode="numeric"
                value={accountNumber}
                onChange={e => setAccountNumber(e.target.value)}
                className="h-11 w-full rounded-xl border border-[rgba(236,61,58,0.15)] bg-white px-3 text-base outline-none focus:border-[#c1272d]"
              />
            </div>
            <Button onClick={submit} disabled={busy} className="h-11 w-full bg-[#c1272d] hover:bg-[#c1272d]/90 text-white rounded-xl text-sm font-semibold">
              {busy ? 'Setting up…' : 'Save payout account'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
