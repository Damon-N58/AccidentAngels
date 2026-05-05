'use client'

import { useRef, KeyboardEvent, ClipboardEvent, ChangeEvent } from 'react'
import { cn } from '@/lib/utils'

interface OtpInputProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  error?: boolean
}

export function OtpInput({ value, onChange, disabled, error }: OtpInputProps) {
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '')

  function focus(idx: number) {
    inputs.current[Math.max(0, Math.min(5, idx))]?.focus()
  }

  function handleChange(idx: number, e: ChangeEvent<HTMLInputElement>) {
    const char = e.target.value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[idx] = char
    onChange(next.join('').replace(/ /g, ''))
    if (char) focus(idx + 1)
  }

  function handleKeyDown(idx: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[idx]) {
      focus(idx - 1)
    }
    if (e.key === 'ArrowLeft')  focus(idx - 1)
    if (e.key === 'ArrowRight') focus(idx + 1)
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    onChange(pasted)
    focus(Math.min(pasted.length, 5))
  }

  return (
    <div className="flex gap-2 justify-center">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { inputs.current[i] = el }}
          type="text"
          inputMode="numeric"
          pattern="\d*"
          maxLength={1}
          value={d === ' ' ? '' : d}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          disabled={disabled}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          className={cn(
            'w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 bg-white',
            'focus:outline-none focus:ring-0',
            'transition-colors',
            error
              ? 'border-[#E24B4A] text-[#E24B4A]'
              : d && d !== ' '
              ? 'border-[#1A3F7A] text-[#1A3F7A]'
              : 'border-[rgba(26,63,122,0.20)] text-[#0F1923]',
            'focus:border-[#1A3F7A]',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        />
      ))}
    </div>
  )
}
