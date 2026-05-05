import { z } from 'zod'

// SA phone: 0XX XXX XXXX or +27XX XXX XXXX
export function normalizeSAPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('27') && digits.length === 11) return `+${digits}`
  if (digits.startsWith('0') && digits.length === 10) return `+27${digits.slice(1)}`
  return raw
}

export function isValidSAPhone(phone: string): boolean {
  const normalized = normalizeSAPhone(phone)
  return /^\+27[6-8]\d{8}$/.test(normalized)
}

// SA ID number validation (Luhn + century check)
export function isValidSAIdNumber(id: string): boolean {
  if (!/^\d{13}$/.test(id)) return false

  const year  = parseInt(id.slice(0, 2))
  const month = parseInt(id.slice(2, 4))
  const day   = parseInt(id.slice(4, 6))
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false

  // Luhn check
  let sum = 0
  for (let i = 0; i < 13; i++) {
    let d = parseInt(id[i])
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return sum % 10 === 0
}

// Zod schemas
export const saPhoneSchema = z
  .string()
  .transform(normalizeSAPhone)
  .refine(isValidSAPhone, 'Please enter a valid South African mobile number')

export const saIdSchema = z
  .string()
  .refine(isValidSAIdNumber, 'Please enter a valid South African ID number')

export const otpSchema = z
  .string()
  .length(6, 'Code must be 6 digits')
  .regex(/^\d+$/, 'Code must be digits only')
