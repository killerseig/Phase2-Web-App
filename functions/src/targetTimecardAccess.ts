import { targetFunctionUserIsAssignedToJob } from './targetJobAssignments'
import {
  getTargetFunctionRoleCapabilities,
  type TargetFunctionRoleKey,
} from './targetRoleCapabilities'

export interface TargetFunctionTimecardAccessInput {
  assignedJobIds?: readonly string[] | null
  isShopJob?: boolean
  jobId: string
  role: TargetFunctionRoleKey
}

export function targetFunctionRoleCanUseTimecardExport(role: TargetFunctionRoleKey): boolean {
  return getTargetFunctionRoleCapabilities(role).useTimecardExport
}

export function targetFunctionRoleCanLockTimecards(role: TargetFunctionRoleKey): boolean {
  return getTargetFunctionRoleCapabilities(role).lockTimecards
}

export function targetFunctionRoleCanDeleteDraftTimecardWeeks(
  role: TargetFunctionRoleKey,
): boolean {
  return getTargetFunctionRoleCapabilities(role).deleteDraftTimecardWeeks
}

export function targetFunctionRoleCanUseJobTimecardWorkflow(
  input: TargetFunctionTimecardAccessInput,
): boolean {
  if (!input.jobId) return false

  const capabilities = getTargetFunctionRoleCapabilities(input.role)
  if (capabilities.editAllJobs) return true
  if (capabilities.editShopJobTimecards && input.isShopJob) return true

  return capabilities.editAssignedTimecards
    && targetFunctionUserIsAssignedToJob(input.jobId, input.assignedJobIds)
}

export function targetFunctionRoleCanSubmitJobTimecards(
  input: TargetFunctionTimecardAccessInput,
): boolean {
  return targetFunctionRoleCanUseJobTimecardWorkflow(input)
}

export function targetFunctionRoleCanViewSubmittedTimecards(
  input: TargetFunctionTimecardAccessInput,
): boolean {
  if (!input.jobId) return false

  const capabilities = getTargetFunctionRoleCapabilities(input.role)
  if (capabilities.editAllJobs || capabilities.useTimecardExport) return true
  if (capabilities.editShopJobTimecards && input.isShopJob) return true
  if (
    capabilities.editAssignedTimecards
    && targetFunctionUserIsAssignedToJob(input.jobId, input.assignedJobIds)
  ) {
    return true
  }

  return capabilities.viewSubmittedAssignedTimecards
    && targetFunctionUserIsAssignedToJob(input.jobId, input.assignedJobIds)
}

export function targetFunctionRoleCanViewSubmittedTimecardReport(
  input: TargetFunctionTimecardAccessInput,
): boolean {
  if (!input.jobId) return false

  const capabilities = getTargetFunctionRoleCapabilities(input.role)
  if (capabilities.editAllJobs) return true

  return capabilities.viewSubmittedAssignedTimecards
    && targetFunctionUserIsAssignedToJob(input.jobId, input.assignedJobIds)
}
