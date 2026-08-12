import { getTargetRoleCapabilities, type TargetRoleKey } from '@/auth/targetRoleCapabilities'
import { targetUserIsAssignedToJob } from '@/auth/targetJobAssignments'

export interface TargetJobAccessInput {
  assignedJobIds?: readonly string[] | null
  isShopJob?: boolean
  jobId: string
  role: TargetRoleKey
}

export function targetRoleCanCreateJobs(role: TargetRoleKey): boolean {
  return getTargetRoleCapabilities(role).createJobs
}

export function targetRoleCanDeleteOrArchiveJobs(role: TargetRoleKey): boolean {
  return getTargetRoleCapabilities(role).deleteOrArchiveJobs
}

export function targetRoleCanSeeJobListEntry(input: TargetJobAccessInput): boolean {
  if (!input.jobId) return false

  const capabilities = getTargetRoleCapabilities(input.role)
  if (capabilities.viewAllJobs) return true
  if (capabilities.useShopJobDashboard && input.isShopJob) return true

  return capabilities.useAssignedJobDashboards
    && targetUserIsAssignedToJob(input.jobId, input.assignedJobIds)
}

export function targetRoleCanOpenJobDashboard(input: TargetJobAccessInput): boolean {
  if (!input.jobId) return false

  const capabilities = getTargetRoleCapabilities(input.role)
  if (capabilities.editAllJobs) return true
  if (capabilities.useShopJobDashboard && input.isShopJob) return true

  return capabilities.useAssignedJobDashboards
    && targetUserIsAssignedToJob(input.jobId, input.assignedJobIds)
}

export function targetRoleCanEditJobSetup(input: TargetJobAccessInput): boolean {
  if (!input.jobId) return false

  const capabilities = getTargetRoleCapabilities(input.role)
  if (capabilities.editAllJobs) return true

  return capabilities.editAssignedJobs
    && targetUserIsAssignedToJob(input.jobId, input.assignedJobIds)
}
