'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ParentTopBar } from '@/components/parent/ParentTopBar'
import { AddressPicker } from '@/components/shared/AddressPicker'
import { MapPin, School, Save } from 'lucide-react'

export default function EditChildPage({
  params,
}: {
  params: Promise<{ childId: string }>
}) {
  const { childId } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [child, setChild] = useState<any>(null)

  const [pickupAddr, setPickupAddr] = useState('')
  const [pickupLat, setPickupLat] = useState<number | null>(null)
  const [pickupLng, setPickupLng] = useState<number | null>(null)
  const [dropoffAddr, setDropoffAddr] = useState('')
  const [dropoffLat, setDropoffLat] = useState<number | null>(null)
  const [dropoffLng, setDropoffLng] = useState<number | null>(null)

  const [name, setName] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [grade, setGrade] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/children/${childId}`)
        if (!res.ok) throw new Error('Failed to load')
        const data = await res.json()
        setChild(data)
        setName(data.name ?? '')
        setSchoolName(data.schoolName ?? '')
        setGrade(data.grade ?? '')
        setPickupAddr(data.pickupAddress ?? '')
        setPickupLat(data.pickupLat)
        setPickupLng(data.pickupLng)
        setDropoffAddr(data.dropoffAddress ?? '')
        setDropoffLat(data.dropoffLat)
        setDropoffLng(data.dropoffLng)
      } catch {
        toast.error('Could not load child details')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [childId])

  const hasAddressChanges = () => {
    return (
      pickupAddr !== child?.pickupAddress ||
      pickupLat !== child?.pickupLat ||
      pickupLng !== child?.pickupLng ||
      dropoffAddr !== child?.dropoffAddress ||
      dropoffLat !== child?.dropoffLat ||
      dropoffLng !== child?.dropoffLng
    )
  }

  const handleSaveAddresses = async () => {
    if (!pickupAddr || !dropoffAddr) {
      toast.error('Please fill in both addresses')
      return
    }
    if (pickupLat == null || dropoffLat == null) {
      toast.error('Please select addresses from the suggestions')
      return
    }
    setSaving(true)
    try {
      const body: Record<string, any> = {}
      if (pickupAddr !== child?.pickupAddress) body.pickupAddress = pickupAddr
      if (pickupLat !== child?.pickupLat) body.pickupLat = pickupLat
      if (pickupLng !== child?.pickupLng) body.pickupLng = pickupLng
      if (dropoffAddr !== child?.dropoffAddress) body.dropoffAddress = dropoffAddr
      if (dropoffLat !== child?.dropoffLat) body.dropoffLat = dropoffLat
      if (dropoffLng !== child?.dropoffLng) body.dropoffLng = dropoffLng

      const res = await fetch(`/api/children/${childId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to save')
      toast.success('Addresses updated')
      setChild({ ...child, ...body })
    } catch {
      toast.error('Failed to save addresses')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveDetails = async () => {
    if (!name.trim() || !schoolName.trim()) {
      toast.error('Name and school are required')
      return
    }
    setSaving(true)
    try {
      const body: Record<string, any> = {}
      if (name !== child?.name) body.name = name
      if (schoolName !== child?.schoolName) body.schoolName = schoolName
      if (grade !== (child?.grade ?? '')) body.grade = grade

      if (Object.keys(body).length === 0) {
        toast.error('No changes to save')
        return
      }

      const res = await fetch(`/api/children/${childId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to save')
      toast.success('Details updated')
      setChild({ ...child, ...body })
    } catch {
      toast.error('Failed to save details')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FB]">
        <ParentTopBar title="Edit child" showBack />
        <div className="px-4 pt-4 space-y-4 animate-pulse">
          {[1, 2, 3].map(i => <div key={i} className="h-12 bg-[#E8EAED] rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <ParentTopBar title="Edit child" showBack />
      <div className="px-4 pt-4 pb-24 space-y-6">

        {/* Child name & school */}
        <div className="bg-white rounded-2xl border border-[rgba(26,63,122,0.10)] p-4 space-y-4">
          <p className="font-semibold text-sm text-[#0F1923]">Child details</p>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-[#5A6474]">Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} className="h-11 mt-1" />
            </div>
            <div>
              <Label className="text-xs text-[#5A6474]">School</Label>
              <Input value={schoolName} onChange={e => setSchoolName(e.target.value)} className="h-11 mt-1" />
            </div>
            <div>
              <Label className="text-xs text-[#5A6474]">Grade (optional)</Label>
              <Input value={grade} onChange={e => setGrade(e.target.value)} className="h-11 mt-1" />
            </div>
          </div>
          <Button
            onClick={handleSaveDetails}
            disabled={saving}
            size="sm"
            className="bg-[#1A3F7A] hover:bg-[#1A3F7A]/90 text-white font-semibold"
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            Save details
          </Button>
        </div>

        {/* Pickup address */}
        <div className="bg-white rounded-2xl border border-[rgba(26,63,122,0.10)] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#1A3F7A]" />
            <p className="font-semibold text-sm text-[#0F1923]">Pickup address (home)</p>
          </div>
          <AddressPicker
            label=""
            placeholder="Search for home address"
            value={pickupAddr}
            lat={pickupLat}
            lng={pickupLng}
            onChange={(addr, lat, lng) => {
              setPickupAddr(addr)
              setPickupLat(lat)
              setPickupLng(lng)
            }}
          />
        </div>

        {/* Dropoff address */}
        <div className="bg-white rounded-2xl border border-[rgba(26,63,122,0.10)] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <School className="w-4 h-4 text-[#1A3F7A]" />
            <p className="font-semibold text-sm text-[#0F1923]">Dropoff address (school)</p>
          </div>
          <AddressPicker
            label=""
            placeholder="Search for school address"
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

        <Button
          onClick={handleSaveAddresses}
          disabled={saving || !hasAddressChanges()}
          className="w-full h-12 bg-[#F5A623] hover:bg-[#F5A623]/90 text-[#0F1923] font-semibold rounded-xl text-base"
        >
          {saving ? 'Saving…' : 'Save address changes'}
        </Button>
      </div>
    </div>
  )
}
