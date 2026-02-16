import { db } from '../firebase'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'
import type { UserProfile as UserProfileModel, Role } from '@/types/models'
import { ROLES } from '@/constants/app'
import { requireUser } from './serviceGuards'
import { normalizeError } from './serviceUtils'

// Export as both old name (backward compatibility) and new name
export type UserProfile = UserProfileModel

const CANONICAL_ROLES = Object.values(ROLES) as Role[]

const normalizeRoleValue = (value: unknown): Role => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (CANONICAL_ROLES.includes(normalized as Role)) {
      return normalized as Role
    }
  }
  return ROLES.NONE
}

function normalizeUser(id: string, data: DocumentData): UserProfile {
  return {
    id,
    email: data.email ?? null,
    firstName: data.firstName ?? null,
    lastName: data.lastName ?? null,
    role: normalizeRoleValue(data.role),
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
  try {
    const u = requireUser()

    const snap = await getDoc(doc(db, 'users', u.uid))
    if (!snap.exists()) return null

    return normalizeUser(snap.id, snap.data())
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to load user profile'))
  }
}

/**
 * Admin: list all user profiles in Firestore (users collection).
 */
export async function listUsers(): Promise<UserProfile[]> {
  try {
    requireUser()

    const q = query(collection(db, 'users'), orderBy('email', 'asc'))
    const snap = await getDocs(q)
    return snap.docs.map((d) => normalizeUser(d.id, d.data()))
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to load users'))
  }
}

/**
 * Update a user profile document in Firestore (users/{uid}).
 * Which fields are allowed depends on Firestore rules.
 */
export async function updateUser(
  uid: string,
  updates: Partial<Pick<UserProfile, 'firstName' | 'lastName' | 'role' | 'active' | 'assignedJobIds'>>
): Promise<void> {
  try {
    const ref = doc(db, 'users', uid)

    const payload: Record<string, any> = {}

    if ('firstName' in updates) payload.firstName = updates.firstName ?? null
    if ('lastName' in updates) payload.lastName = updates.lastName ?? null
    if ('role' in updates && typeof updates.role !== 'undefined') {
      payload.role = normalizeRoleValue(updates.role)
    }
    if ('active' in updates && typeof updates.active === 'boolean') payload.active = updates.active
    if ('assignedJobIds' in updates) payload.assignedJobIds = updates.assignedJobIds ?? []

    await updateDoc(ref, payload)
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to update user'))
  }
}

/**
 * Admin: delete a user from both Firestore and Firebase Authentication (users/{uid}).
 * Note: This deletes the user completely from both Auth and Firestore.
 */
export async function deleteUser(uid: string): Promise<void> {
  const callable = httpsCallable(functions, 'deleteUser')
  try {
    await callable({ uid })
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to delete user'))
  }
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
  try {
    const normalizedRole = typeof role === 'string' ? normalizeRoleValue(role) : undefined
    const result = await callable({ email, firstName, lastName, role: normalizedRole })
    return result.data as any
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to create user'))
  }
}

// ============================================================================
// FOREMAN MANAGEMENT
// ============================================================================

/**
 * Get a foreman's assigned jobs
 */
export async function getForemanAssignedJobs(foremanId: string): Promise<string[]> {
  try {
    const snap = await getDoc(doc(db, 'users', foremanId))
    if (!snap.exists()) return []
    const data = snap.data()
    return Array.isArray(data.assignedJobIds) ? data.assignedJobIds : []
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to load foreman jobs'))
  }
}

/**
 * Assign a job to a foreman
 */
export async function assignJobToForeman(foremanId: string, jobId: string): Promise<void> {
  try {
    const ref = doc(db, 'users', foremanId)
    const snap = await getDoc(ref)
    if (!snap.exists()) throw new Error('User not found')
    
    const current = snap.data().assignedJobIds ?? []
    if (!current.includes(jobId)) {
      current.push(jobId)
      await updateDoc(ref, { assignedJobIds: current })
    }
  } catch (err) {
    if (err instanceof Error && err.message === 'User not found') {
      throw err
    }
    throw new Error(normalizeError(err, 'Failed to assign job to foreman'))
  }
}

/**
 * Remove a job from a foreman
 */
export async function removeJobFromForeman(foremanId: string, jobId: string): Promise<void> {
  try {
    const ref = doc(db, 'users', foremanId)
    const snap = await getDoc(ref)
    if (!snap.exists()) throw new Error('User not found')
    
    const current = snap.data().assignedJobIds ?? []
    const updated = current.filter((id: string) => id !== jobId)
    await updateDoc(ref, { assignedJobIds: updated })
  } catch (err) {
    if (err instanceof Error && err.message === 'User not found') {
      throw err
    }
    throw new Error(normalizeError(err, 'Failed to remove job from foreman'))
  }
}

/**
 * Set all jobs for a foreman (replaces existing)
 */
export async function setForemanJobs(foremanId: string, jobIds: string[]): Promise<void> {
  try {
    const ref = doc(db, 'users', foremanId)
    await updateDoc(ref, { assignedJobIds: jobIds })
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to set foreman jobs'))
  }
}

/**
 * List all foremen (users with role 'foreman')
 */
export async function listForemen(): Promise<UserProfile[]> {
  try {
    requireUser()

    const q = query(
      collection(db, 'users'),
      orderBy('email', 'asc')
    )
    const snap = await getDocs(q)
    return snap.docs
      .map((d) => normalizeUser(d.id, d.data()))
      .filter((user) => user.role === ROLES.FOREMAN)
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to load foremen'))
  }
}

/**
 * Admin utility: ensure a job's assignedForemanIds and each foreman's assignedJobIds stay in sync.
 * Makes no destructive changes—only adds missing links in either direction.
 */
export async function syncForemanAssignmentsForJob(jobId: string): Promise<void> {
  try {
    const jobRef = doc(db, 'jobs', jobId)
    const jobSnap = await getDoc(jobRef)
    if (!jobSnap.exists()) {
      throw new Error('Job not found')
    }

    const jobData = jobSnap.data()
    const jobForemen = Array.isArray(jobData.assignedForemanIds)
      ? jobData.assignedForemanIds.filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0)
      : []

    const usersWithJobSnap = await getDocs(
      query(collection(db, 'users'), where('assignedJobIds', 'array-contains', jobId))
    )

    const union = new Set<string>(jobForemen)
    usersWithJobSnap.docs.forEach((docSnap) => union.add(docSnap.id))

    // Update job doc if we filled gaps
    await updateDoc(jobRef, { assignedForemanIds: Array.from(union) })

    // Ensure each foreman's user doc lists this job
    await Promise.all(
      Array.from(union).map(async (foremanId) => {
        const existingUserSnap = usersWithJobSnap.docs.find((d) => d.id === foremanId) ?? (await getDoc(doc(db, 'users', foremanId)))
        if (!existingUserSnap.exists()) return
        const userData = existingUserSnap.data()
        const assigned = Array.isArray(userData.assignedJobIds)
          ? userData.assignedJobIds.slice()
          : []
        if (!assigned.includes(jobId)) {
          assigned.push(jobId)
          await updateDoc(doc(db, 'users', foremanId), { assignedJobIds: assigned })
        }
      })
    )
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to sync foreman assignments'))
  }
}

/**
 * Get all foremen assigned to a job
 * Used by admin to see who manages a job
 */
export async function getForemenForJob(jobId: string): Promise<UserProfile[]> {
  try {
    requireUser()

    const allForemen = await listForemen()
    return allForemen.filter(foreman =>
      foreman.assignedJobIds?.includes(jobId)
    )
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to load foremen for job'))
  }
}