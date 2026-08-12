import { targetFunctionUserIsAssignedToJob } from './targetJobAssignments'
import {
  getTargetFunctionRoleCapabilities,
  type TargetFunctionRoleKey,
} from './targetRoleCapabilities'

export interface TargetFunctionFieldWorkflowAccessInput {
  assignedJobIds?: readonly string[] | null
  isShopJob?: boolean
  jobId: string
  role: TargetFunctionRoleKey
}

export function targetFunctionRoleCanOpenFieldWorkflow(
  input: TargetFunctionFieldWorkflowAccessInput,
): boolean {
  if (!input.jobId) return false

  const capabilities = getTargetFunctionRoleCapabilities(input.role)
  if (capabilities.editAllJobs) return true
  if (capabilities.useShopJobDashboard && input.isShopJob) return true

  return capabilities.useAssignedJobDashboards
    && targetFunctionUserIsAssignedToJob(input.jobId, input.assignedJobIds)
}

export function targetFunctionRoleCanViewSubmittedFieldWorkflow(
  input: TargetFunctionFieldWorkflowAccessInput,
): boolean {
  return targetFunctionRoleCanOpenFieldWorkflow(input)
}

export function targetFunctionRoleCanCreateFieldWorkflow(
  input: TargetFunctionFieldWorkflowAccessInput,
): boolean {
  if (!input.jobId) return false

  const capabilities = getTargetFunctionRoleCapabilities(input.role)
  if (capabilities.editAllJobs) return true
  if (capabilities.editShopJobFieldWorkflows && input.isShopJob) return true

  return capabilities.editAssignedFieldWorkflows
    && targetFunctionUserIsAssignedToJob(input.jobId, input.assignedJobIds)
}

export function targetFunctionRoleCanEditFieldWorkflowDraft(
  input: TargetFunctionFieldWorkflowAccessInput,
): boolean {
  return targetFunctionRoleCanCreateFieldWorkflow(input)
}

export function targetFunctionRoleCanSubmitFieldWorkflow(
  input: TargetFunctionFieldWorkflowAccessInput,
): boolean {
  return targetFunctionRoleCanCreateFieldWorkflow(input)
}
