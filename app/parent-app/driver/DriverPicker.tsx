'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { User, Car, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'

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

export function ParentDriverPicker({
  childId,
  childName,
}: {
  childId: string
  childName: string
}) {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(false)
  const [assigning, setAssigning] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (open && drivers.length === 0) {
      loadDrivers()
    }
  }, [open])

  async function loadDrivers() {
    setLoading(true)
    try {
      const res = await fetch('/api/drivers')
      const data = await res.json()
      setDrivers(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Could not load drivers')
    } finally {
      setLoading(false)
    }
  }

  async function assignDriver(driverId: string) {
    setAssigning(driverId)
    try {
      const res = await fetch(`/api/children/${childId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to assign driver')
      }
      toast.success('Driver assigned!')
      setOpen(false)
      // Small delay to let user see the toast before page re-renders
      setTimeout(() => window.location.reload(), 800)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setAssigning(null)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-[rgba(26,63,122,0.10)] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div>
          <p className="font-semibold text-sm text-[#0F1923]">{childName}</p>
          <p className="text-xs text-[#F59E0B] mt-0.5">No driver assigned — tap to choose one</p>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-[#5A6474] shrink-0" />
          : <ChevronDown className="w-4 h-4 text-[#5A6474] shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-[rgba(26,63,122,0.06)] pt-3 space-y-2">
          {loading ? (
            <div className="text-center py-6 text-sm text-[#5A6474]">Loading drivers…</div>
          ) : drivers.length === 0 ? (
            <div className="text-center py-6 text-sm text-[#5A6474]">No active drivers available</div>
          ) : (
            drivers.map(d => {
              const vehicle = [d.vehicleColour, d.vehicleMake, d.vehicleModel].filter(Boolean).join(' ')
              return (
                <button
                  key={d.id}
                  onClick={() => assignDriver(d.id)}
                  disabled={assigning !== null}
                  className="w-full text-left rounded-xl border border-[rgba(26,63,122,0.12)] p-3 hover:border-[#1A3F7A]/30 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#1A3F7A]/10 flex items-center justify-center shrink-0">
                      {d.profilePhotoUrl
                        ? <img src={d.profilePhotoUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                        : <User className="w-4 h-4 text-[#1A3F7A]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm text-[#0F1923]">{d.user.name}</p>
                        {assigning === d.id && <span className="text-xs text-[#1A3F7A]">Assigning…</span>}
                      </div>
                      {vehicle && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Car className="w-3 h-3 text-[#5A6474]" />
                          <span className="text-xs text-[#5A6474]">{vehicle}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-3 h-3 text-[#0F6E56]" />
                        <span className="text-xs text-[#0F6E56]">{d.approvedDocsCount}/6 docs verified</span>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
