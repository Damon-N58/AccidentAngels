/**
 * Parse a timestamp that may lack a timezone designator as UTC.
 *
 * Supabase/Postgres `TIMESTAMP(3)` (without time zone) columns store the UTC
 * wall-clock we write via `toISOString()`, but return it WITHOUT a trailing `Z`
 * (e.g. "2026-06-26T14:07:03.935"). Passing that straight to `new Date()` makes
 * JS interpret it in the runtime's LOCAL zone — correct on a UTC server, but off
 * by the local offset anywhere else (e.g. +2h in SAST). This normalises such
 * strings to UTC so comparisons are timezone-safe on any host or browser.
 */
export function toUtcDate(value: string | Date): Date {
  if (value instanceof Date) return value
  const hasTz = /[zZ]$|[+-]\d\d:?\d\d$/.test(value)
  return new Date(hasTz ? value : value + 'Z')
}
