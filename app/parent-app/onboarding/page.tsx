'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { OtpInput } from '@/components/shared/OtpInput'
import { AddressPicker } from '@/components/shared/AddressPicker'
import { CheckCircle2, User, Car } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'

const STEPS = ['Your name', 'Your child', 'Pickup & dropoff', 'Choose a driver', 'Sign & confirm']

type Driver = {
  id: string
  user: { name: string }
  vehicleMake: string | null
  vehicleModel: string | null
  vehicleColour: string | null
  vehicleCapacity: number | null
  approvedDocsCount: number
  association: { name: string; region: string } | null
  profilePhotoUrl: string | null
}

export default function ParentOnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState('')

  const [name, setName] = useState('')
  const [child, setChild] = useState({ name: '', dateOfBirth: '', schoolName: '', grade: '' })
  const [pickupAddr, setPickupAddr] = useState('')
  const [pickupLat, setPickupLat] = useState<number | null>(null)
  const [pickupLng, setPickupLng] = useState<number | null>(null)
  const [dropoffAddr, setDropoffAddr] = useState('')
  const [dropoffLat, setDropoffLat] = useState<number | null>(null)
  const [dropoffLng, setDropoffLng] = useState<number | null>(null)
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null)
  const [skipDriver, setSkipDriver] = useState(false)
  const [driversLoading, setDriversLoading] = useState(false)

  useEffect(() => {
    if (step === 3) loadDrivers()
  }, [step])

  async function loadDrivers() {
    setDriversLoading(true)
    try {
      const res = await fetch('/api/drivers')
      const data = await res.json()
      setDrivers(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Could not load drivers')
    } finally {
      setDriversLoading(false)
    }
  }

  async function sendOtp() {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose: 'contract_sign' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to send code')
      if (data.devCode) {
        toast(`Dev OTP: ${data.devCode}`, { duration: 20000, description: 'Auto-hides in 20s' })
        setTimeout(() => toast.dismiss(), 20000)
      }
      setOtpSent(true)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit() {
    if (!otp || otp.length !== 6) { toast.error('Enter the 6-digit code'); return }
    setLoading(true)
    try {
      const body: Record<string, any> = {
        parentName:      name.trim(),
        childName:       child.name.trim(),
        dateOfBirth:     child.dateOfBirth || undefined,
        schoolName:      child.schoolName.trim(),
        grade:           child.grade.trim() || undefined,
        pickupAddress:   pickupAddr,
        pickupLat:       pickupLat,
        pickupLng:       pickupLng,
        dropoffAddress:  dropoffAddr,
        dropoffLat:      dropoffLat,
        dropoffLng:      dropoffLng,
        otp,
      }
      if (selectedDriver) body.driverId = selectedDriver.id
      const res = await fetch('/api/children', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to complete setup')
      toast.success('All done! Your driver has been notified.')
      router.push('/parent-app/dashboard')
    } catch (err) {
      toast.error((err as Error).message)
      setOtp('')
    } finally {
      setLoading(false)
    }
  }

  function canAdvance() {
    if (step === 0) return name.trim().length >= 2
    if (step === 1) return child.name.trim() && child.schoolName.trim()
    if (step === 2) return !!pickupAddr && !!dropoffAddr && pickupLat != null && dropoffLat != null && !isNaN(pickupLat) && !isNaN(dropoffLat)
    if (step === 3) return !!selectedDriver || skipDriver
    return false
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="bg-gradient-to-br from-[#ec3d3a] to-[#c81c19] px-6 pt-12 pb-10 flex flex-col items-center text-center">
        <Logo size={56} className="mb-4 rounded-2xl object-contain bg-white p-1" />
        <h1 className="text-xl font-bold text-white">Get started</h1>
        <p className="text-white/70 text-sm mt-1">Step {step + 1} of {STEPS.length}</p>
        <div className="flex gap-1.5 mt-4">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 rounded-full transition-all ${
              i === step ? 'w-6 bg-white' : i < step ? 'w-3 bg-white/50' : 'w-3 bg-white/20'
            }`} />
          ))}
        </div>
      </div>

      <div className="flex-1 bg-[#F8F9FB] rounded-t-3xl -mt-4 px-6 pt-8 flex flex-col">
        <h2 className="text-xl font-bold text-[#0F1923] mb-1">{STEPS[step]}</h2>

        <div className="flex-1 mt-6 space-y-5">
          {step === 0 && (
            <div className="space-y-2">
              <Label>Your full name</Label>
              <Input
                placeholder="Nompumelelo Dlamini"
                value={name}
                onChange={e => setName(e.target.value)}
                className="h-12"
                autoFocus
              />
            </div>
          )}

          {step === 1 && (
            <>
              {([
                { key: 'name',        label: "Child's full name",        placeholder: 'Amahle Dlamini', type: 'text' },
                { key: 'schoolName',  label: 'School name',              placeholder: 'Soweto Primary',  type: 'text' },
                { key: 'grade',       label: 'Grade (optional)',          placeholder: 'Grade 4',         type: 'text' },
                { key: 'dateOfBirth', label: 'Date of birth (optional)', placeholder: '',                type: 'date' },
              ] as { key: keyof typeof child; label: string; placeholder: string; type: string }[]).map(({ key, label, placeholder, type }) => (
                <div key={key} className="space-y-2">
                  <Label>{label}</Label>
                  <Input
                    type={type}
                    placeholder={placeholder}
                    value={child[key]}
                    onChange={e => setChild(p => ({ ...p, [key]: e.target.value }))}
                    className="h-12"
                  />
                </div>
              ))}
            </>
          )}

          {step === 2 && (
            <>
              <AddressPicker
                label="Pickup address (home)"
                placeholder="Search for your home address"
                value={pickupAddr}
                lat={pickupLat}
                lng={pickupLng}
                onChange={(addr, lat, lng) => {
                  setPickupAddr(addr)
                  setPickupLat(lat)
                  setPickupLng(lng)
                }}
              />
              <div className="border-t border-[rgba(236,61,58,0.08)] pt-4">
                <AddressPicker
                  label="Dropoff address (school)"
                  placeholder="Search for the school address"
                  value={dropoffAddr}
                  lat={dropoffLat}
                  lng={dropoffLng}
                  onChange={(addr, lat, lng) => {
                    setDropoffAddr(addr)
                    setDropoffLat(lat)
                    setDropoffLng(lng)
                  }}
                />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              {driversLoading ? (
                <div className="text-center py-12 text-[#5A6474] text-sm">Loading available drivers…</div>
              ) : (
                <div className="space-y-3">
                  {drivers.length > 0 && drivers.map(d => {
                    const isSelected = selectedDriver?.id === d.id
                    const vehicle = [d.vehicleColour, d.vehicleMake, d.vehicleModel].filter(Boolean).join(' ')
                    return (
                      <button
                        key={d.id}
                        onClick={() => { setSelectedDriver(d); setSkipDriver(false) }}
                        className={`w-full text-left rounded-2xl border p-4 transition-all ${
                          isSelected
                            ? 'border-[#ec3d3a] bg-[#ec3d3a]/05 ring-1 ring-[#ec3d3a]'
                            : 'border-[rgba(236,61,58,0.12)] bg-white hover:border-[#ec3d3a]/30'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#ec3d3a]/10 flex items-center justify-center shrink-0">
                            {d.profilePhotoUrl
                              ? <img src={d.profilePhotoUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                              : <User className="w-5 h-5 text-[#ec3d3a]" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-[#0F1923] text-sm">{d.user.name}</p>
                            {d.association && <p className="text-xs text-[#5A6474]">{d.association.name}</p>}
                            {vehicle && (
                              <div className="flex items-center gap-1 mt-1">
                                <Car className="w-3 h-3 text-[#5A6474]" />
                                <span className="text-xs text-[#5A6474]">{vehicle}</span>
                                {d.vehicleCapacity && <span className="text-xs text-[#5A6474]">· {d.vehicleCapacity} seats</span>}
                              </div>
                            )}
                            <div className="flex items-center gap-1 mt-1">
                              <CheckCircle2 className="w-3 h-3 text-[#0F6E56]" />
                              <span className="text-xs text-[#0F6E56] font-medium">{d.approvedDocsCount}/6 docs verified</span>
                            </div>
                          </div>
                          {isSelected && <CheckCircle2 className="w-5 h-5 text-[#ec3d3a] shrink-0 mt-0.5" />}
                        </div>
                      </button>
                    )
                  })}

                  {/* Select later option */}
                  <button
                    onClick={() => { setSelectedDriver(null); setSkipDriver(true) }}
                    className={`w-full text-center rounded-2xl border-2 border-dashed p-4 transition-all ${
                      skipDriver
                        ? 'border-[#fdc73e] bg-[#fdc73e]/05'
                        : 'border-[rgba(236,61,58,0.15)] hover:border-[#fdc73e]/40'
                    }`}
                  >
                    <p className="font-semibold text-sm text-[#0F1923]">Select later</p>
                    <p className="text-xs text-[#5A6474] mt-0.5">You can choose a driver after signing up</p>
                  </button>
                </div>
              )}
            </>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-[rgba(236,61,58,0.10)] p-4 space-y-2">
                {[
                  ['Parent',   name],
                  ['Child',    child.name],
                  ['School',   child.schoolName],
                  ['Pickup',   pickupAddr],
                  ['Dropoff',  dropoffAddr],
                  ['Driver',   selectedDriver?.user.name ?? 'To be assigned'],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between text-sm py-1 border-b border-[rgba(236,61,58,0.05)] last:border-0">
                    <span className="text-[#5A6474]">{label}</span>
                    <span className="font-medium text-[#0F1923] text-right max-w-[55%] truncate">{val}</span>
                  </div>
                ))}
              </div>

              <div className="bg-[#ec3d3a]/05 rounded-xl p-3 text-xs text-[#5A6474]">
                {selectedDriver
                  ? 'By signing you agree to the GETS transport agreement. The driver will countersign to activate service.'
                  : 'By signing you agree to the GETS transport agreement. You can assign a driver later from your dashboard.'}
              </div>

              {!otpSent ? (
                <Button
                  onClick={sendOtp}
                  disabled={loading}
                  className="w-full h-12 bg-[#fdc73e] hover:bg-[#fdc73e]/90 text-[#0F1923] font-semibold rounded-xl"
                >
                  {loading ? 'Sending code…' : 'Send code to sign →'}
                </Button>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-[#5A6474] text-center">Enter the 6-digit code sent to your phone</p>
                  <OtpInput value={otp} onChange={setOtp} disabled={loading} />
                  <Button
                    onClick={handleSubmit}
                    disabled={otp.length !== 6 || loading}
                    className="w-full h-12 bg-[#fdc73e] hover:bg-[#fdc73e]/90 text-[#0F1923] font-semibold rounded-xl"
                  >
                    {loading ? 'Submitting…' : 'Sign & send to driver →'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {step < 4 && (
          <div className="flex gap-3 py-8">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(s => s - 1)} className="h-12 flex-1">Back</Button>
            )}
            <Button
              onClick={() => setStep(s => s + 1)}
              disabled={!canAdvance()}
              className="h-12 flex-1 bg-[#ec3d3a] hover:bg-[#ec3d3a]/90 text-white font-semibold"
            >
              Continue →
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
