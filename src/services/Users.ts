import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  writeBatch,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { requireFirebaseServices } from '@/firebase'
import type { RoleKey, UserProfile } from '@/types/domain'
import { normalizeRoleKey, toEffectiveRole } from '@/types/domain'
import { normalizeError } from '@/utils/normalizeError'

export interface CreateUserInput {
  email: string
  firstName: string
  lastName: string
  role: Exclude<RoleKey, 'none'>
  assignedJobIds?: string[]
  sendInvite?: boolean
}

export interface UpdateUserInput {
  firstName: string
  lastName: string
  role: Exclude<RoleKey, 'none'>
  active: boolean
  assignedJobIds?: string[]
}

export interface DeleteUserResult {
  success: boolean
  message: string
  removedFromRecipientLists?: boolean
  updatedJobCount?: number
}

export interface SendPendingUserInvitesResult {
  success: boolean
  message: string
  sentCount: number
  skippedCount: number
}

interface CreateUserByAdminResponse {
  success: boolean
  message: string
  uid: string
}

function normalizeAssignedJobIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return Array.from(
    new Set(value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)),
  )
}

function normalizeUser(id: string, data: DocumentData): UserProfile {
  return {
    id,
    email: typeof data.email === 'string' ? data.email : null,
    firstName: typeof data.firstName === 'string' ? data.firstName : null,
    lastName: typeof data.lastName === 'string' ? data.lastName : null,
    role: normalizeRoleKey(data.role),
    active: data.active !== false,
    assignedJobIds: normalizeAssignedJobIds(data.assignedJobIds),
    inviteStatus: typeof data.inviteStatus === 'string' ? data.inviteStatus : null,
    inviteSentAt: data.inviteSentAt ?? null,
  }
}

function sortUsers(users: UserProfile[]): UserProfile[] {
  return users.slice().sort((left, right) => {
    const leftName = `${left.firstName ?? ''} ${left.lastName ?? ''}`.trim()
    const rightName = `${right.firstName ?? ''} ${right.lastName ?? ''}`.trim()

    if (leftName && rightName && leftName !== rightName) {
      return leftName.localeCompare(rightName)
    }

    return (left.email ?? '').localeCompare(right.email ?? '')
  })
}

async function syncUserJobAssignments(uid: string, role: Exclude<RoleKey, 'none'>, nextAssignedJobIds: string[]) {
  const { db } = requireFirebaseServices()
  const userRef = doc(db, 'users', uid)
  const userSnapshot = await getDoc(userRef)

  if (!userSnapshot.exists()) {
    throw new Error('User not found.')
  }

  const previousAssignedJobIds = normalizeAssignedJobIds(userSnapshot.data().assignedJobIds)
  const effectiveAssignedJobIds = role === 'foreman' ? nextAssignedJobIds : []
  const changedJobIds = Array.from(new Set([...previousAssignedJobIds, ...effectiveAssignedJobIds]))

  const batch = writeBatch(db)
  batch.update(userRef, { assignedJobIds: effectiveAssignedJobIds })

  for (const jobId of changedJobIds) {
    const jobRef = doc(db, 'jobs', jobId)
    const jobSnapshot = await getDoc(jobRef)
    if (!jobSnapshot.exists()) continue

    const currentAssignedForemanIds = normalizeAssignedJobIds(jobSnapshot.data().assignedForemanIds)
    const nextAssignedForemanIds = new Set(currentAssignedForemanIds)

    if (effectiveAssignedJobIds.includes(jobId) && role === 'foreman') {
      nextAssignedForemanIds.add(uid)
    } else {
      nextAssignedForemanIds.delete(uid)
    }

    batch.update(jobRef, { assignedForemanIds: Array.from(nextAssignedForemanIds) })
  }

  await batch.commit()
}

export function subscribeUsers(
  onUpdate: (users: UserProfile[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  const { db } = requireFirebaseServices()

  return onSnapshot(
    query(collection(db, 'users')),
    (snapshot) => {
      onUpdate(sortUsers(snapshot.docs.map((item) => normalizeUser(item.id, item.data()))))
    },
    (error) => {
      onError?.(error)
    },
  )
}

export async function createUserByAdmin(input: CreateUserInput): Promise<CreateUserByAdminResponse> {
  try {
    const { functions } = requireFirebaseServices()
    const callable = httpsCallable<CreateUserInput, CreateUserByAdminResponse>(functions, 'createUserByAdmin')
    const sanitizedRole = input.role === 'admin' ? 'admin' : 'foreman'
    const sanitizedAssignedJobIds = normalizeAssignedJobIds(input.assignedJobIds)
    const result = await callable({
      email: input.email.trim(),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      role: sanitizedRole,
      sendInvite: input.sendInvite === true,
    })

    if (sanitizedRole === 'foreman' && sanitizedAssignedJobIds.length) {
      try {
        await syncUserJobAssignments(result.data.uid, sanitizedRole, sanitizedAssignedJobIds)
      } catch (error) {
        const baseMessage = result.data.message || 'User created. Invite queued.'
        const assignmentMessage = normalizeError(error, 'Assigned jobs could not be saved.')
        return {
          ...result.data,
          message: `${baseMessage} ${assignmentMessage} Open the user and save assigned jobs again if needed.`,
        }
      }
    }

    return result.data
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to create user.'))
  }
}

export async function updateUser(uid: string, input: UpdateUserInput): Promise<void> {
  try {
    const { db } = requireFirebaseServices()
    const sanitizedRole = input.role === 'admin' ? 'admin' : 'foreman'
    const sanitizedAssignedJobIds = normalizeAssignedJobIds(input.assignedJobIds)

    await updateDoc(doc(db, 'users', uid), {
      firstName: input.firstName.trim() || null,
      lastName: input.lastName.trim() || null,
      role: sanitizedRole,
      active: input.active,
    })

    await syncUserJobAssignments(uid, sanitizedRole, sanitizedAssignedJobIds)
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to update user.'))
  }
}

export async function deleteUserByAdmin(uid: string): Promise<DeleteUserResult> {
  try {
    const { functions } = requireFirebaseServices()
    const callable = httpsCallable<{ uid: string }, DeleteUserResult>(functions, 'deleteUser')
    const result = await callable({ uid })
    return result.data
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to delete user.'))
  }
}

export async function sendPendingInvitesByAdmin(): Promise<SendPendingUserInvitesResult> {
  try {
    const { functions } = requireFirebaseServices()
    const callable = httpsCallable<Record<string, never>, SendPendingUserInvitesResult>(functions, 'sendPendingUserInvites')
    const result = await callable({})
    return result.data
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to send pending invites.'))
  }
}

export function getRoleBadgeLabel(role: UserProfile['role']): string {
  const effectiveRole = toEffectiveRole(role)
  if (effectiveRole === 'admin') return 'Admin'
  if (effectiveRole === 'foreman') return 'Foreman'
  return 'No Access'
}
