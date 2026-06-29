'use client'

import { cn } from '@/lib/utils'

interface TripProgressBarProps {
  completedStops: number
  totalStops: number
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
}

export function TripProgressBar({ completedStops, totalStops, status }: TripProgressBarProps) {
  const pct = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0

  const barColor =
    status === 'COMPLETED' ? 'bg-[#0F6E56]' :
    status === 'IN_PROGRESS' ? 'bg-[#ec3d3a]' :
    'bg-[#5A6474]'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-[#5A6474]">
        <span>
          {status === 'COMPLETED' ? 'Completed' :
           status === 'IN_PROGRESS' ? 'In progress' :
           status === 'SCHEDULED' ? 'Scheduled' : 'Cancelled'}
        </span>
        <span>{completedStops}/{totalStops} stops</span>
      </div>
      <div className="h-1.5 bg-[#E8EAED] rounded-full overflow-hidden" role="progressbar" aria-valuenow={completedStops} aria-valuemin={0} aria-valuemax={totalStops} aria-label={`${completedStops} of ${totalStops} stops completed`}>
        <div
          className={cn('h-full rounded-full transition-all duration-500', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
