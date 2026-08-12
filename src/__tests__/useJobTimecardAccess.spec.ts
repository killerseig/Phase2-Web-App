import { ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { useJobTimecardAccess } from '@/features/timecards/useJobTimecardAccess'
import type { JobRecord, RawRoleKey } from '@/types/domain'

function makeJob(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    active: true,
    assignedForemanIds: [],
    code: '1A',
    finishDate: null,
    gc: 'General',
    id: 'job-alpha',
    jobAddress: '',
    name: 'Alpha Job',
    productionBurden: 0.33,
    startDate: null,
    type: 'general',
    ...overrides,
  }
}

interface MountOptions {
  assignedJobIds?: string[]
  canManageJobTimecards?: boolean
  currentUserId?: string | null
  job?: JobRecord | null
  jobId?: string
  rawRole?: RawRoleKey
}

function mountAccess(options: MountOptions = {}) {
  const assignedJobIds = ref(options.assignedJobIds ?? [])
  const canManageJobTimecards = ref(options.canManageJobTimecards ?? false)
  const currentUserId = ref<string | null>(options.currentUserId === undefined ? 'user-1' : options.currentUserId)
  const job = ref<JobRecord | null>(options.job === undefined ? makeJob() : options.job)
  const jobId = ref(options.jobId ?? job.value?.id ?? '')
  const rawRole = ref<RawRoleKey>(options.rawRole ?? 'foreman')

  const access = useJobTimecardAccess({
    getAssignedJobIds: () => assignedJobIds.value,
    getCanManageJobTimecards: () => canManageJobTimecards.value,
    getCurrentUserId: () => currentUserId.value,
    getRawRole: () => rawRole.value,
    job,
    jobId,
  })

  return {
    access,
    assignedJobIds,
    canManageJobTimecards,
    currentUserId,
    job,
    jobId,
    rawRole,
  }
}

describe('useJobTimecardAccess', () => {
  it('adds the current job to assigned ids when the job record assigns the current user', () => {
    const { access, currentUserId } = mountAccess({
      assignedJobIds: [],
      job: makeJob({ assignedForemanIds: ['user-1'] }),
      rawRole: 'foreman',
    })

    expect(access.timecardAssignedJobIds.value).toEqual(['job-alpha'])
    expect(access.canUseJobTimecardWorkflow.value).toBe(true)
    expect(access.weekSubscriptionMode.value).toBe('all')

    currentUserId.value = 'user-2'

    expect(access.timecardAssignedJobIds.value).toEqual([])
  })

  it('keeps assigned Project Managers in submitted-report mode without edit workflow access', () => {
    const { access, assignedJobIds } = mountAccess({
      assignedJobIds: ['job-alpha'],
      rawRole: 'project-manager',
    })

    expect(access.canUseJobTimecardWorkflow.value).toBe(false)
    expect(access.canViewSubmittedTimecardReport.value).toBe(true)
    expect(access.weekSubscriptionMode.value).toBe('submitted-report')

    assignedJobIds.value = []

    expect(access.canViewSubmittedTimecardReport.value).toBe(false)
    expect(access.weekSubscriptionMode.value).toBe('current-user')
  })

  it('uses all-week subscription mode for timecard managers', () => {
    const { access, canManageJobTimecards } = mountAccess({
      canManageJobTimecards: true,
      rawRole: 'admin',
    })

    expect(access.canUseJobTimecardWorkflow.value).toBe(true)
    expect(access.canViewSubmittedTimecardReport.value).toBe(true)
    expect(access.weekSubscriptionMode.value).toBe('all')

    canManageJobTimecards.value = false

    expect(access.weekSubscriptionMode.value).toBe('all')
  })

  it('allows Shop Foremen to use the Shop job workflow without explicit assignment', () => {
    const { access } = mountAccess({
      assignedJobIds: [],
      job: makeJob({
        code: '736',
        id: 'job-shop',
        name: 'Shop',
      }),
      jobId: 'job-shop',
      rawRole: 'shop-foreman',
    })

    expect(access.isCurrentJobShopJob.value).toBe(true)
    expect(access.canUseJobTimecardWorkflow.value).toBe(true)
    expect(access.canViewSubmittedTimecardReport.value).toBe(false)
    expect(access.weekSubscriptionMode.value).toBe('all')
  })

  it('recognizes legacy numeric Shop job numbers in timecard access checks', () => {
    const { access } = mountAccess({
      assignedJobIds: [],
      job: {
        ...makeJob({
          id: 'job-shop',
          name: 'Warehouse',
        }),
        number: 736,
      } as JobRecord,
      jobId: 'job-shop',
      rawRole: 'shop-foreman',
    })

    expect(access.isCurrentJobShopJob.value).toBe(true)
    expect(access.canUseJobTimecardWorkflow.value).toBe(true)
  })
})
