import { computed, type Ref } from 'vue'
import { canEditJobSetup as canEditJobSetupForRole } from '@/auth/capabilities'
import type { JobRecord, RawRoleKey } from '@/types/domain'

export interface JobsCapabilitySource {
  assignedJobIds?: readonly string[]
  canCreateJobs: boolean
  canUseJobSetupEditor: boolean
  canDeleteOrArchiveJobs: boolean
  canEditJobSetup(jobId: string): boolean
  currentUser?: { uid: string } | null
  rawRole?: RawRoleKey
}

export interface UseJobsCapabilitiesOptions {
  auth: JobsCapabilitySource
  selectedJob: Readonly<Ref<Pick<JobRecord, 'assignedForemanIds' | 'id'> | null | undefined>>
}

export function useJobsCapabilities(options: UseJobsCapabilitiesOptions) {
  const canCreateJobs = computed(() => options.auth.canCreateJobs)
  const canUseJobSetupEditor = computed(() => options.auth.canUseJobSetupEditor)
  const canDeleteOrArchiveJobs = computed(() => options.auth.canDeleteOrArchiveJobs)
  const canEditSelectedJobSetup = computed(() => {
    const selectedJob = options.selectedJob.value
    if (!selectedJob) return false

    if (options.auth.canEditJobSetup(selectedJob.id)) return true

    const currentUserId = options.auth.currentUser?.uid ?? ''
    if (!currentUserId || !(selectedJob.assignedForemanIds ?? []).includes(currentUserId)) {
      return false
    }

    return canEditJobSetupForRole({
      assignedJobIds: Array.from(new Set([...(options.auth.assignedJobIds ?? []), selectedJob.id])),
      jobId: selectedJob.id,
      rawRole: options.auth.rawRole ?? 'none',
    })
  })

  return {
    canCreateJobs,
    canDeleteOrArchiveJobs,
    canEditSelectedJobSetup,
    canUseJobSetupEditor,
  }
}
