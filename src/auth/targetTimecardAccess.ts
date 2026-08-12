import { getTargetRoleCapabilities, type TargetRoleKey } from '@/auth/targetRoleCapabilities'
import { targetUserIsAssignedToJob } from '@/auth/targetJobAssignments'

export interface TargetTimecardAccessInput {
  assignedJobIds?: readonly string[] | null
  isShopJob?: boolean
  jobId: string
  role: TargetRoleKey
}

export function targetRoleCanUseTimecardExport(role: TargetRoleKey): boolean {
  return getTargetRoleCapabilities(role).useTimecardExport
}

export function targetRoleCanLockTimecards(role: TargetRoleKey): boolean {
  return getTargetRoleCapabilities(role).lockTimecards
}

export function targetRoleCanDeleteDraftTimecardWeeks(role: TargetRoleKey): boolean {
  return getTargetRoleCapabilities(role).deleteDraftTimecardWeeks
}

export function targetRoleCanUseJobTimecardWorkflow(input: TargetTimecardAccessInput): boolean {
  if (!input.jobId) return false

  const capabilities = getTargetRoleCapabilities(input.role)
  if (capabilities.editAllJobs) return true
  if (capabilities.editShopJobTimecards && input.isShopJob) return true

  return capabilities.editAssignedTimecards
    && targetUserIsAssignedToJob(input.jobId, input.assignedJobIds)
}

export function targetRoleCanSubmitJobTimecards(input: TargetTimecardAccessInput): boolean {
  return targetRoleCanUseJobTimecardWorkflow(input)
}

export function targetRoleCanViewSubmittedTimecards(input: TargetTimecardAccessInput): boolean {
  if (!input.jobId) return false

  const capabilities = getTargetRoleCapabilities(input.role)
  if (capabilities.editAllJobs || capabilities.useTimecardExport) return true
  if (capabilities.editShopJobTimecards && input.isShopJob) return true
  if (
    capabilities.editAssignedTimecards
    && targetUserIsAssignedToJob(input.jobId, input.assignedJobIds)
  ) {
    return true
  }

  return capabilities.viewSubmittedAssignedTimecards
    && targetUserIsAssignedToJob(input.jobId, input.assignedJobIds)
}

export function targetRoleCanViewSubmittedTimecardReport(input: TargetTimecardAccessInput): boolean {
  if (!input.jobId) return false

  const capabilities = getTargetRoleCapabilities(input.role)
  if (capabilities.editAllJobs) return true

  return capabilities.viewSubmittedAssignedTimecards
    && targetUserIsAssignedToJob(input.jobId, input.assignedJobIds)
}
