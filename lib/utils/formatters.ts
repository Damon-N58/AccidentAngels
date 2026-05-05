import { format, formatDistanceToNow, differenceInDays, isPast } from 'date-fns'

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('27') && digits.length === 11) {
    return `0${digits.slice(2, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
  }
  return phone
}

export function formatDate(date: Date | string): string {
  return format(new Date(date), 'd MMM yyyy')
}

export function formatDateTime(date: Date | string): string {
  return format(new Date(date), 'd MMM yyyy, HH:mm')
}

export function formatRelative(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

// Returns how many days until expiry, or negative if expired
export function daysUntilExpiry(expiryDate: Date | string): number {
  return differenceInDays(new Date(expiryDate), new Date())
}

// Expiry colour: green > 30d, amber 8-30d, red ≤7d or past
export function expiryColor(expiryDate: Date | string | null | undefined): 'green' | 'amber' | 'red' {
  if (!expiryDate) return 'red'
  const days = daysUntilExpiry(expiryDate)
  if (days > 30) return 'green'
  if (days > 7)  return 'amber'
  return 'red'
}

export function isExpired(expiryDate: Date | string | null | undefined): boolean {
  if (!expiryDate) return false
  return isPast(new Date(expiryDate))
}

export function formatBillingMonth(month: number, year: number): string {
  return format(new Date(year, month - 1), 'MMMM yyyy')
}
