type FirebaseLikeError = Error & {
  code?: string
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
  'firestore/permission-denied': 'Permission denied. Your account may not have access yet, or Firestore rules may still need to be deployed.',
  'storage/unauthorized': 'Storage access is not allowed yet. Storage rules may still need to be deployed for this feature.',
}

export function normalizeError(error: unknown, fallback: string): string {
  if (typeof error === 'string' && error.trim()) return error

  if (error instanceof Error) {
    const firebaseError = error as FirebaseLikeError
    const authMessage = firebaseError.code ? AUTH_MESSAGES[firebaseError.code] : undefined
    if (authMessage) {
      return authMessage
    }

    const firebaseMessage = firebaseError.code ? FIREBASE_MESSAGES[firebaseError.code] : undefined
    if (firebaseMessage) {
      return firebaseMessage
    }

    if (firebaseError.message?.trim()) {
      return firebaseError.message
    }
  }

  return fallback
}
