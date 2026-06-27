'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ParentTopBar } from '@/components/parent/ParentTopBar'

type Category = 'UNSAFE_VEHICLE' | 'UNSAFE_BEHAVIOUR' | 'OTHER'

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'UNSAFE_VEHICLE',   label: 'Unsafe vehicle condition' },
  { value: 'UNSAFE_BEHAVIOUR', label: 'Unsafe driver behaviour' },
  { value: 'OTHER',            label: 'Other concern' },
]

export default function ReportPage() {
  const params = useParams()
  const driverId = params.driverId as string

  const [category, setCategory]       = useState<Category>('UNSAFE_VEHICLE')
  const [description, setDescription] = useState('')
  const [descError, setDescError]     = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [submitted, setSubmitted]     = useState(false)

  async function handleSubmit() {
    // Inline validation — min 10 characters
    if (description.trim().length < 10) {
      setDescError('Please provide at least 10 characters.')
      return
    }
    setDescError('')
    setSubmitting(true)

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId, category, description: description.trim() }),
      })

      if (res.status === 201) {
        setSubmitted(true)
        return
      }

      if (res.status === 403) {
        toast.error('You can only report your assigned driver')
        return
      }

      throw new Error('unexpected status')
    } catch {
      toast.error('Failed to submit report. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-[#F8F9FB]">
        <ParentTopBar title="Report a Concern" showBack />
        <div className="px-4 pt-16 pb-24 flex flex-col items-center text-center space-y-5">
          <div className="w-20 h-20 rounded-full bg-[#0F6E56]/10 flex items-center justify-center">
            <CheckCircle className="w-9 h-9 text-[#0F6E56]" />
          </div>
          <div>
            <p className="text-xl font-bold text-[#0F1923]">Report submitted</p>
            <p className="text-sm text-[#5A6474] mt-2 max-w-xs">
              Your concern has been forwarded to the admin team.
            </p>
          </div>
          <Link
            href="/parent-app/dashboard"
            className="w-full block"
          >
            <Button className="w-full h-12 bg-[#1A3F7A] hover:bg-[#1A3F7A]/90 text-white font-semibold rounded-xl">
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <ParentTopBar title="Report a Concern" showBack />
      <div className="px-4 pt-4 pb-24 space-y-5">

        {/* Category selection */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-[#5A6474]">Category</p>
          <div className="space-y-2">
            {CATEGORIES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(value)}
                className={`w-full flex items-center gap-3 h-12 px-4 rounded-xl border text-sm font-medium transition-colors text-left ${
                  category === value
                    ? 'border-[#1A3F7A] bg-[#1A3F7A]/05 text-[#1A3F7A]'
                    : 'border-[rgba(26,63,122,0.15)] bg-white text-[#0F1923] hover:border-[#1A3F7A]/40'
                }`}
              >
                {/* Radio dot */}
                <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                  category === value ? 'border-[#1A3F7A]' : 'border-[rgba(26,63,122,0.30)]'
                }`}>
                  {category === value && (
                    <span className="w-2 h-2 rounded-full bg-[#1A3F7A]" />
                  )}
                </span>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Description textarea */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-[#5A6474]">Description</p>
          <textarea
            value={description}
            onChange={e => {
              setDescription(e.target.value)
              // Clear inline error once user types enough
              if (descError && e.target.value.trim().length >= 10) setDescError('')
            }}
            placeholder="Please describe the concern in detail..."
            rows={5}
            className={`w-full text-sm border rounded-xl px-3 py-3 outline-none resize-none focus:border-[#1A3F7A] bg-white transition-colors ${
              descError
                ? 'border-[#E24B4A] focus:border-[#E24B4A]'
                : 'border-[rgba(26,63,122,0.15)]'
            }`}
          />
          <div className="flex justify-between items-center">
            {descError ? (
              <p className="text-xs text-[#E24B4A]">{descError}</p>
            ) : (
              <span />
            )}
            {/* Character counter */}
            <p className={`text-xs ml-auto ${
              description.length > 0 && description.trim().length < 10
                ? 'text-[#E24B4A]'
                : 'text-[#5A6474]'
            }`}>
              {description.length} characters
            </p>
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full h-12 bg-[#1A3F7A] hover:bg-[#1A3F7A]/90 text-white font-semibold rounded-xl text-base"
        >
          {submitting ? 'Submitting...' : 'Submit Report'}
        </Button>
      </div>
    </div>
  )
}
