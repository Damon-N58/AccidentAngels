'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { StarRating } from './StarRating'

interface RateDriverPanelProps {
  driverId: string
  driverName: string
  initialRating: { score: number; comment: string | null } | null
  ratingAvg: number | null
  ratingCount: number
}

export function RateDriverPanel({
  driverId,
  driverName,
  initialRating,
  ratingAvg,
  ratingCount,
}: RateDriverPanelProps) {
  const router = useRouter()
  const [score, setScore] = useState<number>(initialRating?.score ?? 0)
  const [comment, setComment] = useState<string>(initialRating?.comment ?? '')
  const [submitting, setSubmitting] = useState(false)

  const hasExisting = initialRating != null

  async function handleSubmit() {
    if (score < 1) {
      toast.error('Please select a star rating')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId, score, comment: comment.trim() || undefined }),
      })
      const data = await res.json()
      if (res.status === 403) {
        toast.error(data.error ?? 'You are not authorised to rate this driver')
        return
      }
      if (!res.ok) {
        toast.error(data.error ?? 'Something went wrong. Please try again.')
        return
      }
      toast.success('Thanks for your rating')
      router.refresh()
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-[rgba(236,61,58,0.10)] p-4 space-y-4">
      {/* Aggregate rating header */}
      <div>
        <p className="font-semibold text-sm text-[#0F1923] mb-2">Community rating</p>
        <div className="flex items-center gap-2">
          <span className="text-3xl font-bold text-[#0F1923] leading-none">
            {ratingAvg != null ? ratingAvg.toFixed(1) : '—'}
          </span>
          <div className="flex flex-col gap-0.5">
            <StarRating value={ratingAvg} readonly size="sm" />
            <span className="text-xs text-[#5A6474]">
              {ratingCount > 0
                ? `from ${ratingCount} parent${ratingCount !== 1 ? 's' : ''}`
                : 'No ratings yet'}
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-[rgba(236,61,58,0.06)]" />

      {/* Parent's own rating */}
      <div className="space-y-3">
        <p className="font-semibold text-sm text-[#0F1923]">Your rating</p>
        <StarRating value={score === 0 ? null : score} onChange={setScore} size="lg" />
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add a comment (optional)"
          rows={3}
          className="w-full rounded-xl border border-[rgba(236,61,58,0.15)] px-3 py-2 text-sm text-[#0F1923] placeholder:text-[#5A6474] resize-none focus:outline-none focus:ring-2 focus:ring-[#ec3d3a]/30 transition"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full rounded-xl bg-[#ec3d3a] text-white text-sm font-semibold py-2.5 disabled:opacity-50 transition active:scale-[0.98]"
        >
          {submitting ? 'Submitting…' : hasExisting ? 'Update rating' : 'Submit rating'}
        </button>
      </div>
    </div>
  )
}
