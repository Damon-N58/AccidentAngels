'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'

const SIZE_MAP = {
  sm: 'w-3.5 h-3.5',
  md: 'w-5 h-5',
  lg: 'w-7 h-7',
}

interface StarRatingProps {
  value: number | null
  onChange?: (v: number) => void
  readonly?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function StarRating({ value, onChange, readonly = false, size = 'md' }: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  // Round value to nearest integer for fill threshold
  const filled = hovered ?? (value != null ? Math.round(value) : 0)
  const sizeClass = SIZE_MAP[size]
  const interactive = !readonly && onChange != null

  return (
    <div className="flex items-center gap-0.5" role={interactive ? 'group' : undefined} aria-label={`Rating: ${value ?? 0} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const isFilled = star <= filled
        return (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onChange?.(star)}
            onMouseEnter={() => interactive && setHovered(star)}
            onMouseLeave={() => interactive && setHovered(null)}
            // Remove button chrome when readonly
            className={interactive
              ? 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5A623] rounded'
              : 'cursor-default pointer-events-none'}
            aria-label={`${star} star${star !== 1 ? 's' : ''}`}
          >
            <Star
              className={sizeClass}
              style={isFilled
                ? { fill: '#F5A623', stroke: '#F5A623' }
                : { fill: 'none', stroke: '#D1D5DB' }}
            />
          </button>
        )
      })}
    </div>
  )
}
