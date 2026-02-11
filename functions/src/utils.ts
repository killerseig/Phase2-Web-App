/**
 * Cloud Functions Shared Utilities
 * Common helpers for all Cloud Functions
 */

/**
 * Standard API Response for Cloud Functions
 */
export interface CloudFunctionResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
}

/**
 * Create a success response
 */
export function successResponse<T>(data?: T): CloudFunctionResponse<T> {
  return {
    success: true,
    data,
  }
}

/**
 * Create an error response
 */
export function errorResponse(code: string, message: string): CloudFunctionResponse {
  return {
    success: false,
    error: { code, message },
  }
}

/**
 * Cloud Function error codes
 */
export const CloudFunctionErrors = {
  NOT_SIGNED_IN: 'NOT_SIGNED_IN',
  INVALID_INPUT: 'INVALID_INPUT',
  NOT_FOUND: 'NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  EMAIL_DISABLED: 'EMAIL_DISABLED',
  EMAIL_SEND_FAILED: 'EMAIL_SEND_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const
