'use client'

import { ChevronLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function BackButton({ className }: { className?: string }) {
  const router = useRouter()
  return (
    <button
      onClick={() => router.back()}
      aria-label="Go back"
      className={className ?? 'p-1 -ml-1 rounded-lg'}
    >
      <ChevronLeft className="w-6 h-6" />
    </button>
  )
}
