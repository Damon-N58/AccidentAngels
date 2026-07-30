'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { ParentTopBar } from '@/components/parent/ParentTopBar'
import { DaySelector } from '@/components/trips/DaySelector'
import { Button } from '@/components/ui/button'
import type { ChildScheduleData } from '@/lib/trips/types'

/** Single time input (replaces the old earliest–latest window picker). */
function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm text-[#0F1923]">{label}</span>
      <input
        type="time"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-11 rounded-xl border border-[rgba(236,61,58,0.15)] bg-white px-3 text-base text-[#0F1923] outline-none focus:border-[#c1272d]"
      />
    </label>
  )
}

export default function ParentChildSchedulePage({
  params,
}: {
  params: Promise<{ childId: string }>
}) {
  const { childId } = use(params)
  const router = useRouter()
  const [child, setChild] = useState<any>(null)
  const [schedule, setSchedule] = useState<ChildScheduleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5])
  // Single times (not windows). Each is persisted into BOTH the *Earliest and
  // *Latest DB columns so the schema is unchanged and nothing downstream breaks.
  const [morningPickup, setMorningPickup] = useState('06:45')
  const [morningDropoff, setMorningDropoff] = useState('08:00')
  const [afternoonPickup, setAfternoonPickup] = useState('14:00')
  const [afternoonDropoff, setAfternoonDropoff] = useState('15:00')

  useEffect(() => {
    const load = async () => {
      try {
        const [childRes, schedRes] = await Promise.all([
          fetch(`/api/children/${childId}`),
          fetch(`/api/children/${childId}/schedule`),
        ])
        if (!childRes.ok) throw new Error('Failed to load child')
        const childData = await childRes.json()
        setChild(childData)

        if (schedRes.ok) {
          const scheds: ChildScheduleData[] = await schedRes.json()
          const active = scheds.find(s => s.isActive)
          if (active) {
            setSchedule(active)
            setDaysOfWeek(active.daysOfWeek)
            // Prefer the stored Earliest as the single time (falls back to Latest).
            const mp = active.morningPickupEarliest || active.morningPickupLatest
            const md = active.morningDropoffEarliest || active.morningDropoffLatest
            const ap = active.afternoonPickupEarliest || active.afternoonPickupLatest
            const ad = active.afternoonDropoffEarliest || active.afternoonDropoffLatest
            if (mp) setMorningPickup(mp)
            if (md) setMorningDropoff(md)
            if (ap) setAfternoonPickup(ap)
            if (ad) setAfternoonDropoff(ad)
          }
        }
      } catch {
        toast.error('Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [childId])

  const handleSave = async () => {
    setSaving(true)
    try {
      const method = schedule ? 'POST' : 'POST'
      const body = {
        daysOfWeek,
        startDate: schedule?.startDate ?? new Date().toISOString().split('T')[0],
        // Single time written to both window columns (earliest === latest).
        morningPickupEarliest:    morningPickup,
        morningPickupLatest:      morningPickup,
        morningDropoffEarliest:   morningDropoff,
        morningDropoffLatest:     morningDropoff,
        afternoonPickupEarliest:  afternoonPickup,
        afternoonPickupLatest:    afternoonPickup,
        afternoonDropoffEarliest: afternoonDropoff,
        afternoonDropoffLatest:   afternoonDropoff,
      }
      const res = await fetch(`/api/children/${childId}/schedule`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to save')
      const saved = await res.json()
      setSchedule(saved)
      toast.success('Schedule saved')
    } catch {
      toast.error('Failed to save schedule')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FB]">
        <ParentTopBar title="Schedule" showBack />
        <div className="px-4 pt-4 space-y-4 animate-pulse">
          <div className="h-5 bg-[#E8EAED] rounded w-1/3 mb-3" />
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-[#E8EAED] rounded" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <ParentTopBar title="Schedule" showBack />
      <div className="px-4 pt-4 pb-24 space-y-6">
        {/* Child info */}
        {child && (
          <div>
            <p className="text-lg font-bold text-[#0F1923]">{child.name}</p>
            <p className="text-sm text-[#5A6474]">{child.schoolName}</p>
          </div>
        )}

        {/* Explanation banner */}
        <div className="bg-[#c1272d]/5 rounded-xl p-4 text-sm text-[#5A6474] space-y-1.5">
          <p className="font-semibold text-[#0F1923]">How this works</p>
          <p>Set the days your child needs transport and their pickup and drop-off times. Your driver will see the daily schedule and route on their app.</p>
          <p className="text-xs text-[#5A6474] mt-2">One-off schedule changes (e.g. skipping a day) can be done from the trips page.</p>
        </div>

        {/* Days of week */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[#0F1923]">School days</p>
          <DaySelector selectedDays={daysOfWeek} onChange={setDaysOfWeek} />
        </div>

        {/* Morning times */}
        <div className="bg-white rounded-2xl border border-[rgba(236,61,58,0.10)] p-4 space-y-3">
          <p className="font-semibold text-sm text-[#0F1923]">Morning</p>
          <TimeField label="Pickup from home" value={morningPickup} onChange={setMorningPickup} />
          <TimeField label="Drop off at school by" value={morningDropoff} onChange={setMorningDropoff} />
        </div>

        {/* Afternoon times */}
        <div className="bg-white rounded-2xl border border-[rgba(236,61,58,0.10)] p-4 space-y-3">
          <p className="font-semibold text-sm text-[#0F1923]">Afternoon</p>
          <TimeField label="Pickup from school" value={afternoonPickup} onChange={setAfternoonPickup} />
          <TimeField label="Drop off at home by" value={afternoonDropoff} onChange={setAfternoonDropoff} />
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-12 bg-[#c1272d] hover:bg-[#c1272d]/90 text-white font-semibold rounded-xl text-base"
        >
          {saving ? 'Saving…' : schedule ? 'Update schedule' : 'Save schedule'}
        </Button>
      </div>
    </div>
  )
}
