import { targetUserIsAssignedToJob } from '@/auth/targetJobAssignments'
import { getTargetRoleCapabilities, type TargetRoleKey } from '@/auth/targetRoleCapabilities'

export interface TargetFieldWorkflowAccessInput {
  assignedJobIds?: readonly string[] | null
  isShopJob?: boolean
  jobId: string
  role: TargetRoleKey
}

export function targetRoleCanOpenFieldWorkflow(input: TargetFieldWorkflowAccessInput): boolean {
  if (!input.jobId) return false

  const capabilities = getTargetRoleCapabilities(input.role)
  if (capabilities.editAllJobs) return true
  if (capabilities.useShopJobDashboard && input.isShopJob) return true

  return capabilities.useAssignedJobDashboards
    && targetUserIsAssignedToJob(input.jobId, input.assignedJobIds)
}

export function targetRoleCanViewSubmittedFieldWorkflow(
  input: TargetFieldWorkflowAccessInput,
): boolean {
  return targetRoleCanOpenFieldWorkflow(input)
}

export function targetRoleCanCreateFieldWorkflow(input: TargetFieldWorkflowAccessInput): boolean {
  if (!input.jobId) return false

  const capabilities = getTargetRoleCapabilities(input.role)
  if (capabilities.editAllJobs) return true
  if (capabilities.editShopJobFieldWorkflows && input.isShopJob) return true

  return capabilities.editAssignedFieldWorkflows
    && targetUserIsAssignedToJob(input.jobId, input.assignedJobIds)
}

export function targetRoleCanEditFieldWorkflowDraft(
  input: TargetFieldWorkflowAccessInput,
): boolean {
  return targetRoleCanCreateFieldWorkflow(input)
}

export function targetRoleCanSubmitFieldWorkflow(input: TargetFieldWorkflowAccessInput): boolean {
  return targetRoleCanCreateFieldWorkflow(input)
}
