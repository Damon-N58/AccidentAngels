import { NextResponse } from 'next/server'
import { getSession, verifyOtp } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { generateContractPdf } from '@/lib/pdf/contract-generator'
import { getSupabaseAdmin, contractPdfPath, CONTRACTS_BUCKET } from '@/lib/storage/supabase'
import { sendSms, smsTemplates } from '@/lib/sms/africas-talking'
import { createHmac } from 'crypto'
import { validateRequest, safeParseJson } from '@/lib/request-validation'
import { checkRateLimit } from '@/lib/rate-limit'

async function regeneratePdf(contractId: string): Promise<string | null> {
  const { data: contract } = await supabase
    .from('Contract')
    .select('*, child:Child(*), driver:Driver(*, user:User(*)), parent:Parent(user:User(*))')
    .eq('id', contractId).maybeSingle()
  if (!contract) return null

  const pdfBuffer = await generateContractPdf({
    contractId:          contract.id,
    contractVersion:     contract.contractVersion,
    driverName:          contract.driver.user.name,
    driverPhone:         contract.driver.user.phone,
    vehicleRegistration: contract.driver.vehicleRegistration ?? '',
    vehicleMake:         contract.driver.vehicleMake ?? '',
    vehicleModel:        contract.driver.vehicleModel ?? '',
    vehicleColour:       contract.driver.vehicleColour ?? '',
    getsNumber:          contract.driver.getsRegistrationNumber ?? undefined,
    parentName:          contract.parent.user.name,
    parentPhone:         contract.parent.user.phone,
    childName:           contract.child.name,
    schoolName:          contract.child.schoolName,
    pickupAddress:       contract.child.pickupAddress,
    dropoffAddress:      contract.child.dropoffAddress,
    monthlyAmountCents:  contract.monthlyAmountCents,
    startDate:           new Date(contract.startDate),
    driverSignedAt:      contract.driverSignedAt ? new Date(contract.driverSignedAt) : undefined,
    parentSignedAt:      contract.parentSignedAt ? new Date(contract.parentSignedAt) : undefined,
    generatedAt:         new Date(),
  })

  const storage = getSupabaseAdmin()
  const path = contractPdfPath(contractId)
  const { error } = await storage.storage
    .from(CONTRACTS_BUCKET).upload(path, pdfBuffer, { contentType: 'application/pdf', upsert: true })
  if (error) return null

  const { data } = storage.storage.from(CONTRACTS_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function POST(request: Request) {
  try {
    const validationError = validateRequest(request)
    if (validationError) return validationError
    const body = await safeParseJson(request)
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    const { role, otp, contractId } = body as Record<string, any>
    const ipAddress = request.headers.get('x-forwarded-for') ?? undefined
    const userAgent = request.headers.get('user-agent') ?? undefined
    const now = new Date().toISOString()

    // Rate limit by IP
    const rateKey = `contract-sign:${ipAddress ?? 'unknown'}`
    if (!checkRateLimit(rateKey, 10, 300_000)) {
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
    }

    // ── Driver signs (second signer — completes the contract) ─────────────
    if (role === 'DRIVER') {
      const session = await getSession(request.headers.get('cookie'))
      if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      const { data: driver } = await supabase
        .from('Driver').select('*, user:User(*)')
        .eq('userId', session.userId).maybeSingle()
      if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })

      const { data: contract } = await supabase
        .from('Contract').select('*, child:Child(*), parent:Parent(user:User(*))')
        .eq('id', contractId).eq('driverId', driver.id)
        .eq('status', 'PENDING_DRIVER_SIGNATURE').maybeSingle()
      if (!contract) return NextResponse.json({ error: 'Contract not found or not awaiting your signature' }, { status: 404 })

      const valid = await verifyOtp(driver.user.phone, otp, 'contract_sign')
      if (!valid) return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 })

      const rawSecret = process.env.NEXTAUTH_SECRET
      if (!rawSecret) throw new Error('NEXTAUTH_SECRET environment variable is required')
      const otpHash = createHmac('sha256', rawSecret).update(otp).digest('hex')

      await supabase.from('Contract').update({
        status:                 'FULLY_SIGNED',
        driverSignedAt:         now,
        driverSignatureOtpHash: otpHash,
        driverIpAddress:        ipAddress ?? null,
        driverUserAgent:        userAgent ?? null,
        updatedAt:              now,
      }).eq('id', contract.id)

      const pdfUrl = await regeneratePdf(contract.id)
      if (pdfUrl) await supabase.from('Contract').update({ pdfUrl, updatedAt: now }).eq('id', contract.id)

      try {
        await sendSms(
          contract.parent.user.phone,
          smsTemplates.contractAccepted(driver.user.name, contract.child.name)
        )
      } catch { /* non-fatal */ }

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  } catch (err) {
    console.error('[contracts/sign]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
