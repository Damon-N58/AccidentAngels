import { describe, it, expect, beforeEach, vi } from 'vitest'

// Fake in-memory tables + a chainable query-builder mock standing in for the
// Supabase client. Each `.from(table)` call gets a fresh builder instance
// (closures over its own pending filter/insert/update), matching how the
// real code always starts a new chain per statement.
const { tables, mockFrom } = vi.hoisted(() => {
  const tables: Record<string, any[]> = {
    User: [],
    Parent: [],
    Child: [],
    ChildSchedule: [],
  }

  function makeBuilder(table: string) {
    let pendingFilter: { field: string; value: any } | null = null
    let pendingInsert: any = null
    let pendingUpdate: any = null

    const resolveRead = () => {
      const rows = tables[table]
      const row = pendingFilter ? rows.find(r => r[pendingFilter!.field] === pendingFilter!.value) : undefined
      return { data: row ?? null, error: null }
    }

    const resolveWrite = () => {
      if (pendingUpdate && pendingFilter) {
        const rows = tables[table]
        const idx = rows.findIndex(r => r[pendingFilter!.field] === pendingFilter!.value)
        if (idx >= 0) rows[idx] = { ...rows[idx], ...pendingUpdate }
        return { data: null, error: null }
      }
      if (pendingInsert) {
        tables[table].push(pendingInsert)
        return { data: pendingInsert, error: null }
      }
      return { data: null, error: null }
    }

    const builder: any = {
      select: vi.fn(() => builder),
      eq: vi.fn((field: string, value: any) => {
        pendingFilter = { field, value }
        return builder
      }),
      insert: vi.fn((row: any) => {
        pendingInsert = { ...row }
        return builder
      }),
      update: vi.fn((patch: any) => {
        pendingUpdate = patch
        return builder
      }),
      maybeSingle: vi.fn(async () => resolveRead()),
      single: vi.fn(async () => resolveWrite()),
      then: (onFulfilled: any, onRejected?: any) => Promise.resolve(resolveWrite()).then(onFulfilled, onRejected),
    }
    return builder
  }

  const mockFrom = vi.fn((table: string) => makeBuilder(table))
  return { tables, mockFrom }
})

vi.mock('@/lib/supabase', () => ({ supabase: { from: mockFrom } }))

import { onboardParentFromWhatsapp, type ParentOnboardingInput } from '../onboardParentFromWhatsapp'

function validInput(overrides: Partial<ParentOnboardingInput> = {}): ParentOnboardingInput {
  return {
    phone: '0821234567',
    parentName: 'Nompumelelo Dlamini',
    childName: 'Amahle Dlamini',
    schoolName: 'Soweto Primary',
    pickupAddress: '12 Vilakazi St, Soweto',
    pickupLat: -26.2485,
    pickupLng: 27.9389,
    dropoffAddress: 'Soweto Primary School',
    dropoffLat: -26.2500,
    dropoffLng: 27.9400,
    ...overrides,
  }
}

beforeEach(() => {
  tables.User.length = 0
  tables.Parent.length = 0
  tables.Child.length = 0
  tables.ChildSchedule.length = 0
  mockFrom.mockClear()
})

describe('onboardParentFromWhatsapp', () => {
  it('creates a User (role PARENT), a Parent row, a Child, and a ChildSchedule for a brand-new phone number', async () => {
    const result = await onboardParentFromWhatsapp(validInput())

    expect(result).toEqual({ ok: true, childId: expect.any(String) })

    expect(tables.User).toHaveLength(1)
    expect(tables.User[0]).toMatchObject({ phone: '+27821234567', role: 'PARENT', name: 'Nompumelelo Dlamini' })

    expect(tables.Parent).toHaveLength(1)
    expect(tables.Parent[0]).toMatchObject({ userId: tables.User[0].id, isPaymentSetup: false })

    expect(tables.Child).toHaveLength(1)
    expect(tables.Child[0]).toMatchObject({ parentId: tables.Parent[0].id, name: 'Amahle Dlamini', schoolName: 'Soweto Primary' })

    expect(tables.ChildSchedule).toHaveLength(1)
    expect(tables.ChildSchedule[0]).toMatchObject({ childId: tables.Child[0].id, daysOfWeek: [1, 2, 3, 4, 5] })

    if (result.ok) expect(result.childId).toBe(tables.Child[0].id)
  })

  it('reuses an existing PARENT user + Parent row for a matching phone number, without creating duplicates', async () => {
    tables.User.push({
      id: 'user-existing-1',
      phone: '+27821234567',
      name: 'Nompumelelo Dlamini',
      role: 'PARENT',
      isActive: true,
    })
    tables.Parent.push({
      id: 'parent-existing-1',
      userId: 'user-existing-1',
      paymentMethodStatus: 'PENDING_SETUP',
      isPaymentSetup: false,
    })

    const result = await onboardParentFromWhatsapp(validInput())

    expect(result.ok).toBe(true)
    expect(tables.User).toHaveLength(1)
    expect(tables.Parent).toHaveLength(1)

    expect(tables.Child).toHaveLength(1)
    expect(tables.Child[0]).toMatchObject({ parentId: 'parent-existing-1' })

    expect(tables.ChildSchedule).toHaveLength(1)
    expect(tables.ChildSchedule[0]).toMatchObject({ childId: tables.Child[0].id })
  })

  it('rejects with 409 when the phone number is already registered under a different role, without inserting a Child', async () => {
    tables.User.push({
      id: 'user-driver-1',
      phone: '+27821234567',
      name: 'Some Driver',
      role: 'DRIVER',
      isActive: true,
    })

    const result = await onboardParentFromWhatsapp(validInput())

    expect(result).toEqual({
      ok: false,
      error: 'This phone number is already registered under a different role',
      status: 409,
    })

    expect(tables.Parent).toHaveLength(0)
    expect(tables.Child).toHaveLength(0)
    expect(tables.ChildSchedule).toHaveLength(0)
  })

  it('rejects with 400 when pickupLat is missing, without touching the database', async () => {
    const result = await onboardParentFromWhatsapp(validInput({ pickupLat: undefined as any }))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(400)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('rejects with 400 when dropoffLng is non-numeric, without touching the database', async () => {
    const result = await onboardParentFromWhatsapp(validInput({ dropoffLng: '27.94' as any }))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(400)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('rejects with 400 when childName is missing', async () => {
    const result = await onboardParentFromWhatsapp(validInput({ childName: '' }))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(400)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('rejects with 400 when schoolName is missing', async () => {
    const result = await onboardParentFromWhatsapp(validInput({ schoolName: '   ' }))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(400)
    expect(mockFrom).not.toHaveBeenCalled()
  })
})
