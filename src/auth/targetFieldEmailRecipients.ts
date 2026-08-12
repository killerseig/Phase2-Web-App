import { getTargetRoleCapabilities, type TargetRoleKey } from '@/auth/targetRoleCapabilities'
import { targetUserIsAssignedToJob } from '@/auth/targetJobAssignments'

export interface TargetFieldEmailRecipientInput {
  assignedJobIds?: readonly string[] | null
  isShopJob?: boolean
  jobId: string
  role: TargetRoleKey
}

export interface TargetFieldEmailRecipientUser {
  active?: boolean | null
  assignedJobIds?: readonly string[] | null
  email?: string | null
  role: TargetRoleKey
}

export interface TargetFieldEmailRecipientListInput {
  isShopJob?: boolean
  jobId: string
  users: readonly TargetFieldEmailRecipientUser[]
}

function normalizeEmail(email?: string | null): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

export function targetRoleReceivesFieldEmail(input: TargetFieldEmailRecipientInput): boolean {
  if (!input.jobId) return false

  const capabilities = getTargetRoleCapabilities(input.role)
  if (capabilities.receiveShopJobFieldEmails && input.isShopJob) return true

  return capabilities.receiveAssignedJobFieldEmails
    && targetUserIsAssignedToJob(input.jobId, input.assignedJobIds)
}

export function getTargetFieldEmailRecipientEmails(
  input: TargetFieldEmailRecipientListInput,
): string[] {
  const recipients = new Set<string>()

  for (const user of input.users) {
    if (user.active === false) continue
    if (!targetRoleReceivesFieldEmail({
      assignedJobIds: user.assignedJobIds,
      isShopJob: input.isShopJob,
      jobId: input.jobId,
      role: user.role,
    })) {
      continue
    }

    const email = normalizeEmail(user.email)
    if (email) recipients.add(email)
  }

  return Array.from(recipients).sort()
}
