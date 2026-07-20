import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { validateRequest, safeParseJson } from '@/lib/request-validation'
import { getActiveSplitScheme, computeSplit } from '@/lib/payments/splits'
import { randomUUID } from 'crypto'

async function requireAdmin(request: Request) {
  const session = await getSession(request.headers.get('cookie'))
  // Platform-wide split config is ADMIN-only — an ASSOCIATION_ADMIN must not be
  // able to redirect subaccounts or zero out the platform fee.
  if (!session || session.role !== 'ADMIN') return null
  return session
}

/** GET → active scheme, its parties/shares, and a live preview at a sample gross. */
export async function GET(request: Request) {
  try {
    const session = await requireAdmin(request)
    if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const url = new URL(request.url)
    const sampleGross = parseInt(url.searchParams.get('sampleGross') ?? '50000')

    const { data: scheme } = await supabase.from('SplitScheme').select('*').eq('isActive', true).maybeSingle()
    const { data: parties } = await supabase.from('SplitParty').select('*').order('sortOrder', { ascending: true })

    let shares: unknown[] = []
    let preview = null
    if (scheme) {
      const { data: s } = await supabase
        .from('SplitShare')
        .select('*, party:SplitParty(*)')
        .eq('schemeId', scheme.id)
        .order('sortOrder', { ascending: true })
      shares = s ?? []

      const active = await getActiveSplitScheme(supabase)
      if (active) {
        // Preview assumes a driver + association with subaccounts and a sample levy.
        preview = computeSplit({
          grossCents: sampleGross,
          gatewayPercentBps: active.gatewayPercentBps,
          gatewayFlatCents: active.gatewayFlatCents,
          shares: active.shares,
          associationLevyCents: 0,
          driverSubAccountCode: 'ACCT_sample_driver',
          associationSubAccountCode: null,
        })
      }
    }

    return NextResponse.json({ scheme: scheme ?? null, parties: parties ?? [], shares, preview })
  } catch (err) {
    console.error('[admin/splits GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** POST → action-based mutations for the split config. */
export async function POST(request: Request) {
  try {
    const session = await requireAdmin(request)
    if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const validationError = validateRequest(request)
    if (validationError) return validationError
    const body = (await safeParseJson(request)) as Record<string, any> | null
    if (!body?.action) return NextResponse.json({ error: 'action is required' }, { status: 400 })

    const now = new Date().toISOString()

    switch (body.action) {
      case 'upsertParty': {
        const { id, key, label, kind, paystackSubAccountCode, isActive, sortOrder } = body
        if (!key || !label || !['FIXED', 'DRIVER', 'ASSOCIATION'].includes(kind)) {
          return NextResponse.json({ error: 'key, label and a valid kind are required' }, { status: 400 })
        }
        const { data, error } = await supabase
          .from('SplitParty')
          .upsert(
            {
              id: id ?? randomUUID(),
              key,
              label,
              kind,
              paystackSubAccountCode: paystackSubAccountCode || null,
              isActive: isActive ?? true,
              sortOrder: sortOrder ?? 0,
              updatedAt: now,
            },
            { onConflict: 'key' },
          )
          .select()
          .single()
        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
        return NextResponse.json(data)
      }

      case 'deleteParty': {
        if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
        await supabase.from('SplitParty').delete().eq('id', body.id)
        return NextResponse.json({ ok: true })
      }

      case 'upsertShare': {
        const { schemeId, partyId, calcType, value, sortOrder } = body
        if (!schemeId || !partyId || !['PERCENT', 'FLAT', 'REMAINDER', 'ASSOCIATION_LEVY'].includes(calcType)) {
          return NextResponse.json({ error: 'schemeId, partyId and a valid calcType are required' }, { status: 400 })
        }
        const numeric = Number(value ?? 0)
        if (!Number.isFinite(numeric) || numeric < 0) {
          return NextResponse.json({ error: 'value must be a non-negative number' }, { status: 400 })
        }
        // A single PERCENT share above 100% (10000 bps) can never balance.
        if (calcType === 'PERCENT' && numeric > 10000) {
          return NextResponse.json({ error: 'percentage cannot exceed 100% (10000 bps)' }, { status: 400 })
        }
        const { data, error } = await supabase
          .from('SplitShare')
          .upsert(
            {
              id: body.id ?? randomUUID(),
              schemeId,
              partyId,
              calcType,
              value: Math.round(numeric),
              sortOrder: sortOrder ?? 0,
            },
            { onConflict: 'schemeId,partyId' },
          )
          .select()
          .single()
        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
        return NextResponse.json(data)
      }

      case 'deleteShare': {
        if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
        await supabase.from('SplitShare').delete().eq('id', body.id)
        return NextResponse.json({ ok: true })
      }

      case 'updateScheme': {
        if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
        const patch: Record<string, unknown> = {}
        if (body.name !== undefined) patch.name = body.name
        if (body.gatewayPercentBps !== undefined) patch.gatewayPercentBps = Math.max(0, parseInt(body.gatewayPercentBps))
        if (body.gatewayFlatCents !== undefined) patch.gatewayFlatCents = Math.max(0, parseInt(body.gatewayFlatCents))
        if (body.notes !== undefined) patch.notes = body.notes
        const { data, error } = await supabase.from('SplitScheme').update(patch).eq('id', body.id).select().single()
        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
        return NextResponse.json(data)
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 })
    }
  } catch (err) {
    console.error('[admin/splits POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
