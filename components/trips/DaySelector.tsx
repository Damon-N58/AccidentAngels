'use client'

import { cn } from '@/lib/utils'
import { DAY_LABELS } from '@/lib/trips/types'

interface DaySelectorProps {
  selectedDays: number[]
  onChange: (days: number[]) => void
  disabled?: boolean
}

export function DaySelector({ selectedDays, onChange, disabled }: DaySelectorProps) {
  // Days 1-5 (Mon-Fri), skip Sun(0) and Sat(6) in the UI
  const days = [1, 2, 3, 4, 5]

  const toggle = (day: number) => {
    if (disabled) return
    if (selectedDays.includes(day)) {
      onChange(selectedDays.filter(d => d !== day))
    } else {
      onChange([...selectedDays, day].sort())
    }
  }

  return (
    <div className="flex gap-2">
      {days.map(day => {
        const isSelected = selectedDays.includes(day)
        return (
          <button
            key={day}
            type="button"
            disabled={disabled}
            onClick={() => toggle(day)}
            className={cn(
              'w-10 h-10 rounded-full text-sm font-semibold transition-colors',
              isSelected
                ? 'bg-[#ec3d3a] text-white'
                : 'bg-[#F8F9FB] text-[#5A6474] border border-[rgba(236,61,58,0.15)] hover:border-[#ec3d3a]/30',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            {DAY_LABELS[day][0]}
          </button>
        )
      })}
    </div>
  )
}
