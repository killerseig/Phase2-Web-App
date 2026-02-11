import { auth, db } from '../firebase'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'
import type { UserProfile as UserProfileModel, Role } from '@/types/models'

// Export as both old name (backward compatibility) and new name
export type UserProfile = UserProfileModel

function normalizeUser(id: string, data: DocumentData): UserProfile {
  return {
    id,
    email: data.email ?? null,
    firstName: data.firstName ?? null,
    lastName: data.lastName ?? null,
    role: (data.role ?? 'none') as Role,
    active: typeof data.active === 'boolean' ? data.active : true,
    assignedJobIds: Array.isArray(data.assignedJobIds) ? data.assignedJobIds : [],
    createdAt: data.createdAt,
    lastLoginAt: data.lastLoginAt,
  }
}

/**
 * Fetch the current signed-in user's Firestore profile (users/{uid}).
 */
export async function getMyUserProfile(): Promise<UserProfile | null> {
  const u = auth.currentUser
  if (!u) return null

  const snap = await getDoc(doc(db, 'users', u.uid))
  if (!snap.exists()) return null

  return normalizeUser(snap.id, snap.data())
}

/**
 * Admin: list all user profiles in Firestore (users collection).
 */
export async function listUsers(): Promise<UserProfile[]> {
  // Ensure user is signed in
  const u = auth.currentUser
  if (!u) throw new Error('Not signed in')

  const q = query(collection(db, 'users'), orderBy('email', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => normalizeUser(d.id, d.data()))
}

/**
 * Update a user profile document in Firestore (users/{uid}).
 * Which fields are allowed depends on Firestore rules.
 */
export async function updateUser(
  uid: string,
  updates: Partial<Pick<UserProfile, 'firstName' | 'lastName' | 'role' | 'active' | 'assignedJobIds'>>
): Promise<void> {
  const ref = doc(db, 'users', uid)

  const payload: Record<string, any> = {}

  if ('firstName' in updates) payload.firstName = updates.firstName ?? null
  if ('lastName' in updates) payload.lastName = updates.lastName ?? null
  if ('role' in updates && updates.role) payload.role = updates.role
  if ('active' in updates && typeof updates.active === 'boolean') payload.active = updates.active
  if ('assignedJobIds' in updates) payload.assignedJobIds = updates.assignedJobIds ?? []

  await updateDoc(ref, payload)
}

/**
 * Admin: delete a user from both Firestore and Firebase Authentication (users/{uid}).
 * Note: This deletes the user completely from both Auth and Firestore.
 */
export async function deleteUser(uid: string): Promise<void> {
  const callable = httpsCallable(functions, 'deleteUser')
  await callable({ uid })
}

/**
 * Admin: Create a new user account
 * Sends welcome email with password reset link
 */
export async function createUserByAdmin(
  email: string,
  firstName: string,
  lastName: string,
  role?: Role
): Promise<{ success: boolean; message: string; uid: string }> {
  const callable = httpsCallable(functions, 'createUserByAdmin')
  const result = await callable({ email, firstName, lastName, role })
  return result.data as any
}

// ============================================================================
// FOREMAN MANAGEMENT
// ============================================================================

/**
 * Get a foreman's assigned jobs
 */
export async function getForemanAssignedJobs(foremanId: string): Promise<string[]> {
  const snap = await getDoc(doc(db, 'users', foremanId))
  if (!snap.exists()) return []
  const data = snap.data()
  return Array.isArray(data.assignedJobIds) ? data.assignedJobIds : []
}

/**
 * Assign a job to a foreman
 */
export async function assignJobToForeman(foremanId: string, jobId: string): Promise<void> {
  const ref = doc(db, 'users', foremanId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('User not found')
  
  const current = snap.data().assignedJobIds ?? []
  if (!current.includes(jobId)) {
    current.push(jobId)
    await updateDoc(ref, { assignedJobIds: current })
  }
}

/**
 * Remove a job from a foreman
 */
export async function removeJobFromForeman(foremanId: string, jobId: string): Promise<void> {
  const ref = doc(db, 'users', foremanId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('User not found')
  
  const current = snap.data().assignedJobIds ?? []
  const updated = current.filter((id: string) => id !== jobId)
  await updateDoc(ref, { assignedJobIds: updated })
}

/**
 * Set all jobs for a foreman (replaces existing)
 */
export async function setForemanJobs(foremanId: string, jobIds: string[]): Promise<void> {
  const ref = doc(db, 'users', foremanId)
  await updateDoc(ref, { assignedJobIds: jobIds })
}

/**
 * List all foremen (users with role 'foreman')
 */
export async function listForemen(): Promise<UserProfile[]> {
  const u = auth.currentUser
  if (!u) throw new Error('Not signed in')

  const q = query(
    collection(db, 'users'),
    orderBy('email', 'asc')
  )
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => normalizeUser(d.id, d.data()))
    .filter(user => user.role === 'foreman')
}

/**
 * Get all foremen assigned to a job
 * Used by admin to see who manages a job
 */
export async function getForemenForJob(jobId: string): Promise<UserProfile[]> {
  const u = auth.currentUser
  if (!u) throw new Error('Not signed in')

  const allForemen = await listForemen()
  return allForemen.filter(foreman =>
    foreman.assignedJobIds?.includes(jobId)
  )
}