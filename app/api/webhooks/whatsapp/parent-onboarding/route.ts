import { NextResponse } from 'next/server'
import { onboardParentFromWhatsapp } from '@/lib/whatsapp/onboardParentFromWhatsapp'

// TODO(matt): auth mechanism is a placeholder shared-secret header, NOT
// confirmed against Nineteen58's actual webhook-signing scheme (if any).
// Check N58 platform docs / ask Alastair before relying on this in
// production -- swap for real signature verification if N58 provides one.
const WEBHOOK_SECRET = process.env.N58_WEBHOOK_SECRET

export async function POST(request: Request) {
  try {
    if (!WEBHOOK_SECRET || request.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

    const { phone, parentName, childName, dateOfBirth, schoolName, grade, pickupAddress, pickupLat, pickupLng, dropoffAddress, dropoffLat, dropoffLng, startDate } = body

    if (!phone) return NextResponse.json({ error: 'phone is required' }, { status: 400 })

    const result = await onboardParentFromWhatsapp({
      phone, parentName, childName, dateOfBirth, schoolName, grade,
      pickupAddress, pickupLat, pickupLng, dropoffAddress, dropoffLat, dropoffLng, startDate,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ ok: true, childId: result.childId })
  } catch (err) {
    console.error('[webhooks/whatsapp/parent-onboarding]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
