'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertTriangle, CheckCircle2, Plus, Save, Trash2 } from 'lucide-react'

type CalcType = 'PERCENT' | 'FLAT' | 'REMAINDER' | 'ASSOCIATION_LEVY'
type PartyKind = 'FIXED' | 'DRIVER' | 'ASSOCIATION'

interface Party {
  id: string
  key: string
  label: string
  kind: PartyKind
  paystackSubAccountCode: string | null
  isActive: boolean
  sortOrder: number
}
interface Share {
  id: string
  schemeId: string
  partyId: string
  calcType: CalcType
  value: number
  sortOrder: number
  party: Party
}
interface Scheme {
  id: string
  name: string
  gatewayPercentBps: number
  gatewayFlatCents: number
  notes: string | null
}
interface PreviewLine {
  partyKey: string
  partyLabel: string
  calcType: CalcType
  amountCents: number
  subAccountCode: string | null
}
interface Preview {
  ok: boolean
  errors: string[]
  grossCents: number
  gatewayFeeCents: number
  remainderCents: number
  lines: PreviewLine[]
}

const rand = () => Math.random().toString(36).slice(2)
const cents = (c: number) => `R${(c / 100).toFixed(2)}`

function calcLabel(calcType: CalcType, value: number): string {
  switch (calcType) {
    case 'PERCENT': return `${(value / 100).toFixed(2)}% of gross`
    case 'FLAT': return cents(value)
    case 'REMAINDER': return 'Remainder (what’s left)'
    case 'ASSOCIATION_LEVY': return 'Association monthly levy'
  }
}

