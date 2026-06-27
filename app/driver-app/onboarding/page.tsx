'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DriverTopBar } from '@/components/driver/DriverTopBar'

const SA_BANKS = [
  'Absa', 'African Bank', 'Bidvest Bank', 'Capitec Bank', 'Discovery Bank',
  'FNB', 'Investec', 'Nedbank', 'Standard Bank', 'TymeBank',
]

const STEPS = ['Your details', 'Your vehicle', 'Your association', 'Banking details']

export default function DriverOnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)

  const [details, setDetails] = useState({ name: '', getsNumber: '' })
  const [vehicle, setVehicle] = useState({
    make: '', model: '', year: '', registration: '', colour: '', capacity: '',
  })
  const [associations, setAssociations] = useState<{ id: string; name: string; region: string }[]>([])
  const [selectedAssociation, setSelectedAssociation] = useState('')
  const [banking, setBanking] = useState({
    bankName: '', accountNumber: '', branchCode: '', accountName: '',
  })

  // Load associations on step 2
  async function loadAssociations() {
    try {
      const res = await fetch('/api/associations')
      if (!res.ok) throw new Error('Failed to load associations')
      const data = await res.json()
      setAssociations(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Could not load associations — you can pick one later')
      setAssociations([])
    }
  }

  async function nextStep() {
    const s = step + 1
    // Validate current step before advancing
    if (step === 0 && !details.name.trim()) { toast.error('Please enter your name'); return }
    if (step === 1 && !vehicle.make.trim() && !vehicle.model.trim()) { toast.error('Please enter vehicle details'); return }
    // Load associations just before showing step 2
    if (s === 2) await loadAssociations()
    setStep(s)
  }

  async function handleFinish() {
    setLoading(true)
    try {
      const res = await fetch('/api/driver/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ details, vehicle, associationId: selectedAssociation, banking }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to complete setup')
      router.push('/driver-app/dashboard')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex flex-col">
      <DriverTopBar showLogo />

      <div className="px-6 pt-6 pb-2">
        {/* Progress dots */}
        <div className="flex gap-2 justify-center mb-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all ${
                i === step ? 'w-6 bg-[#1A3F7A]' : i < step ? 'w-2 bg-[#1A3F7A]/40' : 'w-2 bg-[rgba(26,63,122,0.15)]'
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-[#5A6474] text-center mb-2">Step {step + 1} of {STEPS.length}</p>
        <h2 className="text-xl font-bold text-[#0F1923] text-center">{STEPS[step]}</h2>
      </div>

      <div className="flex-1 px-6 py-6 space-y-5">
        {step === 0 && (
          <>
            <div className="space-y-2">
              <Label>Full name</Label>
              <Input
                placeholder="Thabo Molefe"
                value={details.name}
                onChange={e => setDetails(p => ({ ...p, name: e.target.value }))}
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label>GETS registration number <span className="text-[#5A6474] font-normal">(optional)</span></Label>
              <Input
                placeholder="GETS-12345"
                value={details.getsNumber}
                onChange={e => setDetails(p => ({ ...p, getsNumber: e.target.value }))}
                className="h-12"
              />
            </div>
          </>
        )}

        {step === 1 && (
          <>
            {[
              { key: 'make', label: 'Vehicle make', placeholder: 'Toyota' },
              { key: 'model', label: 'Model', placeholder: 'HiAce' },
              { key: 'year', label: 'Year', placeholder: '2019', type: 'number' },
              { key: 'registration', label: 'Registration plate', placeholder: 'GP 123-456' },
              { key: 'colour', label: 'Colour', placeholder: 'White' },
              { key: 'capacity', label: 'Passenger capacity', placeholder: '14', type: 'number' },
            ].map(({ key, label, placeholder, type }) => (
              <div key={key} className="space-y-2">
                <Label>{label}</Label>
                <Input
                  type={type ?? 'text'}
                  placeholder={placeholder}
                  value={vehicle[key as keyof typeof vehicle]}
                  onChange={e => setVehicle(p => ({ ...p, [key]: e.target.value }))}
                  className="h-12"
                />
              </div>
            ))}
          </>
        )}

        {step === 2 && (
          <div className="space-y-2">
            <Label>Your association</Label>
            <Select value={selectedAssociation} onValueChange={(v) => setSelectedAssociation(v ?? '')}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Select your association" />
              </SelectTrigger>
              <SelectContent>
                {associations.length === 0 && (
                  <SelectItem value="none" disabled>Loading…</SelectItem>
                )}
                {associations.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} — {a.region}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-[#5A6474]">
              Not sure which association you belong to? You can update this later.
            </p>
          </div>
        )}

        {step === 3 && (
          <>
            <p className="text-sm text-[#5A6474] bg-[#F5A623]/10 rounded-xl p-3">
              Your banking details are used for payouts when payments go live. They are stored securely and never shared.
            </p>
            <div className="space-y-2">
              <Label>Bank</Label>
              <Select value={banking.bankName} onValueChange={v => setBanking(p => ({ ...p, bankName: v ?? '' }))}>
                <SelectTrigger className="h-12"><SelectValue placeholder="Select bank" /></SelectTrigger>
                <SelectContent>
                  {SA_BANKS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {[
              { key: 'accountName', label: 'Account holder name', placeholder: 'Thabo Molefe' },
              { key: 'accountNumber', label: 'Account number', placeholder: '1234567890', type: 'number' },
              { key: 'branchCode', label: 'Branch code', placeholder: '051001', type: 'number' },
            ].map(({ key, label, placeholder, type }) => (
              <div key={key} className="space-y-2">
                <Label>{label}</Label>
                <Input
                  type={type ?? 'text'}
                  placeholder={placeholder}
                  value={banking[key as keyof typeof banking]}
                  onChange={e => setBanking(p => ({ ...p, [key]: e.target.value }))}
                  className="h-12"
                />
              </div>
            ))}
          </>
        )}
      </div>

      <div className="px-6 pb-8 pt-2 flex gap-3">
        {step > 0 && (
          <Button variant="outline" onClick={() => setStep(s => s - 1)} className="h-12 flex-1">
            Back
          </Button>
        )}
        {step < 3 ? (
          <Button
            onClick={nextStep}
            disabled={step === 0 && !details.name}
            className="h-12 flex-1 bg-[#1A3F7A] text-white hover:bg-[#1A3F7A]/90"
          >
            Continue →
          </Button>
        ) : (
          <Button
            onClick={handleFinish}
            disabled={loading}
            className="h-12 flex-1 bg-[#1A3F7A] text-white hover:bg-[#1A3F7A]/90"
          >
            {loading ? 'Setting up…' : 'Finish setup →'}
          </Button>
        )}
      </div>
    </div>
  )
}
