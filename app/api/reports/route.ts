import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

const VALID_CATEGORIES = ['UNSAFE_VEHICLE', 'UNSAFE_BEHAVIOUR', 'OTHER'] as const
type ReportCategory = (typeof VALID_CATEGORIES)[number]

export async function POST(request: Request) {
  try {
    const session = await getSession(request.headers.get('cookie'))
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'PARENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { driverId, category, description, childId } = body

    // --- Field validation ---
    if (!driverId) {
      return NextResponse.json({ error: 'driverId is required' }, { status: 400 })
    }
    if (!category || !VALID_CATEGORIES.includes(category as ReportCategory)) {
      return NextResponse.json(
        { error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 }
      )
    }
    if (!description || typeof description !== 'string' || description.trim().length < 10) {
      return NextResponse.json(
        { error: 'description is required and must be at least 10 characters' },
        { status: 400 }
      )
    }

    // --- Resolve parent record from session userId ---
    const { data: parent } = await supabase
      .from('Parent')
      .select('id')
      .eq('userId', session.userId)
      .maybeSingle()

    if (!parent) {
      return NextResponse.json({ error: 'Parent profile not found' }, { status: 404 })
    }

    // --- Ownership check: parent must have an active child assigned to this driver ---
    const { data: linkedChild } = await supabase
      .from('Child')
      .select('id')
      .eq('driverId', driverId)
      .eq('parentId', parent.id)
      .eq('isActive', true)
      .limit(1)
      .maybeSingle()

    if (!linkedChild) {
      return NextResponse.json(
        { error: 'You can only report drivers assigned to your children' },
        { status: 403 }
      )
    }

    const now = new Date().toISOString()

    // --- Insert the Report row ---
    const { data: newReport, error: reportError } = await supabase
      .from('Report')
      .insert({
        id:          crypto.randomUUID(),
        parentId:    parent.id,
        driverId,
        childId:     childId ?? null,
        category,
        description: description.trim(),
        status:      'OPEN',
        createdAt:   now,
        updatedAt:   now,
      })
      .select('id')
      .single()

    if (reportError) throw reportError

    // --- Notify the driver (non-fatal: failure must not block the response) ---
    try {
      // Resolve driver's User.id via Driver table
      const { data: driver } = await supabase
        .from('Driver')
        .select('userId')
        .eq('id', driverId)
        .maybeSingle()

      if (driver?.userId) {
        await supabase.from('Notification').insert({
          id:        crypto.randomUUID(),
          userId:    driver.userId,
          type:      'REPORT_FILED',
          title:     'Safety concern reported',
          body:      'A safety concern has been reported about you or your vehicle. Admin has been notified.',
          metadata:  { reportId: newReport.id },
          isRead:    false,
          createdAt: now,
        })

        // Stamp the report to record that the driver was notified
        await supabase
          .from('Report')
          .update({ driverNotifiedAt: now, updatedAt: now })
          .eq('id', newReport.id)
      }
    } catch (notifyErr) {
      // Non-fatal — log and continue
      console.error('[reports/post] Notification insert failed (non-fatal):', notifyErr)
    }

    return NextResponse.json({ ok: true, reportId: newReport.id }, { status: 201 })
  } catch (err) {
    console.error('[reports/post]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
