/**
 * Shared Utility Functions
 * Common functions used across services
 */

import { ErrorCodes, errorResponse, successResponse } from '@/types/api'
import type { ApiResponse } from '@/types/api'

/**
 * Normalize Firestore document response
 * Converts { id, data: {...} } to { id, ...data }
 */
export function normalizeFSDoc<T extends Record<string, any>>(
  id: string,
  data: any
): T & { id: string } {
  return {
    id,
    ...data,
  } as T & { id: string }
}

/**
 * Handle Firebase errors and convert to ApiResponse
 */
export function handleFirebaseError(error: any): ApiResponse {
  if (!error) {
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'An unexpected error occurred')
  }

  if (error.code === 'permission-denied') {
    return errorResponse(ErrorCodes.PERMISSION_DENIED, 'You do not have permission to perform this action')
  }

  if (error.code === 'not-found') {
    return errorResponse(ErrorCodes.NOT_FOUND, 'The requested document was not found')
  }

  if (error.message) {
    return errorResponse(ErrorCodes.INTERNAL_ERROR, `Error: ${error.message}`)
  }

  return errorResponse(ErrorCodes.INTERNAL_ERROR, 'An unexpected error occurred')
}

/**
 * Validate required fields in an object
 */
export function validateRequiredFields(
  obj: Record<string, any>,
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
