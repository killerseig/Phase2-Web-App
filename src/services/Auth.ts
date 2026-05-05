import { updatePassword } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { requireFirebaseServices } from '@/firebase'
import { normalizeError } from '@/utils/normalizeError'

interface VerifySetupTokenRequest {
  uid: string
  setupToken: string
}

interface VerifySetupTokenResponse {
  email: string
}

interface SetUserPasswordRequest {
  uid: string
  password: string
  setupToken: string
}

interface RequestPasswordResetEmailRequest {
  email: string
}

export async function sendPasswordResetEmail(email: string): Promise<void> {
  const sanitizedEmail = email.trim()
  if (!sanitizedEmail) {
    throw new Error('Enter your email address first.')
  }

  try {
    const { functions } = requireFirebaseServices()
    const callable = httpsCallable<RequestPasswordResetEmailRequest, unknown>(functions, 'requestPasswordResetEmail')
    await callable({ email: sanitizedEmail })
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to send reset email.'))
  }
}

export async function verifySetupToken(uid: string, setupToken: string): Promise<string> {
  if (!uid || !setupToken) {
    throw new Error('Invalid or expired password setup link.')
  }

  try {
    const { functions } = requireFirebaseServices()
    const callable = httpsCallable<VerifySetupTokenRequest, VerifySetupTokenResponse>(functions, 'verifySetupToken')
    const result = await callable({ uid, setupToken })
    return result.data.email || ''
  } catch (error) {
    throw new Error(normalizeError(error, 'Invalid or expired password setup link.'))
  }
}

export async function setPasswordFromSetupLink(
  uid: string,
  password: string,
  setupToken: string,
): Promise<void> {
  if (!uid || !setupToken) {
    throw new Error('Invalid or expired password setup link.')
  }

  if (!password.trim()) {
    throw new Error('Password is required.')
  }

  try {
    const { auth, functions } = requireFirebaseServices()
    const currentUser = auth.currentUser

    if (currentUser && currentUser.uid === uid) {
      await updatePassword(currentUser, password)
      return
    }

    const callable = httpsCallable<SetUserPasswordRequest, unknown>(functions, 'setUserPassword')
    await callable({ uid, password, setupToken })
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to set password.'))
  }
}
