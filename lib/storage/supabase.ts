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

// Get a public URL for a stored file (only valid for PUBLIC buckets).
export function getPublicUrl(bucket: string, path: string): string {
  const supabase = getSupabaseAdmin()
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

// Short-lived signed URL for a stored file in a PRIVATE bucket. Returns null if
// the object does not exist or signing fails.
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresInSeconds = 300,
): Promise<string | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds)
  if (error || !data) {
    console.error('[Storage] getSignedUrl error:', error)
    return null
  }
  return data.signedUrl
}

// Fresh, short-lived signed URL for a contract PDF. The contracts bucket is
// PRIVATE (it holds child/family PII), so URLs are minted per request and must
// never be persisted. Returns null if the PDF has not been generated yet.
export async function getSignedContractUrl(
  contractId: string,
  expiresInSeconds = 300,
): Promise<string | null> {
  return getSignedUrl(CONTRACTS_BUCKET, contractPdfPath(contractId), expiresInSeconds)
}

// Fresh signed URL for a compliance document. The compliance-docs bucket is
// PRIVATE (driver ID/licence/police-clearance scans), so we store the object
// PATH and mint a signed URL per request. Legacy rows may hold a full (dead)
// public URL — passed through unchanged. Returns null if nothing is stored.
export async function getSignedComplianceUrl(
  stored: string | null | undefined,
  expiresInSeconds = 3600,
): Promise<string | null> {
  if (!stored) return null
  if (/^https?:\/\//i.test(stored)) return stored // legacy absolute URL
  return getSignedUrl(COMPLIANCE_BUCKET, stored, expiresInSeconds)
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
