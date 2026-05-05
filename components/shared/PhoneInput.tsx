'use client'

import { ChangeEvent } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface PhoneInputProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
}

export function PhoneInput({ value, onChange, disabled, placeholder = '082 000 0000', className }: PhoneInputProps) {
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, '').replace(/^27/, '0').slice(0, 10)
    onChange(raw)
  }

  function format(digits: string): string {
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
  }

  return (
    <div className={cn('flex items-center border-2 rounded-xl overflow-hidden bg-white', 'border-[rgba(26,63,122,0.20)] focus-within:border-[#1A3F7A]', className)}>
      <span className="px-3 py-3 text-[#5A6474] font-medium text-sm bg-[#F8F9FB] border-r border-[rgba(26,63,122,0.12)] select-none">
        +27
      </span>
      <Input
        type="tel"
        inputMode="numeric"
        value={format(value)}
        onChange={handleChange}
        disabled={disabled}
        placeholder={placeholder}
        className="border-0 ring-0 focus-visible:ring-0 focus-visible:border-0 h-12 text-base rounded-none bg-white"
      />
    </div>
  )
}
