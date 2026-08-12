import { targetFunctionUserIsAssignedToJob } from './targetJobAssignments'
import {
  getTargetFunctionRoleCapabilities,
  type TargetFunctionRoleKey,
} from './targetRoleCapabilities'

export interface TargetFunctionJobAccessInput {
  assignedJobIds?: readonly string[] | null
  isShopJob?: boolean
  jobId: string
  role: TargetFunctionRoleKey
}

export function targetFunctionRoleCanCreateJobs(role: TargetFunctionRoleKey): boolean {
  return getTargetFunctionRoleCapabilities(role).createJobs
}

export function targetFunctionRoleCanDeleteOrArchiveJobs(role: TargetFunctionRoleKey): boolean {
  return getTargetFunctionRoleCapabilities(role).deleteOrArchiveJobs
}

export function targetFunctionRoleCanSeeJobListEntry(input: TargetFunctionJobAccessInput): boolean {
  if (!input.jobId) return false

  const capabilities = getTargetFunctionRoleCapabilities(input.role)
  if (capabilities.viewAllJobs) return true
  if (capabilities.useShopJobDashboard && input.isShopJob) return true

  return capabilities.useAssignedJobDashboards
    && targetFunctionUserIsAssignedToJob(input.jobId, input.assignedJobIds)
}

export function targetFunctionRoleCanOpenJobDashboard(input: TargetFunctionJobAccessInput): boolean {
  if (!input.jobId) return false

  const capabilities = getTargetFunctionRoleCapabilities(input.role)
  if (capabilities.editAllJobs) return true
  if (capabilities.useShopJobDashboard && input.isShopJob) return true

  return capabilities.useAssignedJobDashboards
    && targetFunctionUserIsAssignedToJob(input.jobId, input.assignedJobIds)
}

export function targetFunctionRoleCanEditJobSetup(input: TargetFunctionJobAccessInput): boolean {
  if (!input.jobId) return false

  const capabilities = getTargetFunctionRoleCapabilities(input.role)
  if (capabilities.editAllJobs) return true

  return capabilities.editAssignedJobs
    && targetFunctionUserIsAssignedToJob(input.jobId, input.assignedJobIds)
}
