import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { validateAndParseJson } from '@/lib/request-validation'
import { onboardDriver } from '@/lib/driver/onboardDriver'

export async function POST(request: Request) {
  try {
    const session = await getSession(request.headers.get('cookie'))
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [body, bodyErr] = await validateAndParseJson(request)
    if (bodyErr) return bodyErr
    const { details, vehicle, associationId, banking } = body as Record<string, any>

    if (!details?.name) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 })
    }

    const now = new Date().toISOString()

    await supabase.from('User').update({ name: details.name.trim(), updatedAt: now }).eq('id', session.userId)

    const result = await onboardDriver(session.userId, { details, vehicle, associationId, banking })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[driver/onboard]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
