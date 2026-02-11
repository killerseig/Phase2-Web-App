/**
 * Standardized Cloud Function Response Types
 * Used across all Cloud Functions for consistency
 */

/**
 * Standard API Response wrapper
 * All Cloud Functions should return this structure
 */
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string // Error code for client handling
    message: string // User-friendly error message
  }
}

/**
 * Helper to create a successful response
 */
export function successResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
  }
}

/**
 * Helper to create an error response
 */
export function errorResponse(code: string, message: string): ApiResponse {
  return {
    success: false,
    error: { code, message },
  }
}

/**
 * Common error codes for Cloud Functions
 */
export const ErrorCodes = {
  INVALID_INPUT: 'INVALID_INPUT',
  NOT_FOUND: 'NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  EMAIL_SEND_FAILED: 'EMAIL_SEND_FAILED',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
} as const
