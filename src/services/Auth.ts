import { sendPasswordResetEmail as sendPasswordResetEmailWithFirebase, updatePassword, updateProfile, type User } from 'firebase/auth'
import { doc, updateDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { auth, db, functions } from '@/firebase'
import { normalizeError } from './serviceUtils'

const assertInvitePayload = (data: InviteUserRequest) => {
  if (!data.email || !data.email.includes('@')) {
    throw new Error('A valid email is required to invite a user')
  }
}

export interface InviteUserRequest {
  email: string
  displayName?: string
  role?: string
}

export interface InviteUserResponse {
  uid: string
  email: string
  message: string
}

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

/**
 * Call the inviteUser Cloud Function to provision a new user account.
 */
export async function inviteUser(data: InviteUserRequest): Promise<InviteUserResponse> {
  assertInvitePayload(data)
  const callable = httpsCallable<InviteUserRequest, InviteUserResponse>(functions, 'inviteUser')
  try {
    const result = await callable(data)
    return result.data
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to invite user'))
  }
}

export async function sendPasswordResetEmail(email: string): Promise<void> {
  const sanitizedEmail = email.trim()
  if (!sanitizedEmail) {
    throw new Error('Please enter your email')
  }

  try {
    await sendPasswordResetEmailWithFirebase(auth, sanitizedEmail)
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to send reset email'))
  }
}

export async function finalizeRegisteredUserProfile(
  user: User,
  firstName: string,
  lastName: string
): Promise<void> {
  const safeFirstName = firstName.trim()
  const safeLastName = lastName.trim()
  const displayName = `${safeFirstName} ${safeLastName}`.trim()

  if (displayName) {
    await updateProfile(user, { displayName })
  }

  await updateDoc(doc(db, 'users', user.uid), {
    firstName: safeFirstName || null,
    lastName: safeLastName || null,
  })
}

export async function verifySetupToken(uid: string, setupToken: string): Promise<string> {
  if (!uid || !setupToken) {
    throw new Error('Invalid or expired password setup link.')
  }

  const callable = httpsCallable<VerifySetupTokenRequest, VerifySetupTokenResponse>(functions, 'verifySetupToken')
  try {
    const result = await callable({ uid, setupToken })
    return result.data.email || ''
  } catch (err) {
    throw new Error(normalizeError(err, 'Invalid or expired password setup link.'))
  }
}

export async function setPasswordFromSetupLink(
  uid: string,
  password: string,
  setupToken: string
): Promise<void> {
  if (!uid || !setupToken) {
    throw new Error('Invalid or expired password setup link.')
  }
  if (!password.trim()) {
    throw new Error('Password is required')
  }

  const currentUser = auth.currentUser
  if (currentUser && currentUser.uid === uid) {
    await updatePassword(currentUser, password)
    return
  }

  const callable = httpsCallable<SetUserPasswordRequest, unknown>(functions, 'setUserPassword')
  await callable({ uid, password, setupToken })
}
