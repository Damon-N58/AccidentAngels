import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { validateRequest, safeParseJson } from '@/lib/request-validation'

export async function GET(request: Request) {
  try {
    const session = await getSession(request.headers.get('cookie'))
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: configs } = await supabase.from('PlatformConfig').select('*').order('key', { ascending: true })
    return NextResponse.json(configs ?? [])
  } catch (err) {
    console.error('[admin/config GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession(request.headers.get('cookie'))
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const validationError = validateRequest(request)
    if (validationError) return validationError
    const body = await safeParseJson(request)
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    const { key, value } = body as { key: string; value: string }
    if (!key || value === undefined) {
      return NextResponse.json({ error: 'key and value are required' }, { status: 400 })
    }

    // Validate numeric config values
    const NUMERIC_KEYS = ['PLATFORM_FEE_CENTS', 'TCC_SPLIT_CENTS', 'RETRY_DAY_1', 'RETRY_DAY_2']
    const BOOLEAN_KEYS = ['PAYMENTS_LIVE', 'DEBICHECK_ENABLED', 'CAPITEC_VRP_ENABLED']

    if (NUMERIC_KEYS.includes(key)) {
      const num = parseInt(value, 10)
      if (isNaN(num) || num < 0) {
        return NextResponse.json({ error: `${key} must be a non-negative number` }, { status: 400 })
      }
    }

    if (BOOLEAN_KEYS.includes(key) && value !== 'true' && value !== 'false') {
      return NextResponse.json({ error: `${key} must be "true" or "false"` }, { status: 400 })
    }

    const now = new Date().toISOString()
    const { data: config } = await supabase
      .from('PlatformConfig')
      .upsert(
        { id: crypto.randomUUID(), key, value, updatedAt: now, updatedByUserId: session.userId },
        { onConflict: 'key' }
      )
      .select()
      .single()

    return NextResponse.json(config)
  } catch (err) {
    console.error('[admin/config POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
