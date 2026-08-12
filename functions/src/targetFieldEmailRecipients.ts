import { targetFunctionUserIsAssignedToJob } from './targetJobAssignments'
import {
  getTargetFunctionRoleCapabilities,
  type TargetFunctionRoleKey,
} from './targetRoleCapabilities'

export interface TargetFunctionFieldEmailRecipientInput {
  assignedJobIds?: readonly string[] | null
  isShopJob?: boolean
  jobId: string
  role: TargetFunctionRoleKey
}

export interface TargetFunctionFieldEmailRecipientUser {
  active?: boolean | null
  assignedJobIds?: readonly string[] | null
  email?: string | null
  role: TargetFunctionRoleKey
}

export interface TargetFunctionFieldEmailRecipientListInput {
  isShopJob?: boolean
  jobId: string
  users: readonly TargetFunctionFieldEmailRecipientUser[]
}

function normalizeEmail(email?: string | null): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

export function targetFunctionRoleReceivesFieldEmail(
  input: TargetFunctionFieldEmailRecipientInput,
): boolean {
  if (!input.jobId) return false

  const capabilities = getTargetFunctionRoleCapabilities(input.role)
  if (capabilities.receiveShopJobFieldEmails && input.isShopJob) return true

  return capabilities.receiveAssignedJobFieldEmails
    && targetFunctionUserIsAssignedToJob(input.jobId, input.assignedJobIds)
}

export function getTargetFunctionFieldEmailRecipientEmails(
  input: TargetFunctionFieldEmailRecipientListInput,
): string[] {
  const recipients = new Set<string>()

  for (const user of input.users) {
    if (user.active === false) continue
    if (!targetFunctionRoleReceivesFieldEmail({
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