export default function AdminSplitsPage() {
  const [scheme, setScheme] = useState<Scheme | null>(null)
  const [parties, setParties] = useState<Party[]>([])
  const [shares, setShares] = useState<Share[]>([])
  const [preview, setPreview] = useState<Preview | null>(null)
  const [banks, setBanks] = useState<{ name: string; code: string }[]>([])
  const [sampleGross, setSampleGross] = useState(50000)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (gross = sampleGross) => {
    const res = await fetch(`/api/admin/splits?sampleGross=${gross}`)
    const data = await res.json()
    setScheme(data.scheme)
    setParties(data.parties ?? [])
    setShares(data.shares ?? [])
    setPreview(data.preview)
    setLoading(false)
  }, [sampleGross])

  useEffect(() => { load() }, [load])

  // Bank list for the payout-account picker (loaded once).
  useEffect(() => {
    fetch('/api/admin/paystack?resource=banks')
      .then(r => (r.ok ? r.json() : []))
      .then(d => setBanks(Array.isArray(d) ? d : []))
      .catch(() => setBanks([]))
  }, [])

  async function createPayoutAccount(party: Party, bankCode: string, accountNumber: string) {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/paystack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createSubAccount', targetType: 'party', targetId: party.id,
          displayName: party.label, bankCode, accountNumber,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create payout account')
      toast.success(`Payout account created for ${party.label}`)
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function post(payload: Record<string, unknown>, successMsg: string) {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/splits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Request failed')
      toast.success(successMsg)
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-[#5A6474]">Loading…</div>

  if (!scheme) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="rounded-xl p-4 bg-[#F5A623]/10 border border-[#F5A623]/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#F5A623] mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-sm text-[#0F1923]">No active split scheme</p>
            <p className="text-xs text-[#5A6474] mt-0.5">
              Run <code>scripts/payment-splits-schema.sql</code> against Supabase to seed the default
              scheme, then reload. Billing falls back to the legacy split until then.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F1923]">Payment Splits</h1>
        <p className="text-sm text-[#5A6474]">
          Configure how each parent payment is divided between parties. The driver receives the
          remainder after the gateway fee and every other cut. Changes take effect on the next charge.
        </p>
      </div>

      {/* Live preview */}
      <Card className="rounded-2xl border-[rgba(26,63,122,0.10)] shadow-none">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-[#0F1923]">Live preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-[#0F1923]">Sample monthly fee (Rand)</Label>
              <Input
                type="number"
                value={sampleGross / 100}
                onChange={e => setSampleGross(Math.round(Number(e.target.value) * 100))}
                onBlur={() => load(sampleGross)}
                className="h-10 w-40"
              />
            </div>
          </div>

          {preview && (
            <div className={`rounded-xl border p-3 ${preview.ok ? 'border-[#0F6E56]/30 bg-[#0F6E56]/5' : 'border-red-300 bg-red-50'}`}>
              <div className="flex items-center gap-2 mb-2">
                {preview.ok
                  ? <CheckCircle2 className="w-4 h-4 text-[#0F6E56]" />
                  : <AlertTriangle className="w-4 h-4 text-red-600" />}
                <span className="text-sm font-semibold text-[#0F1923]">
                  {preview.ok ? 'Balances' : preview.errors.join('; ')}
                </span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="text-[#5A6474]">
                    <td className="py-1">Gateway fee</td>
                    <td className="py-1 text-right tabular-nums">{cents(preview.gatewayFeeCents)}</td>
                  </tr>
                  {preview.lines.map(l => (
                    <tr key={l.partyKey} className="border-t border-[rgba(26,63,122,0.06)]">
                      <td className="py-1 text-[#0F1923]">
                        {l.partyLabel}
                        {l.subAccountCode && <span className="text-[10px] text-[#0F6E56] ml-1.5">↳ routed</span>}
                      </td>
                      <td className="py-1 text-right tabular-nums font-medium text-[#0F1923]">{cents(l.amountCents)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-[rgba(26,63,122,0.15)] font-semibold text-[#0F1923]">
                    <td className="py-1">Total</td>
                    <td className="py-1 text-right tabular-nums">{cents(preview.grossCents)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shares */}
      <Card className="rounded-2xl border-[rgba(26,63,122,0.10)] shadow-none">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-[#0F1923]">Party cuts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {shares.map(share => (
            <div key={share.id} className="flex items-center gap-2 border-b border-[rgba(26,63,122,0.06)] pb-3">
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#0F1923]">{share.party.label}</p>
                <p className="text-xs text-[#5A6474]">{calcLabel(share.calcType, share.value)}</p>
              </div>
              {(share.calcType === 'FLAT' || share.calcType === 'PERCENT') && (
                <Input
                  type="number"
                  defaultValue={share.calcType === 'PERCENT' ? share.value / 100 : share.value / 100}
                  onBlur={e => {
                    const raw = Number(e.target.value)
                    const value = share.calcType === 'PERCENT' ? Math.round(raw * 100) : Math.round(raw * 100)
                    if (value !== share.value)
                      post({ action: 'upsertShare', id: share.id, schemeId: share.schemeId, partyId: share.partyId, calcType: share.calcType, value, sortOrder: share.sortOrder }, `${share.party.label} updated`)
                  }}
                  className="h-9 w-28"
                  disabled={busy}
                />
              )}
              <span className="text-xs text-[#5A6474] w-10">{share.calcType === 'PERCENT' ? '%' : share.calcType === 'FLAT' ? 'Rand' : ''}</span>
            </div>
          ))}
          <p className="text-xs text-[#5A6474]">
            To add a party to this scheme, create it below then set its cut here.
          </p>
        </CardContent>
      </Card>

      {/* Parties */}
      <Card className="rounded-2xl border-[rgba(26,63,122,0.10)] shadow-none">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-[#0F1923]">Parties &amp; payout accounts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {parties.map(p => (
            <div key={p.id} className="flex items-center gap-2 border-b border-[rgba(26,63,122,0.06)] pb-3">
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#0F1923]">{p.label} <span className="text-xs font-normal text-[#5A6474]">({p.kind.toLowerCase()})</span></p>
                <Input
                  defaultValue={p.paystackSubAccountCode ?? ''}
                  placeholder={p.kind === 'FIXED' ? 'Paystack subaccount (ACCT_…)' : 'Resolved per-transaction'}
                  disabled={p.kind !== 'FIXED' || busy}
                  onBlur={e => {
                    const code = e.target.value.trim()
                    if (code !== (p.paystackSubAccountCode ?? ''))
                      post({ action: 'upsertParty', id: p.id, key: p.key, label: p.label, kind: p.kind, paystackSubAccountCode: code, isActive: p.isActive, sortOrder: p.sortOrder }, `${p.label} payout account saved`)
                  }}
                  className="h-8 mt-1 text-xs font-mono"
                />
                {/* Create a payout account programmatically (no Paystack dashboard needed) */}
                {p.kind === 'FIXED' && !p.paystackSubAccountCode && (
                  <PayoutAccountForm party={p} banks={banks} disabled={busy} onCreate={createPayoutAccount} />
                )}
              </div>
              {p.kind === 'FIXED' && (
                <Button
                  variant="ghost" size="sm" disabled={busy}
                  onClick={() => post({ action: 'deleteParty', id: p.id }, `${p.label} removed`)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
          <NewPartyForm disabled={busy} onCreate={(label, key) =>
            post({ action: 'upsertParty', key, label, kind: 'FIXED', sortOrder: 50 }, `${label} added`)} />
        </CardContent>
      </Card>
    </div>
  )
}

function PayoutAccountForm({
  party, banks, disabled, onCreate,
}: {
  party: Party
  banks: { name: string; code: string }[]
  disabled: boolean
  onCreate: (party: Party, bankCode: string, accountNumber: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [bankCode, setBankCode] = useState('')
  const [accountNumber, setAccountNumber] = useState('')

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-1.5 text-xs font-medium text-[#1A3F7A] hover:underline"
      >
        + Create payout account
      </button>
    )
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg bg-[#F8F9FB] p-2.5">
      <select
        value={bankCode}
        onChange={e => setBankCode(e.target.value)}
        className="w-full h-9 rounded-lg border border-[rgba(26,63,122,0.15)] bg-white px-2 text-sm text-[#0F1923]"
      >
        <option value="">{banks.length ? 'Select bank…' : 'Loading banks…'}</option>
        {banks.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
      </select>
      <Input
        value={accountNumber}
        onChange={e => setAccountNumber(e.target.value)}
        placeholder="Bank account number"
        className="h-9"
        inputMode="numeric"
      />
      <div className="flex gap-2">
        <Button
          size="sm" disabled={disabled || !bankCode || accountNumber.trim().length < 6}
          onClick={() => onCreate(party, bankCode, accountNumber.trim())}
          className="h-8 flex-1 bg-[#0F6E56] text-white hover:bg-[#0F6E56]/90"
        >
          Create for {party.label}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setOpen(false)} className="h-8">Cancel</Button>
      </div>
    </div>
  )
}

function NewPartyForm({ onCreate, disabled }: { onCreate: (label: string, key: string) => void; disabled: boolean }) {
  const [label, setLabel] = useState('')
  return (
    <div className="flex items-end gap-2 pt-2">
      <div className="flex-1 space-y-1.5">
        <Label className="text-sm font-semibold text-[#0F1923]">Add a party</Label>
        <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Regional fund" className="h-9" />
      </div>
      <Button
        size="sm" disabled={disabled || !label.trim()}
        onClick={() => { onCreate(label.trim(), label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_') + '_' + rand().slice(0, 4)); setLabel('') }}
        className="h-9 bg-[#1A3F7A] text-white hover:bg-[#1A3F7A]/90"
      >
        <Plus className="w-4 h-4 mr-1.5" /> Add
      </Button>
    </div>
  )
}
