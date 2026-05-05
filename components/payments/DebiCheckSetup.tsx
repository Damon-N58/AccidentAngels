'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FileText } from 'lucide-react'

const SA_BANKS = ['Absa', 'Capitec Bank', 'FNB', 'Nedbank', 'Standard Bank', 'TymeBank', 'African Bank']

export function DebiCheckSetup() {
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [branchCode, setBranchCode] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!bankName || !accountNumber || !idNumber) {
      toast.error('Please fill in all required fields')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/payments/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'DEBICHECK', bankName, accountNumber, branchCode, idNumber }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Setup failed')
      toast.success('Debit order mandate submitted. You\'ll receive bank confirmation shortly.')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 bg-[#F59E0B]/08 rounded-xl p-3">
        <FileText className="w-4 h-4 text-[#F59E0B] mt-0.5 shrink-0" />
        <p className="text-xs text-[#0F1923]">
          A DebiCheck mandate will be sent to your bank for approval. You&apos;ll confirm via your banking app.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Bank</Label>
        <Select value={bankName} onValueChange={(v) => setBankName(v ?? "")}>
          <SelectTrigger className="h-12"><SelectValue placeholder="Select bank" /></SelectTrigger>
          <SelectContent>{SA_BANKS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Account number</Label>
        <Input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="1234567890" className="h-12" />
      </div>
      <div className="space-y-2">
        <Label>Branch code</Label>
        <Input value={branchCode} onChange={e => setBranchCode(e.target.value)} placeholder="051001" className="h-12" />
      </div>
      <div className="space-y-2">
        <Label>SA ID number</Label>
        <Input value={idNumber} onChange={e => setIdNumber(e.target.value)} placeholder="0000000000000" className="h-12" inputMode="numeric" />
      </div>
      <Button onClick={handleSubmit} disabled={loading} className="w-full h-12 bg-[#1A3F7A] text-white font-semibold rounded-xl">
        {loading ? 'Submitting…' : 'Set up debit order'}
      </Button>
    </div>
  )
}
