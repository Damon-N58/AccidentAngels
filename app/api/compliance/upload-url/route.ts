import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { getUploadUrl, complianceDocPath, COMPLIANCE_BUCKET } from '@/lib/storage/supabase'
import { validateRequest, safeParseJson } from '@/lib/request-validation'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_SIZE_BYTES = 20 * 1024 * 1024

export async function POST(request: Request) {
  try {
    const session = await getSession(request.headers.get('cookie'))
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const validationError = validateRequest(request)
    if (validationError) return validationError
    const body = await safeParseJson(request)
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

    const { data: driver } = await supabase.from('Driver').select('id').eq('userId', session.userId).maybeSingle()
    if (!driver) return NextResponse.json({ error: 'Driver profile not found' }, { status: 404 })

    const { docType, fileName, mimeType, fileSize } = body as Record<string, any>

    if (!docType || !fileName || !mimeType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(mimeType)) {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })
    }

    if (fileSize && fileSize > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const { data: doc } = await supabase.from('ComplianceDocument').insert({
      id:            crypto.randomUUID(),
      driverId:      driver.id,
      type:          docType,
      status:        'PENDING',
      fileUrl:       '',
      fileName,
      mimeType,
      fileSizeBytes: fileSize ?? null,
      createdAt:     now,
      updatedAt:     now,
    }).select().single()

    const path = complianceDocPath(driver.id, docType, fileName)
    const result = await getUploadUrl(COMPLIANCE_BUCKET, path)

    if (!result) {
      await supabase.from('ComplianceDocument').delete().eq('id', doc.id)
      return NextResponse.json({ error: 'Could not generate upload URL' }, { status: 500 })
    }

    return NextResponse.json({ url: result.url, path, docId: doc.id })
  } catch (err) {
    console.error('[compliance/upload-url]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
