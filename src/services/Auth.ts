import { updatePassword } from 'firebase/auth'
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { requireFirebaseServices } from '@/firebase'
import type { UserProfile } from '@/types/domain'
import { normalizeRoleKey } from '@/types/domain'
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

interface AuthUserProfileSeed {
  displayName?: string | null
  email?: string | null
}

function normalizeAssignedJobIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string')
}

export function normalizeAuthUserProfile(uid: string, data: Record<string, unknown>): UserProfile {
  return {
    id: uid,
    email: typeof data.email === 'string' ? data.email : null,
    firstName: typeof data.firstName === 'string' ? data.firstName : null,
    lastName: typeof data.lastName === 'string' ? data.lastName : null,
    role: normalizeRoleKey(data.role),
    active: data.active !== false,
    assignedJobIds: normalizeAssignedJobIds(data.assignedJobIds),
  }
}

export async function getOrCreateUserProfile(
  uid: string,
  authUser: AuthUserProfileSeed | null,
): Promise<UserProfile> {
  const { db } = requireFirebaseServices()
  const profileRef = doc(db, 'users', uid)
  const snapshot = await getDoc(profileRef)

  if (snapshot.exists()) {
    return normalizeAuthUserProfile(snapshot.id, snapshot.data())
  }

  await setDoc(profileRef, {
    email: authUser?.email ?? null,
    displayName: authUser?.displayName || null,
    firstName: null,
    lastName: null,
    role: 'none',
    active: true,
    assignedJobIds: [],
    createdAt: serverTimestamp(),
  })

  return {
    id: uid,
    email: authUser?.email ?? null,
    firstName: null,
    lastName: null,
    role: 'none',
    active: true,
    assignedJobIds: [],
  }
}

export function subscribeUserProfile(
  uid: string,
  onProfile: (profile: UserProfile | null) => void,
  onError: (error: unknown) => void,
) {
  const { db } = requireFirebaseServices()
  return onSnapshot(
    doc(db, 'users', uid),
    (snapshot) => {
      onProfile(snapshot.exists() ? normalizeAuthUserProfile(snapshot.id, snapshot.data()) : null)
    },
    onError,
  )
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
