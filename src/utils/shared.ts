/**
 * Shared Utility Functions
 * Common functions used across services
 */

import { ErrorCodes, errorResponse } from '@/types/api'
import type { ApiResponse } from '@/types/api'

/**
 * Normalize Firestore document response
 * Converts { id, data: {...} } to { id, ...data }
 */
export function normalizeFSDoc<T extends Record<string, unknown>>(
  id: string,
  data: unknown
): T & { id: string } {
  const safeData = (data && typeof data === 'object' ? data : {}) as T
  return {
    id,
    ...safeData,
  } as T & { id: string }
}

/**
 * Handle Firebase errors and convert to ApiResponse
 */
type ErrorLike = {
  code?: unknown
  message?: unknown
}

const asErrorLike = (error: unknown): ErrorLike => {
  if (error && typeof error === 'object') {
    return error as ErrorLike
  }
  return {}
}

export function handleFirebaseError(error: unknown): ApiResponse {
  if (!error) {
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'An unexpected error occurred')
  }

  const parsedError = asErrorLike(error)
  const code = typeof parsedError.code === 'string' ? parsedError.code : undefined
  const message = typeof parsedError.message === 'string' ? parsedError.message : undefined

  if (code === 'permission-denied') {
    return errorResponse(ErrorCodes.PERMISSION_DENIED, 'You do not have permission to perform this action')
  }

  if (code === 'not-found') {
    return errorResponse(ErrorCodes.NOT_FOUND, 'The requested document was not found')
  }

  if (message) {
    return errorResponse(ErrorCodes.INTERNAL_ERROR, `Error: ${message}`)
  }

  return errorResponse(ErrorCodes.INTERNAL_ERROR, 'An unexpected error occurred')
}

/**
 * Validate required fields in an object
 */
export function validateRequiredFields(
  obj: Record<string, unknown>,
  fields: string[]
): { valid: boolean; missing?: string[] } {
  const missing = fields.filter((field) => !obj[field])
  return {
    valid: missing.length === 0,
    missing: missing.length > 0 ? missing : undefined,
  }
}

/**
 * Safely parse JSON with fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}
