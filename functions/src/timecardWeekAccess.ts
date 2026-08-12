import type { JobDetails } from './firestoreService'
import { isFunctionShopJob } from './jobIdentity'
import type { CurrentFunctionUser } from './roleAccess'
import {
  targetFunctionRoleCanUseJobTimecardWorkflow,
  targetFunctionRoleCanUseTimecardExport,
} from './targetTimecardAccess'

export { isFunctionShopJob } from './jobIdentity'

export function canCreateTimecardWeekForJob(
  user: CurrentFunctionUser,
  jobId: string,
  job: Pick<JobDetails, 'assignedForemanIds' | 'name' | 'number'> | null | undefined,
): boolean {
  if (targetFunctionRoleCanUseTimecardExport(user.role)) return true

  const assignedJobIds = new Set(user.assignedJobIds)
  if ((job?.assignedForemanIds ?? []).includes(user.uid)) {
    assignedJobIds.add(jobId)
  }

  return targetFunctionRoleCanUseJobTimecardWorkflow({
    assignedJobIds: Array.from(assignedJobIds),
    isShopJob: isFunctionShopJob(job),
    jobId,
    role: user.role,
  })
}
