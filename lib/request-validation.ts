import { NextResponse } from 'next/server'

const MAX_BODY_BYTES = 1_048_576 // 1 MB

/**
 * Validates Content-Type header and body size.
 * Returns an error response, or null if valid.
 */
export function validateRequest(request: Request): NextResponse | null {
  const ct = request.headers.get('content-type') ?? ''
  if (!ct.includes('application/json')) {
    return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 })
  }
  const cl = request.headers.get('content-length')
  if (cl && parseInt(cl) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request body too large' }, { status: 413 })
  }
  return null
}

/**
 * Safely parses request JSON body. Returns null on parse failure.
 */
export async function safeParseJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

/**
 * Combines content-type validation + safe JSON parse in one call.
 * Returns [parsedBody, null] on success, or [null, errorResponse] on failure.
 */
export async function validateAndParseJson<T = Record<string, any>>(
  request: Request,
): Promise<[T, null] | [null, NextResponse]> {
  const validationError = validateRequest(request)
  if (validationError) return [null, validationError]

  const body = await safeParseJson(request)
  if (!body) {
    return [null, NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })]
  }

  return [body as T, null]
}
