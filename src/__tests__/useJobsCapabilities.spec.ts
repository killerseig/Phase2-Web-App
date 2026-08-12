import { reactive, ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { useJobsCapabilities, type JobsCapabilitySource } from '@/features/jobs/useJobsCapabilities'
import type { RawRoleKey } from '@/types/domain'

function mountCapabilities(overrides: Partial<JobsCapabilitySource> = {}) {
  const editableJobIds = ref(new Set(['job-editable']))
  const auth = reactive<JobsCapabilitySource>({
    assignedJobIds: [],
    canCreateJobs: true,
    canDeleteOrArchiveJobs: false,
    canEditJobSetup: (jobId: string) => editableJobIds.value.has(jobId),
    canUseJobSetupEditor: true,
    currentUser: { uid: 'user-1' },
    rawRole: 'admin' as RawRoleKey,
    ...overrides,
  })
  const selectedJob = ref<{ assignedForemanIds: string[]; id: string } | null>(null)
  const capabilities = useJobsCapabilities({ auth, selectedJob })

  return {
    auth,
    capabilities,
    editableJobIds,
    selectedJob,
  }
}

describe('useJobsCapabilities', () => {
  it('mirrors route-level job setup capability flags from the auth source', () => {
    const { auth, capabilities } = mountCapabilities()

    expect(capabilities.canCreateJobs.value).toBe(true)
    expect(capabilities.canUseJobSetupEditor.value).toBe(true)
    expect(capabilities.canDeleteOrArchiveJobs.value).toBe(false)

    auth.canCreateJobs = false
    auth.canUseJobSetupEditor = false
    auth.canDeleteOrArchiveJobs = true

    expect(capabilities.canCreateJobs.value).toBe(false)
    expect(capabilities.canUseJobSetupEditor.value).toBe(false)
    expect(capabilities.canDeleteOrArchiveJobs.value).toBe(true)
  })

  it('derives selected-job edit access from the selected job id', () => {
    const { capabilities, editableJobIds, selectedJob } = mountCapabilities()

    expect(capabilities.canEditSelectedJobSetup.value).toBe(false)

    selectedJob.value = { assignedForemanIds: [], id: 'job-readonly' }

    expect(capabilities.canEditSelectedJobSetup.value).toBe(false)

    selectedJob.value = { assignedForemanIds: [], id: 'job-editable' }

    expect(capabilities.canEditSelectedJobSetup.value).toBe(true)

    editableJobIds.value = new Set(['job-other'])

    expect(capabilities.canEditSelectedJobSetup.value).toBe(false)
  })

  it('allows Project Managers to edit when the selected job assigns them even if the profile mirror is stale', () => {
    const { capabilities, selectedJob } = mountCapabilities({
      assignedJobIds: [],
      canEditJobSetup: () => false,
      currentUser: { uid: 'pm-1' },
      rawRole: 'project-manager',
    })

    selectedJob.value = { assignedForemanIds: ['pm-1'], id: 'job-pm' }

    expect(capabilities.canEditSelectedJobSetup.value).toBe(true)
  })
})
