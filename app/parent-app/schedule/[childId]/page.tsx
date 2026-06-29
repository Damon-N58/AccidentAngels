'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { ParentTopBar } from '@/components/parent/ParentTopBar'
import { DaySelector } from '@/components/trips/DaySelector'
import { TimeWindowPicker } from '@/components/trips/TimeWindowPicker'
import { Button } from '@/components/ui/button'
import type { ChildScheduleData } from '@/lib/trips/types'

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
  const [morningPickupEarliest, setMorningPickupEarliest] = useState('06:45')
  const [morningPickupLatest, setMorningPickupLatest] = useState('07:15')
  const [morningDropoffEarliest, setMorningDropoffEarliest] = useState('07:45')
  const [morningDropoffLatest, setMorningDropoffLatest] = useState('08:00')
  const [afternoonPickupEarliest, setAfternoonPickupEarliest] = useState('14:00')
  const [afternoonPickupLatest, setAfternoonPickupLatest] = useState('14:30')
  const [afternoonDropoffEarliest, setAfternoonDropoffEarliest] = useState('14:45')
  const [afternoonDropoffLatest, setAfternoonDropoffLatest] = useState('15:30')

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
            if (active.morningPickupEarliest) setMorningPickupEarliest(active.morningPickupEarliest)
            if (active.morningPickupLatest) setMorningPickupLatest(active.morningPickupLatest)
            if (active.morningDropoffEarliest) setMorningDropoffEarliest(active.morningDropoffEarliest)
            if (active.morningDropoffLatest) setMorningDropoffLatest(active.morningDropoffLatest)
            if (active.afternoonPickupEarliest) setAfternoonPickupEarliest(active.afternoonPickupEarliest)
            if (active.afternoonPickupLatest) setAfternoonPickupLatest(active.afternoonPickupLatest)
            if (active.afternoonDropoffEarliest) setAfternoonDropoffEarliest(active.afternoonDropoffEarliest)
            if (active.afternoonDropoffLatest) setAfternoonDropoffLatest(active.afternoonDropoffLatest)
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
        morningPickupEarliest,
        morningPickupLatest,
        morningDropoffEarliest,
        morningDropoffLatest,
        afternoonPickupEarliest,
        afternoonPickupLatest,
        afternoonDropoffEarliest,
        afternoonDropoffLatest,
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
        <div className="bg-[#ec3d3a]/05 rounded-xl p-4 text-sm text-[#5A6474] space-y-1.5">
          <p className="font-semibold text-[#0F1923]">How this works</p>
          <p>Set the days your child needs transport and the time windows for pickup and dropoff. Your driver will see the daily schedule and route on their app.</p>
          <p className="text-xs text-[#5A6474] mt-2">One-off schedule changes (e.g. skipping a day) can be done from the trips page.</p>
        </div>

        {/* Days of week */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[#0F1923]">School days</p>
          <DaySelector selectedDays={daysOfWeek} onChange={setDaysOfWeek} />
        </div>

        {/* Morning window */}
        <div className="bg-white rounded-2xl border border-[rgba(236,61,58,0.10)] p-4 space-y-3">
          <p className="font-semibold text-sm text-[#0F1923]">Morning pickup from home</p>
          <TimeWindowPicker
            label="Pickup window"
            earliest={morningPickupEarliest}
            latest={morningPickupLatest}
            onChange={(e, l) => { setMorningPickupEarliest(e); setMorningPickupLatest(l) }}
          />
          <TimeWindowPicker
            label="Dropoff at school by"
            earliest={morningDropoffEarliest}
            latest={morningDropoffLatest}
            onChange={(e, l) => { setMorningDropoffEarliest(e); setMorningDropoffLatest(l) }}
          />
        </div>

        {/* Afternoon window */}
        <div className="bg-white rounded-2xl border border-[rgba(236,61,58,0.10)] p-4 space-y-3">
          <p className="font-semibold text-sm text-[#0F1923]">Afternoon pickup from school</p>
          <TimeWindowPicker
            label="Pickup window"
            earliest={afternoonPickupEarliest}
            latest={afternoonPickupLatest}
            onChange={(e, l) => { setAfternoonPickupEarliest(e); setAfternoonPickupLatest(l) }}
          />
          <TimeWindowPicker
            label="Dropoff at home by"
            earliest={afternoonDropoffEarliest}
            latest={afternoonDropoffLatest}
            onChange={(e, l) => { setAfternoonDropoffEarliest(e); setAfternoonDropoffLatest(l) }}
          />
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-12 bg-[#ec3d3a] hover:bg-[#ec3d3a]/90 text-white font-semibold rounded-xl text-base"
        >
          {saving ? 'Saving…' : schedule ? 'Update schedule' : 'Save schedule'}
        </Button>
      </div>
    </div>
  )
}
