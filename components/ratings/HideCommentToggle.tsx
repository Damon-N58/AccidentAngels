'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

interface HideCommentToggleProps {
  driverId: string
  ratingId: string
  isHidden: boolean
}

export function HideCommentToggle({ driverId, ratingId, isHidden }: HideCommentToggleProps) {
  const router = useRouter()
  // Optimistic local state
  const [hidden, setHidden] = useState(isHidden)
  const [loading, setLoading] = useState(false)

  async function handleToggle() {
    const newHidden = !hidden
    setHidden(newHidden) // optimistic update
    setLoading(true)

    try {
      const res = await fetch(`/api/ratings/${driverId}/${ratingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isHidden: newHidden }),
      })

      if (!res.ok) {
        setHidden(!newHidden) // revert on failure
        toast.error('Could not update')
        return
      }

      toast.success(newHidden ? 'Comment hidden' : 'Comment shown')
      router.refresh()
    } catch {
      setHidden(!newHidden) // revert on network error
      toast.error('Could not update')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading}
      className="flex items-center gap-1 text-xs text-[#5A6474] hover:text-[#ec3d3a] transition-colors disabled:opacity-50"
    >
      {hidden ? (
        <>
          <Eye className="w-3.5 h-3.5" />
          Show comment
        </>
      ) : (
        <>
          <EyeOff className="w-3.5 h-3.5" />
          Hide comment
        </>
      )}
    </button>
  )
}
