import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { validateRequest, safeParseJson } from '@/lib/request-validation'
import { randomUUID } from 'crypto'

async function requireAdmin(request: Request) {
  const session = await getSession(request.headers.get('cookie'))
  if (!session || session.role !== 'ADMIN') return null
  return session
}

/** Admin: full association list (incl. inactive) with subaccount + driver count. */
export async function GET(request: Request) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data } = await supabase
    .from('Association')
    .select('id, name, code, region, monthlyLevy, contactName, contactPhone, contactEmail, bankName, bankAccount, bankBranch, paystackSubAccountCode, isActive, drivers:Driver(id)')
    .order('name', { ascending: true })

  const items = (data ?? []).map((a: any) => ({
    ...a,
    driverCount: (a.drivers ?? []).length,
    drivers: undefined,
    hasSubAccount: !!a.paystackSubAccountCode,
  }))
  return NextResponse.json(items)
}

const REQUIRED = ['name', 'code', 'region', 'contactName', 'contactPhone'] as const

/** Admin: create an association. */
export async function POST(request: Request) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const validationError = validateRequest(request)
  if (validationError) return validationError
  const body = (await safeParseJson(request)) as Record<string, any> | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  for (const f of REQUIRED) {
    if (!body[f]?.toString().trim()) return NextResponse.json({ error: `${f} is required` }, { status: 400 })
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('Association')
    .insert({
      id:           randomUUID(),
      name:         body.name.trim(),
      code:         body.code.trim().toUpperCase(),
      region:       body.region.trim(),
      contactName:  body.contactName.trim(),
      contactPhone: body.contactPhone.trim(),
      contactEmail: body.contactEmail?.trim() || null,
      monthlyLevy:  Number.isFinite(+body.monthlyLevy) ? Math.max(0, Math.round(+body.monthlyLevy)) : 0,
      bankName:     body.bankName?.trim() || null,
      bankAccount:  body.bankAccount?.trim() || null,
      bankBranch:   body.bankBranch?.trim() || null,
      isActive:     true,
      createdAt:    now,
    })
    .select()
    .maybeSingle()

  if (error) {
    // 23505 = duplicate code (unique)
    const dup = (error as { code?: string }).code === '23505'
    return NextResponse.json({ error: dup ? 'An association with that code already exists' : error.message }, { status: dup ? 409 : 400 })
  }
  return NextResponse.json(data, { status: 201 })
}

/** Admin: update an association (body must include id). */
export async function PATCH(request: Request) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const validationError = validateRequest(request)
  if (validationError) return validationError
  const body = (await safeParseJson(request)) as Record<string, any> | null
  if (!body?.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const updates: Record<string, any> = {}
  for (const f of ['name', 'region', 'contactName', 'contactPhone', 'contactEmail', 'bankName', 'bankAccount', 'bankBranch']) {
    if (body[f] !== undefined) updates[f] = body[f]?.toString().trim() || null
  }
  if (body.monthlyLevy !== undefined) updates.monthlyLevy = Number.isFinite(+body.monthlyLevy) ? Math.max(0, Math.round(+body.monthlyLevy)) : 0
  if (body.isActive !== undefined) updates.isActive = !!body.isActive
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

  const { data, error } = await supabase.from('Association').update(updates).eq('id', body.id).select().maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
