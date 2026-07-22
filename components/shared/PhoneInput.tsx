'use client'

import { useRef, KeyboardEvent, ClipboardEvent, ChangeEvent } from 'react'
import { cn } from '@/lib/utils'

interface PhoneInputProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}

const DIGIT_COUNT = 9 // digits after the fixed leading 0

export function PhoneInput({ value, onChange, disabled, className }: PhoneInputProps) {
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const trailing = value.startsWith('0') ? value.slice(1) : value
  const digits = Array.from({ length: DIGIT_COUNT }, (_, i) => trailing[i] ?? '')

  function focus(idx: number) {
    inputs.current[Math.max(0, Math.min(DIGIT_COUNT - 1, idx))]?.focus()
  }

  function emit(next: string[]) {
    onChange('0' + next.join(''))
  }

  function handleChange(idx: number, e: ChangeEvent<HTMLInputElement>) {
    const char = e.target.value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[idx] = char
    emit(next)
    if (char) focus(idx + 1)
  }

  function handleKeyDown(idx: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[idx]) {
      focus(idx - 1)
    }
    if (e.key === 'ArrowLeft') focus(idx - 1)
    if (e.key === 'ArrowRight') focus(idx + 1)
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    let pasted = e.clipboardData.getData('text').replace(/\D/g, '')
    if (pasted.startsWith('27') && pasted.length >= 11) pasted = pasted.slice(2)
    else if (pasted.startsWith('0')) pasted = pasted.slice(1)
    pasted = pasted.slice(0, DIGIT_COUNT)
    const next = Array.from({ length: DIGIT_COUNT }, (_, i) => pasted[i] ?? '')
    emit(next)
    focus(Math.min(pasted.length, DIGIT_COUNT - 1))
  }

  const cells = [
    <div
      key="locked-0"
      aria-hidden
      className="w-7 h-10 flex items-center justify-center text-base font-bold border-b-2 border-[rgba(236,61,58,0.20)] text-[#5A6474] select-none shrink-0"
    >
      0
    </div>,
    ...digits.map((d, i) => (
      <input
        key={i}
        ref={(el) => { inputs.current[i] = el }}
        type="text"
        inputMode="numeric"
        pattern="\d*"
        maxLength={1}
        value={d}
        onChange={(e) => handleChange(i, e)}
        onKeyDown={(e) => handleKeyDown(i, e)}
        onPaste={handlePaste}
        disabled={disabled}
        className={cn(
          'w-7 h-10 shrink-0 text-center text-base font-bold border-b-2 bg-transparent',
          'focus:outline-none focus:ring-0',
          'transition-colors',
          d ? 'border-[#ec3d3a] text-[#ec3d3a]' : 'border-[rgba(236,61,58,0.20)] text-[#0F1923]',
          'focus:border-[#ec3d3a]',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      />
    )),
  ]

  // Group like "079 786 7872": 3 + 3 + 4
  const groups = [cells.slice(0, 3), cells.slice(3, 6), cells.slice(6, 10)]

  return (
    <div className={cn('flex gap-3 justify-center', className)}>
      {groups.map((group, gi) => (
        <div key={gi} className="flex gap-1">
          {group}
        </div>
      ))}
    </div>
  )
}
