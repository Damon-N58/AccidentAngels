import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { validateAndParseJson } from '@/lib/request-validation'

export async function POST(request: Request) {
  const session = await getSession(request.headers.get('cookie'))
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [rawBody, bodyErr] = await validateAndParseJson(request)
  if (bodyErr) return bodyErr
  const { childIds, dateFrom, dateTo, reason } = rawBody as Record<string, any>
  if (!childIds?.length || !dateFrom || !dateTo) {
    return NextResponse.json({ error: 'childIds, dateFrom, and dateTo are required' }, { status: 400 })
  }

  // Verify parent owns these children
  if (session.role === 'PARENT') {
    const { data: parent } = await supabase
      .from('Parent').select('id').eq('userId', session.userId).maybeSingle()
    if (!parent) return NextResponse.json({ error: 'Parent not found' }, { status: 404 })

    const { data: owned } = await supabase
      .from('Child').select('id').eq('parentId', parent.id).in('id', childIds)
    const ownedIds = new Set((owned ?? []).map(c => c.id))
    const invalid = childIds.filter((id: string) => !ownedIds.has(id))
    if (invalid.length > 0) {
      return NextResponse.json({ error: 'Some children do not belong to you' }, { status: 403 })
    }
  } else if (session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Get all weekdays in range
  const start = new Date(dateFrom)
  const end = new Date(dateTo)
  const entries: any[] = []

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay()
    if (dayOfWeek === 0 || dayOfWeek === 6) continue // skip weekends

    const dateStr = d.toISOString().split('T')[0]
    for (const childId of childIds) {
      entries.push({
        id: crypto.randomUUID(),
        childId,
        date: dateStr,
        action: 'SKIP',
        reason: reason ?? 'School holidays',
        createdAt: new Date().toISOString(),
      })
    }
  }

  // Batch upsert in chunks of 100
  const BATCH_SIZE = 100
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE).map((e: any) => ({
      childId: e.childId,
      date: e.date,
      action: 'SKIP',
      reason: e.reason ?? 'School holidays',
    }))
    const { error } = await supabase
      .from('ScheduleOverride')
      .upsert(batch, { onConflict: 'childId,date', ignoreDuplicates: false })
    if (error) {
      console.error('[bulk-skip] batch upsert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, entriesCreated: entries.length })
}
