import { computed } from 'vue'
import {
  canOpenUnassignedTimecardRoute,
  canUseJobTimecardWorkflow as canUseJobTimecardWorkflowForRole,
  canViewSubmittedTimecardReport as canViewSubmittedTimecardReportForRole,
} from '@/auth/capabilities'
import { isShopJobRecord } from '@/auth/jobIdentity'
import type { JobRecord, RawRoleKey } from '@/types/domain'
import type { ReadonlyRef } from '@/types/reactivity'
import type { JobTimecardWeekSubscriptionMode } from './useJobTimecardRecords'

export interface UseJobTimecardAccessOptions {
  getAssignedJobIds: () => readonly string[]
  getCanManageJobTimecards: () => boolean
  getCurrentUserId: () => string | null
  getRawRole: () => RawRoleKey
  job: ReadonlyRef<JobRecord | null>
  jobId: ReadonlyRef<string>
}

export function useJobTimecardAccess({
  getAssignedJobIds,
  getCanManageJobTimecards,
  getCurrentUserId,
  getRawRole,
  job,
  jobId,
}: UseJobTimecardAccessOptions) {
  const isCurrentJobShopJob = computed(() => isShopJobRecord(job.value))

  const timecardAssignedJobIds = computed(() => {
    const ids = new Set(getAssignedJobIds())
    const currentJob = job.value
    const currentUserId = getCurrentUserId() ?? ''

    if (
      currentJob?.id
      && currentUserId
      && (currentJob.assignedForemanIds ?? []).includes(currentUserId)
    ) {
      ids.add(currentJob.id)
    }

    return Array.from(ids)
  })

  const canUseJobTimecardWorkflow = computed(() => {
    const rawRole = getRawRole()

    return canUseJobTimecardWorkflowForRole({
      assignedJobIds: timecardAssignedJobIds.value,
      isShopJob: isCurrentJobShopJob.value,
      jobId: jobId.value,
      rawRole,
    }) || canOpenUnassignedTimecardRoute(rawRole, 'timecards')
  })

  const canViewSubmittedTimecardReport = computed(() => canViewSubmittedTimecardReportForRole({
    assignedJobIds: timecardAssignedJobIds.value,
    isShopJob: isCurrentJobShopJob.value,
    jobId: jobId.value,
    rawRole: getRawRole(),
  }))

  const weekSubscriptionMode = computed<JobTimecardWeekSubscriptionMode>(() => {
    if (getCanManageJobTimecards()) return 'all'
    if (canUseJobTimecardWorkflow.value) return 'all'
    if (canViewSubmittedTimecardReport.value && !canUseJobTimecardWorkflow.value) return 'submitted-report'
    return 'current-user'
  })

  return {
    canUseJobTimecardWorkflow,
    canViewSubmittedTimecardReport,
    isCurrentJobShopJob,
    timecardAssignedJobIds,
    weekSubscriptionMode,
  }
}
