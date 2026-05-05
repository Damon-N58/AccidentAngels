import { NextResponse } from 'next/server'
import { getSession, verifyOtp } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { generateContractPdf } from '@/lib/pdf/contract-generator'
import { getSupabaseAdmin, contractPdfPath, CONTRACTS_BUCKET } from '@/lib/storage/supabase'
import { sendSms, smsTemplates } from '@/lib/sms/africas-talking'
import { createHmac } from 'crypto'
import { validateRequest, safeParseJson } from '@/lib/request-validation'
import { checkRateLimit } from '@/lib/rate-limit'

const DRIVER_BASE_URL = process.env.NEXT_PUBLIC_DRIVER_URL ?? 'https://driver.accidentangels.co.za'

export async function GET(request: Request) {
  const session = await getSession(request.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'PARENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: parent } = await supabase.from('Parent').select('id').eq('userId', session.userId).maybeSingle()
  if (!parent) return NextResponse.json([], { status: 200 })

  const { data: children } = await supabase
    .from('Child')
    .select('*')
    .eq('parentId', parent.id)
    .eq('isActive', true)
    .order('createdAt', { ascending: false })

  return NextResponse.json(children ?? [])
}

export async function POST(request: Request) {
  try {
    const session = await getSession(request.headers.get('cookie'))
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'PARENT') return NextResponse.json({ error: 'Only parents can add children' }, { status: 403 })

    const validationError = validateRequest(request)
    if (validationError) return validationError
    const body = await safeParseJson(request)
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

    if (!checkRateLimit(`children:${session.userId}`, 5, 600_000)) {
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
    }

    const {
      childName, dateOfBirth, schoolName, grade,
      pickupAddress, dropoffAddress,
      pickupLat, pickupLng, dropoffLat, dropoffLng,
      driverId, startDate,
      otp, parentName,
    } = body as Record<string, any>


    if (!childName || !schoolName || !pickupAddress || !dropoffAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (!otp) return NextResponse.json({ error: 'OTP required to sign contract' }, { status: 400 })

    const { data: parentUser } = await supabase.from('User').select('*').eq('id', session.userId).maybeSingle()
    if (!parentUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const { data: parent } = await supabase.from('Parent').select('*').eq('userId', session.userId).maybeSingle()
    if (!parent) return NextResponse.json({ error: 'Parent profile not found' }, { status: 404 })

    const valid = await verifyOtp(parentUser.phone, otp, 'contract_sign')
    if (!valid) return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 })

    let driver: any = null
    if (driverId) {
      const { data: d } = await supabase
        .from('Driver').select('*, user:User(*)')
        .eq('id', driverId).eq('status', 'ACTIVE').maybeSingle()
      if (!d) return NextResponse.json({ error: 'Driver not found or not active' }, { status: 404 })
      driver = d
    }

    // Update parent name if provided (first-time onboarding)
    if (parentName?.trim() && parentName.trim() !== parentUser.name) {
      await supabase.from('User').update({ name: parentName.trim(), updatedAt: new Date().toISOString() }).eq('id', session.userId)
      parentUser.name = parentName.trim()
    }

    const now = new Date().toISOString()
    const ipAddress = request.headers.get('x-forwarded-for') ?? null
    const userAgent = request.headers.get('user-agent') ?? null
    if (!process.env.NEXTAUTH_SECRET) throw new Error('NEXTAUTH_SECRET environment variable is required')
    const otpHash = createHmac('sha256', process.env.NEXTAUTH_SECRET).update(otp).digest('hex')

    const { data: child, error: childError } = await supabase.from('Child').insert({
      id:             crypto.randomUUID(),
      parentId:       parent.id,
      driverId:       driver?.id ?? null,
      name:           childName.trim(),
      schoolName:     schoolName.trim(),
      grade:          grade?.trim() || null,
      dateOfBirth:    dateOfBirth ? new Date(dateOfBirth).toISOString() : null,
      pickupAddress:  pickupAddress.trim(),
      dropoffAddress: dropoffAddress.trim(),
      pickupLat:      pickupLat ?? null,
      pickupLng:      pickupLng ?? null,
      dropoffLat:     dropoffLat ?? null,
      dropoffLng:     dropoffLng ?? null,
      monthlyFee:     null,
      startDate:      startDate ? new Date(startDate).toISOString() : now,
      isActive:       true,
      createdAt:      now,
      updatedAt:      now,
    }).select().single()
    if (childError) throw childError

    // Skip contract if no driver selected yet
    let contract: any = null
    if (driver) {
      const { data: c, error: contractError } = await supabase.from('Contract').insert({
        id:                     crypto.randomUUID(),
        driverId:               driver.id,
        parentId:               parent.id,
        childId:                child.id,
        contractVersion:        '1.0',
        monthlyAmountCents:     0,
        startDate:              startDate ? new Date(startDate).toISOString() : now,
        terms:                  {},
        status:                 'PENDING_DRIVER_SIGNATURE',
        parentSignedAt:         now,
        parentSignatureOtpHash: otpHash,
        parentIpAddress:        ipAddress,
        parentUserAgent:        userAgent,
        parentPhone:            parentUser.phone,
        createdAt:              now,
        updatedAt:              now,
      }).select().single()
      if (contractError) throw contractError
      contract = c
    }

    if (contract) {
      try {
        const pdfBuffer = await generateContractPdf({
          contractId:          contract.id,
          contractVersion:     contract.contractVersion,
          driverName:          driver!.user.name,
          driverPhone:         driver!.user.phone,
          vehicleRegistration: driver!.vehicleRegistration ?? '',
          vehicleMake:         driver!.vehicleMake ?? '',
          vehicleModel:        driver!.vehicleModel ?? '',
          vehicleColour:       driver!.vehicleColour ?? '',
          getsNumber:          driver!.getsRegistrationNumber ?? undefined,
          parentName:          parentUser.name,
          parentPhone:         parentUser.phone,
          childName:           child.name,
          schoolName:          child.schoolName,
          pickupAddress:       child.pickupAddress,
          dropoffAddress:      child.dropoffAddress,
          monthlyAmountCents:  0,
          startDate:           new Date(contract.startDate),
          parentSignedAt:      new Date(now),
          generatedAt:         new Date(),
        })
        const storage = getSupabaseAdmin()
        const path = contractPdfPath(contract.id)
        const { error: uploadError } = await storage.storage
          .from(CONTRACTS_BUCKET).upload(path, pdfBuffer, { contentType: 'application/pdf', upsert: true })
        if (!uploadError) {
          const { data: urlData } = storage.storage.from(CONTRACTS_BUCKET).getPublicUrl(path)
          await supabase.from('Contract').update({ pdfUrl: urlData.publicUrl, updatedAt: new Date().toISOString() }).eq('id', contract.id)
        }
      } catch (pdfErr) {
        console.error('[children] PDF generation failed (non-fatal):', pdfErr)
      }

      try {
        await sendSms(driver!.user.phone, smsTemplates.newTransportRequest(parentUser.name, child.name, DRIVER_BASE_URL))
      } catch (smsErr) {
        console.error('[children] SMS to driver failed (non-fatal):', smsErr)
      }
    }

    return NextResponse.json({ ok: true, childId: child.id, contractId: contract?.id ?? null })
  } catch (err) {
    console.error('[children/post]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
