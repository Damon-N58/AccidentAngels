import { createClient } from '@supabase/supabase-js'

// Admin client (server-only) — full storage access
export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Public client — for client-side reads
export function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

const COMPLIANCE_BUCKET = 'compliance-docs'
const CONTRACTS_BUCKET  = 'contracts'

// Generate a presigned URL for direct client upload
export async function getUploadUrl(
  bucket: string,
  path: string
): Promise<{ url: string; token: string } | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(path)

  if (error || !data) {
    console.error('[Storage] getUploadUrl error:', error)
    return null
  }

  return { url: data.signedUrl, token: data.token }
}

// Get a public URL for a stored file
export function getPublicUrl(bucket: string, path: string): string {
  const supabase = getSupabaseAdmin()
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

// Compliance document upload path: compliance-docs/{driverId}/{docType}/{timestamp}-{filename}
export function complianceDocPath(driverId: string, docType: string, fileName: string): string {
  const ts = Date.now()
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `${driverId}/${docType}/${ts}-${safe}`
}

// Contract PDF path: contracts/{contractId}/contract.pdf
export function contractPdfPath(contractId: string): string {
  return `${contractId}/contract.pdf`
}

export { COMPLIANCE_BUCKET, CONTRACTS_BUCKET }
