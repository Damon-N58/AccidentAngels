'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Association {
  id: string
  name: string
  code: string
  region: string
  monthlyLevy: number
  contactName: string
  contactPhone: string
  contactEmail: string | null
  bankName: string | null
  bankAccount: string | null
  bankBranch: string | null
  paystackSubAccountCode: string | null
  hasSubAccount: boolean
  isActive: boolean
  driverCount: number
}

interface Bank { name: string; code: string }

const EMPTY = { name: '', code: '', region: '', contactName: '', contactPhone: '', contactEmail: '', monthlyLevy: '0', bankName: '', bankAccount: '', bankBranch: '' }

export default function AdminAssociationsPage() {
  const [items, setItems] = useState<Association[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [banks, setBanks] = useState<Bank[]>([])
  const [subForm, setSubForm] = useState<{ id: string; bankCode: string; accountNumber: string } | null>(null)
  const [subBusy, setSubBusy] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/associations')
      if (!res.ok) throw new Error('Failed to load associations')
      setItems(await res.json())
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  async function loadBanks() {
    if (banks.length) return
    try {
      const res = await fetch('/api/admin/paystack?resource=banks')
      if (res.ok) setBanks(await res.json())
    } catch { /* non-fatal; can still type a code */ }
  }

  async function createAssociation() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/associations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create')
      toast.success('Association created')
      setForm({ ...EMPTY }); setCreating(false); load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function createSubAccount() {
    if (!subForm) return
    if (!subForm.bankCode || !subForm.accountNumber) { toast.error('Bank and account number are required'); return }
    const assoc = items.find(a => a.id === subForm.id)
    if (!assoc) return
    setSubBusy(true)
    try {
      const res = await fetch('/api/admin/paystack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createSubAccount',
          targetType: 'association',
          targetId: subForm.id,
          displayName: assoc.name,
          bankCode: subForm.bankCode,
          accountNumber: subForm.accountNumber,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create payout account')
      toast.success('Payout account created — payments can now route to this association')
      setSubForm(null); load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSubBusy(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-[#0F1923]">Associations</h1>
        <Button onClick={() => setCreating(v => !v)} className="bg-[#c1272d] hover:bg-[#c1272d]/90 text-white rounded-xl">
          {creating ? 'Cancel' : '+ New association'}
        </Button>
      </div>

      {creating && (
        <Card className="rounded-2xl border-[rgba(236,61,58,0.10)] shadow-none mb-4">
          <CardContent className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field l="Name *"><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
              <Field l="Code * (unique)"><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="SSTA" /></Field>
              <Field l="Region *"><Input value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} /></Field>
              <Field l="Monthly levy (cents)"><Input type="text" inputMode="numeric" value={form.monthlyLevy} onChange={e => setForm(f => ({ ...f, monthlyLevy: e.target.value }))} /></Field>
              <Field l="Contact name *"><Input value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} /></Field>
              <Field l="Contact phone *"><Input value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} placeholder="+27…" /></Field>
              <Field l="Contact email"><Input value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} /></Field>
            </div>
            <Button onClick={createAssociation} disabled={saving} className="bg-[#c1272d] hover:bg-[#c1272d]/90 text-white rounded-xl">
              {saving ? 'Creating…' : 'Create association'}
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3 animate-pulse">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-[#E8EAED] rounded-2xl" />)}</div>
      ) : items.length === 0 ? (
        <Card className="rounded-2xl border-[rgba(236,61,58,0.10)] shadow-none">
          <CardContent className="p-6 text-center text-[#5A6474]">No associations yet. Create the pilot association to route its share of payments.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map(a => (
            <Card key={a.id} className="rounded-2xl border-[rgba(236,61,58,0.10)] shadow-none">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#0F1923]">{a.name} <span className="text-xs text-[#5A6474]">· {a.code}</span></p>
                    <p className="text-sm text-[#5A6474]">{a.region} · {a.driverCount} driver{a.driverCount === 1 ? '' : 's'} · {a.contactName} ({a.contactPhone})</p>
                    <p className="text-xs mt-1">
                      {a.hasSubAccount
                        ? <span className="text-[#0F6E56] font-medium">✓ Payout account linked</span>
                        : <span className="text-[#b8860b] font-medium">⚠ No payout account — payments can’t route here yet</span>}
                    </p>
                  </div>
                  {!a.hasSubAccount && (
                    <Button
                      onClick={() => { setSubForm({ id: a.id, bankCode: '', accountNumber: a.bankAccount ?? '' }); loadBanks() }}
                      className="shrink-0 bg-white border border-[#c1272d] text-[#c1272d] hover:bg-[#c1272d]/5 rounded-xl text-sm"
                    >
                      Create payout account
                    </Button>
                  )}
                </div>

                {subForm?.id === a.id && (
                  <div className="mt-3 pt-3 border-t border-[rgba(236,61,58,0.10)] grid grid-cols-2 gap-3">
                    <Field l="Bank">
                      <select
                        value={subForm.bankCode}
                        onChange={e => setSubForm(s => s && { ...s, bankCode: e.target.value })}
                        className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
                      >
                        <option value="">{banks.length ? 'Select bank…' : 'Loading banks…'}</option>
                        {banks.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                      </select>
                    </Field>
                    <Field l="Account number">
                      <Input type="text" inputMode="numeric" value={subForm.accountNumber} onChange={e => setSubForm(s => s && { ...s, accountNumber: e.target.value })} />
                    </Field>
                    <div className="col-span-2 flex gap-2">
                      <Button onClick={createSubAccount} disabled={subBusy} className="bg-[#c1272d] hover:bg-[#c1272d]/90 text-white rounded-xl text-sm">
                        {subBusy ? 'Creating…' : 'Create at Paystack'}
                      </Button>
                      <Button onClick={() => setSubForm(null)} className="bg-white border border-input text-[#5A6474] rounded-xl text-sm">Cancel</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function Field({ l, children }: { l: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-[#5A6474]">{l}</Label>
      {children}
    </div>
  )
}
