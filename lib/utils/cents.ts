// Convert rands (number) to cents — e.g. 300 → 30000
export function toCents(rands: number): number {
  return Math.round(rands * 100)
}

// Convert cents to rands — e.g. 30000 → 300
export function toRands(cents: number): number {
  return cents / 100
}

// Format cents as ZAR string — e.g. 30000 → "R 300.00"
export function formatZAR(cents: number, opts?: { compact?: boolean }): string {
  const rands = toRands(cents)
  if (opts?.compact && rands >= 1000) {
    return `R ${(rands / 1000).toFixed(1)}k`
  }
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(rands)
}
