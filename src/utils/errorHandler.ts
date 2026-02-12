/**
 * Service Error Handler
 * Consistent error handling across all services
 */

import { ErrorCodes } from '@/types/api'

export interface ServiceError {
  code: string
  message: string
  cause?: Error
}

/**
 * Parse Firebase error and return standardized service error
 */
export function handleServiceError(error: any, context: string = 'Service'): ServiceError {
  if (!error) {
    return {
      code: ErrorCodes.INTERNAL_ERROR,
      message: `${context} error: An unexpected error occurred`,
    }
  }

  // Firebase Firestore errors
  if (error.code === 'permission-denied') {
    return {
      code: ErrorCodes.PERMISSION_DENIED,
      message: 'You do not have permission to perform this action',
      cause: error,
    }
  }

  if (error.code === 'not-found') {
    return {
      code: ErrorCodes.NOT_FOUND,
      message: 'The requested resource was not found',
      cause: error,
    }
  }

  if (error.code === 'already-exists') {
    return {
      code: 'ALREADY_EXISTS',
      message: 'This resource already exists',
      cause: error,
    }
  }

  if (error.code === 'unauthenticated') {
    return {
      code: 'UNAUTHENTICATED',
      message: 'You must be signed in to perform this action',
      cause: error,
    }
  }

  if (error.code === 'failed-precondition') {
    return {
      code: 'FAILED_PRECONDITION',
      message: 'The service is not in the required state for this operation',
      cause: error,
    }
  }

  // Network errors
  if (error.code === 'unavailable') {
    return {
      code: 'UNAVAILABLE',
      message: 'Service temporarily unavailable. Please try again later.',
      cause: error,
    }
  }

  // Timeout
  if (error.code === 'deadline-exceeded') {
    return {
      code: 'TIMEOUT',
      message: 'Operation timed out. Please try again.',
      cause: error,
    }
  }

  // Firebase Auth errors
  if (error.code?.startsWith('auth/')) {
    const authMessage = getAuthErrorMessage(error.code)
    return {
      code: error.code,
      message: authMessage,
      cause: error,
    }
  }

  // Generic error with message
  if (error.message) {
    return {
      code: ErrorCodes.INTERNAL_ERROR,
      message: error.message,
      cause: error,
    }
  }

  // Fallback
  return {
    code: ErrorCodes.INTERNAL_ERROR,
    message: `${context} error: An unexpected error occurred`,
    cause: error,
  }
}

/**
 * Get user-friendly message for Firebase Auth error codes
 */
function getAuthErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    'auth/user-not-found': 'No account found with this email address',
    'auth/wrong-password': 'Incorrect password',
    'auth/weak-password': 'Password is too weak (minimum 6 characters)',
    'auth/email-already-in-use': 'This email is already in use',
    'auth/invalid-email': 'Invalid email address',
    'auth/operation-not-allowed': 'This operation is not allowed',
    'auth/too-many-requests': 'Too many login attempts. Please try again later.',
    'auth/account-exists-with-different-credential': 'An account already exists with this email',
  }

  return messages[code] || `Authentication error: ${code}`
}

/**
 * Format error for console logging
 */
export function logServiceError(error: ServiceError, context: string = 'Service'): void {
  console.error(`[${context}] ${error.code}:`, error.message, error.cause)
}

/**
 * Create a validation error (non-Firebase)
 */
export function createValidationError(message: string): ServiceError {
  return {
    code: ErrorCodes.INVALID_INPUT,
    message,
  }
}

/**
 * Check if error is a specific type
 */
export function isErrorCode(error: ServiceError, code: string): boolean {
  return error.code === code
}

/**
 * Check if error is recoverable (user can retry)
 */
export function isRecoverableError(error: ServiceError): boolean {
  const recoverableCodes = ['UNAVAILABLE', 'TIMEOUT', 'auth/too-many-requests']
  return recoverableCodes.includes(error.code)
}
