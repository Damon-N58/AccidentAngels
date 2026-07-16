import { supabase } from '@/lib/supabase'
import { encrypt } from '@/lib/auth/encryption'

const MIN_VEHICLE_YEAR = 1990
const MAX_VEHICLE_YEAR = 2100
const MIN_CAPACITY = 1
const MAX_CAPACITY = 30

function parseIntInRange(raw: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(raw.trim())) return null
  const n = parseInt(raw, 10)
  if (n < min || n > max) return null
  return n
}

function isNumericString(raw: string): boolean {
  return /^\d+$/.test(raw.trim())
}

export async function onboardDriver(userId: string, input: {
  details: { name: string; getsNumber?: string }
  vehicle: { make?: string; model?: string; year?: string; registration?: string; colour?: string; capacity?: string }
  associationId?: string
  banking: { bankName?: string; accountName?: string; accountNumber?: string; branchCode?: string }
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { details, vehicle, associationId, banking } = input

  const { data: existing } = await supabase.from('Driver').select('id').eq('userId', userId).maybeSingle()
  if (existing) {
    return { ok: false, error: 'Driver profile already exists', status: 409 }
  }

  if (associationId) {
    const { data: association } = await supabase.from('Association').select('id').eq('id', associationId).maybeSingle()
    if (!association) {
      return { ok: false, error: 'Invalid association', status: 400 }
    }
  }

  let vehicleYear: number | null = null
  if (vehicle.year?.trim()) {
    vehicleYear = parseIntInRange(vehicle.year, MIN_VEHICLE_YEAR, MAX_VEHICLE_YEAR)
    if (vehicleYear === null) {
      return { ok: false, error: `Vehicle year must be a whole number between ${MIN_VEHICLE_YEAR} and ${MAX_VEHICLE_YEAR}`, status: 400 }
    }
  }

  let vehicleCapacity: number | null = null
  if (vehicle.capacity?.trim()) {
    vehicleCapacity = parseIntInRange(vehicle.capacity, MIN_CAPACITY, MAX_CAPACITY)
    if (vehicleCapacity === null) {
      return { ok: false, error: `Vehicle capacity must be a whole number between ${MIN_CAPACITY} and ${MAX_CAPACITY}`, status: 400 }
    }
  }

  if (banking.accountNumber?.trim() && !isNumericString(banking.accountNumber)) {
    return { ok: false, error: 'Account number must be numeric', status: 400 }
  }

  if (banking.branchCode?.trim() && !isNumericString(banking.branchCode)) {
    return { ok: false, error: 'Branch code must be numeric', status: 400 }
  }

  const now = new Date().toISOString()

  await supabase.from('Driver').insert({
    id:                     crypto.randomUUID(),
    userId,
    associationId:          associationId || null,
    getsRegistrationNumber: details.getsNumber?.trim() || null,
    vehicleMake:            vehicle.make?.trim() || null,
    vehicleModel:           vehicle.model?.trim() || null,
    vehicleYear,
    vehicleRegistration:    vehicle.registration?.trim() || null,
    vehicleColour:          vehicle.colour?.trim() || null,
    vehicleCapacity,
    bankName:               banking.bankName?.trim() || null,
    bankAccountNumber:      banking.accountNumber?.trim() ? encrypt(banking.accountNumber.trim()) : null,
    bankBranchCode:         banking.branchCode?.trim() ? encrypt(banking.branchCode.trim()) : null,
    bankAccountName:        banking.accountName?.trim() ? encrypt(banking.accountName.trim()) : null,
    status:                 'PENDING_COMPLIANCE',
    isVerifiedByAdmin:      false,
    createdAt:              now,
    updatedAt:              now,
  })

  return { ok: true }
}
