import type { JobDetails } from './firestoreService'
import { isFunctionShopJob } from './jobIdentity'
import type { CurrentFunctionUser } from './roleAccess'
import {
  targetFunctionRoleCanCreateFieldWorkflow,
  targetFunctionRoleCanEditFieldWorkflowDraft,
  targetFunctionRoleCanSubmitFieldWorkflow,
} from './targetFieldWorkflowAccess'

export type FieldWorkflowWriteAction = 'create' | 'edit-draft' | 'submit'

export function canWriteFieldWorkflowForJob(
  user: CurrentFunctionUser,
  jobId: string,
  job: Pick<JobDetails, 'assignedForemanIds' | 'name' | 'number'> | null | undefined,
  action: FieldWorkflowWriteAction,
): boolean {
  const assignedJobIds = new Set(user.assignedJobIds)
  if ((job?.assignedForemanIds ?? []).includes(user.uid)) {
    assignedJobIds.add(jobId)
  }

  const input = {
    assignedJobIds: Array.from(assignedJobIds),
    isShopJob: isFunctionShopJob(job),
    jobId,
    role: user.role,
  }

  if (action === 'create') return targetFunctionRoleCanCreateFieldWorkflow(input)
  if (action === 'submit') return targetFunctionRoleCanSubmitFieldWorkflow(input)
  return targetFunctionRoleCanEditFieldWorkflowDraft(input)
}
