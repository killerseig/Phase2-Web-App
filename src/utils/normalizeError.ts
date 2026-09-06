type FirebaseLikeError = Error & {
  code?: string
}

function getErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined

  const code = (error as { code?: unknown }).code
  return typeof code === 'string' ? code : undefined
}

const AUTH_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/too-many-requests': 'Too many attempts. Please try again in a moment.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/weak-password': 'Password must be at least 6 characters.',
}

const FIREBASE_MESSAGES: Record<string, string> = {
  'permission-denied':
    'Permission denied. Your account may not have access yet, or Firestore rules may still need to be deployed.',
  'firestore/permission-denied':
    'Permission denied. Your account may not have access yet, or Firestore rules may still need to be deployed.',
  'storage/unauthorized': 'You do not have permission to add or view this photo.',
  'storage/unauthenticated': 'Sign in again to add or view this photo.',
  'storage/retry-limit-exceeded': 'The photo upload was interrupted by the network.',
}

export function normalizeError(error: unknown, fallback: string): string {
  if (typeof error === 'string' && error.trim()) return error

  const errorCode = getErrorCode(error)
  const authMessage = errorCode ? AUTH_MESSAGES[errorCode] : undefined
  if (authMessage) {
    return authMessage
  }

  const firebaseMessage = errorCode ? FIREBASE_MESSAGES[errorCode] : undefined
  if (firebaseMessage) {
    return firebaseMessage
  }

  if (error instanceof Error) {
    const firebaseError = error as FirebaseLikeError
    if (firebaseError.message?.trim()) {
      return firebaseError.message
    }
  }

  return fallback
}
