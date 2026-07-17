import { supabase } from '@/lib/supabase'
import { normalizeSAPhone, isValidSAPhone } from '@/lib/utils/validators'

// TODO(matt): this creates a User with no OTP verification step, unlike every
// other account-creation path in this app (see verify-otp/route.ts). This
// matches the explicit instruction that WhatsApp onboarding creates an
// account from the first message. Flagged to the team as a trust-model
// gap worth a deliberate decision, not silently accepted long-term.

export interface ParentOnboardingInput {
  phone: string
  parentName: string
  childName: string
  dateOfBirth?: string
  schoolName: string
  grade?: string
  pickupAddress: string
  pickupLat: number
  pickupLng: number
  dropoffAddress: string
  dropoffLat: number
  dropoffLng: number
  startDate?: string
}

export type OnboardResult =
  | { ok: true; childId: string }
  | { ok: false; error: string; status: number }

export async function onboardParentFromWhatsapp(input: ParentOnboardingInput): Promise<OnboardResult> {
  const normalized = normalizeSAPhone(input.phone)
  if (!isValidSAPhone(normalized)) {
    return { ok: false, error: 'Invalid phone number', status: 400 }
  }

  if (!input.childName?.trim() || !input.schoolName?.trim() || !input.pickupAddress?.trim() || !input.dropoffAddress?.trim()) {
    return { ok: false, error: 'Missing required fields', status: 400 }
  }

  if (
    typeof input.pickupLat !== 'number' || typeof input.pickupLng !== 'number' ||
    typeof input.dropoffLat !== 'number' || typeof input.dropoffLng !== 'number'
  ) {
    return { ok: false, error: 'Pickup/dropoff coordinates must be confirmed before submitting (expected numeric lat/lng)', status: 400 }
  }

  const now = new Date().toISOString()

  // Find-or-create User, mirroring the lazy-creation pattern in verify-otp/route.ts,
  // but with no OTP check — this endpoint is the account-creation entry point for
  // WhatsApp-originated parents.
  let { data: user } = await supabase.from('User').select('*').eq('phone', normalized).maybeSingle()

  if (!user) {
    const { data: newUser, error: userErr } = await supabase.from('User').insert({
      id: crypto.randomUUID(),
      phone: normalized,
      name: input.parentName?.trim() || '',
      role: 'PARENT',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }).select().single()
    if (userErr) throw userErr
    user = newUser
  } else if (user.role !== 'PARENT') {
    // Existing account under a different role (e.g. a driver's phone number)
    // trying to onboard as a parent via WhatsApp — reject rather than silently
    // reassigning role.
    return { ok: false, error: 'This phone number is already registered under a different role', status: 409 }
  } else if (input.parentName?.trim() && input.parentName.trim() !== user.name) {
    await supabase.from('User').update({ name: input.parentName.trim(), updatedAt: now }).eq('id', user.id)
  }

  let { data: parent } = await supabase.from('Parent').select('*').eq('userId', user.id).maybeSingle()
  if (!parent) {
    const { data: newParent, error: parentErr } = await supabase.from('Parent').insert({
      id: crypto.randomUUID(),
      userId: user.id,
      paymentMethodStatus: 'PENDING_SETUP',
      isPaymentSetup: false,
      createdAt: now,
      updatedAt: now,
    }).select().single()
    if (parentErr) throw parentErr
    parent = newParent
  }

  const { data: child, error: childError } = await supabase.from('Child').insert({
    id: crypto.randomUUID(),
    parentId: parent.id,
    driverId: null,
    name: input.childName.trim(),
    schoolName: input.schoolName.trim(),
    grade: input.grade?.trim() || null,
    dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth).toISOString() : null,
    pickupAddress: input.pickupAddress.trim(),
    dropoffAddress: input.dropoffAddress.trim(),
    pickupLat: input.pickupLat,
    pickupLng: input.pickupLng,
    dropoffLat: input.dropoffLat,
    dropoffLng: input.dropoffLng,
    monthlyFee: null,
    startDate: input.startDate ? new Date(input.startDate).toISOString() : now,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }).select().single()
  if (childError) throw childError

  await supabase.from('ChildSchedule').insert({
    id: crypto.randomUUID(),
    childId: child.id,
    daysOfWeek: [1, 2, 3, 4, 5],
    startDate: (input.startDate ? new Date(input.startDate) : new Date()).toISOString().split('T')[0],
    endDate: null,
    morningPickupEarliest: '06:30',
    morningPickupLatest: '07:15',
    morningDropoffEarliest: '07:30',
    morningDropoffLatest: '08:00',
    afternoonPickupEarliest: '13:45',
    afternoonPickupLatest: '14:15',
    afternoonDropoffEarliest: '14:15',
    afternoonDropoffLatest: '15:00',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  })

  return { ok: true, childId: child.id }
}
