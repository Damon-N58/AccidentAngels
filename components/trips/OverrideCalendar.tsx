'use client'

import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'

interface OverrideCalendarProps {
  month: Date
  scheduleDays: number[]
  overrides: Map<string, 'SKIP' | 'ADD'>
  onToggleDate: (date: string) => void
  onMonthChange: (date: Date) => void
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function OverrideCalendar({
  month,
  scheduleDays,
  overrides,
  onToggleDate,
  onMonthChange,
}: OverrideCalendarProps) {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()

  const firstDay = new Date(year, monthIndex, 1).getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const formatDate = (day: number) => {
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  return (
    <div className="space-y-2">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            const d = new Date(month)
            d.setMonth(d.getMonth() - 1)
            onMonthChange(d)
          }}
          className="p-1 hover:bg-[#F8F9FB] rounded-lg transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-[#5A6474]" />
        </button>
        <span className="text-sm font-semibold text-[#0F1923]">
          {MONTHS[monthIndex]} {year}
        </span>
        <button
          onClick={() => {
            const d = new Date(month)
            d.setMonth(d.getMonth() + 1)
            onMonthChange(d)
          }}
          className="p-1 hover:bg-[#F8F9FB] rounded-lg transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-[#5A6474]" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} className="text-xs font-medium text-[#5A6474] py-1">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />

          const dateStr = formatDate(day)
          const isToday = dateStr === todayStr
          const dayOfWeek = new Date(year, monthIndex, day).getDay()
          const isScheduledDay = scheduleDays.includes(dayOfWeek)
          const override = overrides.get(dateStr)
          const isPast = new Date(dateStr) < new Date(todayStr)

          return (
            <button
              key={dateStr}
              disabled={isPast}
              onClick={() => onToggleDate(dateStr)}
              className={cn(
                'relative h-9 text-sm rounded-lg transition-colors flex items-center justify-center',
                isToday && 'ring-2 ring-[#ec3d3a] ring-offset-1',
                override === 'SKIP' ? 'bg-[#E24B4A]/10 text-[#E24B4A]' :
                override === 'ADD' ? 'bg-[#0F6E56]/10 text-[#0F6E56]' :
                isScheduledDay && !isPast ? 'bg-[#ec3d3a]/10 text-[#0F1923]' :
                'text-[#5A6474] hover:bg-[#F8F9FB]',
                isPast && 'opacity-40 cursor-not-allowed',
              )}
            >
              {day}
              {isScheduledDay && !override && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-[#ec3d3a]" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
