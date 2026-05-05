'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ParentTopBar } from '@/components/parent/ParentTopBar'
import { Button } from '@/components/ui/button'
import { CalendarDays, ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'

export default function BookTripPage() {
  const router = useRouter()
  const [children, setChildren] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedChildId, setSelectedChildId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [tripType, setTripType] = useState<'MORNING' | 'AFTERNOON'>('MORNING')
  const [reason, setReason] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/children')
        if (!res.ok) throw new Error('Failed to load')
        const data = await res.json()
        setChildren(data)
        if (data.length > 0) setSelectedChildId(data[0].id)
      } catch {
        toast.error('Could not load children')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSubmit = async () => {
    if (!selectedChildId) {
      toast.error('Please select a child')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/children/${selectedChildId}/overrides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          action: 'ADD',
          reason: reason || null,
          overrideTime: tripType === 'MORNING' ? '06:00' : '13:00',
        }),
      })
      if (!res.ok) throw new Error('Failed to book')
      toast.success('Trip booked!')
      router.push('/parent-app/trips')
    } catch {
      toast.error('Failed to book trip')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <ParentTopBar title="Book a trip" showBack />
      <div className="px-4 pt-4 pb-24 space-y-5">

        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-10 bg-[#E8EAED] rounded" />
            <div className="h-10 bg-[#E8EAED] rounded" />
            <div className="h-10 bg-[#E8EAED] rounded" />
          </div>
        ) : children.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[rgba(26,63,122,0.10)] p-6 text-center">
            <CalendarDays className="w-8 h-8 text-[#5A6474] mx-auto mb-2" />
            <p className="text-sm font-medium text-[#0F1923]">No children added yet</p>
            <p className="text-xs text-[#5A6474] mt-1">
              Add a child first before booking trips.
            </p>
            <Button
              onClick={() => router.push('/parent-app/children/add')}
              className="mt-4 bg-[#1A3F7A] hover:bg-[#1A3F7A]/90 text-white font-semibold"
            >
              Add a child
            </Button>
          </div>
        ) : (
          <>
            {/* Child selector */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-[#5A6474]">Child</p>
              <select
                value={selectedChildId}
                onChange={e => setSelectedChildId(e.target.value)}
                className="w-full h-11 text-sm border border-[rgba(26,63,122,0.15)] rounded-xl px-3 outline-none focus:border-[#1A3F7A] bg-white"
              >
                {children.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name} — {c.schoolName}</option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-[#5A6474]">Date</p>
              <input
                type="date"
                value={date}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setDate(e.target.value)}
                className="w-full h-11 text-sm border border-[rgba(26,63,122,0.15)] rounded-xl px-3 outline-none focus:border-[#1A3F7A]"
              />
            </div>

            {/* Trip type */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-[#5A6474]">Trip type</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setTripType('MORNING')}
                  className={`flex-1 h-11 text-sm font-semibold rounded-xl transition-colors ${
                    tripType === 'MORNING'
                      ? 'bg-[#1A3F7A] text-white'
                      : 'bg-white border border-[rgba(26,63,122,0.15)] text-[#5A6474]'
                  }`}
                >
                  Morning
                </button>
                <button
                  onClick={() => setTripType('AFTERNOON')}
                  className={`flex-1 h-11 text-sm font-semibold rounded-xl transition-colors ${
                    tripType === 'AFTERNOON'
                      ? 'bg-[#1A3F7A] text-white'
                      : 'bg-white border border-[rgba(26,63,122,0.15)] text-[#5A6474]'
                  }`}
                >
                  Afternoon
                </button>
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-[#5A6474]">Reason (optional)</p>
              <input
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Extra practice at school"
                className="w-full h-11 text-sm border border-[rgba(26,63,122,0.15)] rounded-xl px-3 outline-none focus:border-[#1A3F7A]"
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full h-12 bg-[#1A3F7A] hover:bg-[#1A3F7A]/90 text-white font-semibold rounded-xl text-base"
            >
              {submitting ? 'Booking…' : 'Book trip'}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
