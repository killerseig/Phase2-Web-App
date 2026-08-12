import { ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { ALL_JOBS_ID } from '@/features/jobs/jobViewHelpers'
import { useJobsViewState } from '@/features/jobs/useJobsViewState'
import type { JobRecord, UserProfile } from '@/types/domain'
import type { DirectoryStatusFilter } from '@/utils/directoryFilters'

function makeJob(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    active: true,
    assignedForemanIds: [],
    code: '100',
    finishDate: null,
    gc: 'Phase 2',
    id: 'job-100',
    jobAddress: '100 Main St',
    name: 'Alpha Job',
    productionBurden: 0.33,
    startDate: null,
    type: 'general',
    ...overrides,
  }
}

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    active: true,
    assignedJobIds: [],
    email: 'foreman@example.com',
    firstName: 'Field',
    id: 'user-1',
    lastName: 'User',
    role: 'foreman',
    ...overrides,
  }
}

function mountState(options: {
  canCreateJobs?: boolean
  canManageJobs?: boolean
  canUseJobSetupEditor?: boolean
  editDrawerOpen?: boolean
  foremanSearchTerm?: string
  jobStatusFilter?: DirectoryStatusFilter
  searchTerm?: string
  selectedJobId?: string | null
} = {}) {
  const alphaJob = makeJob({ id: 'job-alpha', name: 'Alpha Office', code: 'A-1', gc: 'Hillside', type: 'paint' })
  const activeJobs = ref<JobRecord[]>([alphaJob])
  const allJobs = ref([
    alphaJob,
    makeJob({
      active: false,
      code: 'B-2',
      gc: 'Acme',
      id: 'job-beta',
      jobAddress: '200 Drywall Way',
      name: 'Beta Renovation',
      type: 'drywall',
    }),
    makeJob({
      active: true,
      code: 'C-3',
      gc: 'Hillside',
      id: 'job-custom',
      name: 'Custom Tenant Finish',
      type: 'tenant-finish',
    }),
  ])
  const editDrawerOpen = ref(options.editDrawerOpen ?? false)
  const foremanSearchTerm = ref(options.foremanSearchTerm ?? '')
  const jobStatusFilter = ref<DirectoryStatusFilter>(options.jobStatusFilter ?? 'both')
  const searchTerm = ref(options.searchTerm ?? '')
  const selectedJobId = ref<string | null>(options.selectedJobId ?? null)
  const users = ref([
    makeUser({ firstName: 'Zara', id: 'foreman-zara', lastName: 'Active' }),
    makeUser({ active: false, firstName: 'Aaron', id: 'foreman-aaron', lastName: 'Inactive' }),
    makeUser({ firstName: 'Chris', id: 'pm-chris', lastName: 'Manager', role: 'project-manager' }),
    makeUser({ firstName: 'CJ', id: 'shop-cj', lastName: 'Blanchard', role: 'shop-foreman' }),
    makeUser({ firstName: 'Admin', id: 'admin-user', lastName: 'Person', role: 'admin' }),
  ])
  const canManageJobs = ref(options.canManageJobs ?? true)
  const canCreateJobs = ref(options.canCreateJobs ?? true)
  const canUseJobSetupEditor = ref(options.canUseJobSetupEditor ?? true)

  const state = useJobsViewState({
    activeJobs,
    allJobs,
    editDrawerOpen,
    foremanSearchTerm,
    getCanCreateJobs: () => canCreateJobs.value,
    getCanManageJobs: () => canManageJobs.value,
    getCanUseJobSetupEditor: () => canUseJobSetupEditor.value,
    jobStatusFilter,
    searchTerm,
    selectedJobId,
    users,
  })

  return {
    activeJobs,
    allJobs,
    canCreateJobs,
    canManageJobs,
    canUseJobSetupEditor,
    editDrawerOpen,
    foremanSearchTerm,
    jobStatusFilter,
    searchTerm,
    selectedJobId,
    state,
    users,
  }
}

describe('useJobsViewState', () => {
  it('derives manageable job visibility from all jobs, status filters, and search text', () => {
    const { jobStatusFilter, searchTerm, state } = mountState({
      canManageJobs: true,
      jobStatusFilter: 'active',
    })

    expect(state.visibleJobs.value.map((job) => job.id)).toEqual(['job-alpha', 'job-custom'])

    searchTerm.value = 'drywall'

    expect(state.visibleJobs.value).toEqual([])

    jobStatusFilter.value = 'both'

    expect(state.visibleJobs.value.map((job) => job.id)).toEqual(['job-beta'])
  })

  it('limits non-managers to active jobs and ignores the admin status filter', () => {
    const { jobStatusFilter, searchTerm, state } = mountState({
      canManageJobs: false,
      jobStatusFilter: 'inactive',
    })

    expect(state.visibleJobs.value.map((job) => job.id)).toEqual(['job-alpha'])

    searchTerm.value = 'beta'
    expect(state.visibleJobs.value).toEqual([])

    jobStatusFilter.value = 'both'
    expect(state.visibleJobs.value).toEqual([])
  })

  it('derives selected job, create mode, all-jobs mode, and all-jobs entry visibility', () => {
    const { editDrawerOpen, selectedJobId, state } = mountState({
      editDrawerOpen: true,
      selectedJobId: 'job-beta',
    })

    expect(state.selectedJob.value?.id).toBe('job-beta')
    expect(state.isCreateMode.value).toBe(false)
    expect(state.isAllJobsMode.value).toBe(false)
    expect(state.showAllJobsEntry.value).toBe(true)

    selectedJobId.value = 'new'
    expect(state.selectedJob.value).toBeNull()
    expect(state.isCreateMode.value).toBe(true)

    selectedJobId.value = ALL_JOBS_ID
    expect(state.isAllJobsMode.value).toBe(true)

    editDrawerOpen.value = false
    expect(state.showAllJobsEntry.value).toBe(false)
  })

  it('allows create mode without exposing all-jobs defaults for non-admin creators', () => {
    const { state } = mountState({
      canCreateJobs: true,
      canManageJobs: false,
      canUseJobSetupEditor: true,
      editDrawerOpen: true,
      selectedJobId: 'new',
    })

    expect(state.isCreateMode.value).toBe(true)
    expect(state.isAllJobsMode.value).toBe(false)
    expect(state.showAllJobsEntry.value).toBe(false)
  })

  it('derives status counts, job type options, and GC suggestions from all jobs', () => {
    const { state } = mountState()

    expect(state.activeJobCount.value).toBe(2)
    expect(state.archivedJobCount.value).toBe(1)
    expect(state.jobTypeOptions.value).toEqual(expect.arrayContaining(['general', 'paint', 'drywall', 'tenant-finish']))
    expect(state.gcSuggestions.value).toEqual(['Acme', 'Hillside'])
  })

  it('builds and filters field-user options with active assignable target roles first', () => {
    const { foremanSearchTerm, state } = mountState()

    expect(state.filteredForemen.value.map((user) => user.id)).toEqual([
      'pm-chris',
      'shop-cj',
      'foreman-zara',
      'foreman-aaron',
    ])

    foremanSearchTerm.value = 'inactive'
    expect(state.filteredForemen.value.map((user) => user.id)).toEqual(['foreman-aaron'])

    foremanSearchTerm.value = 'chris'
    expect(state.filteredForemen.value.map((user) => user.id)).toEqual(['pm-chris'])
  })
})
