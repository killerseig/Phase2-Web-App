import { ref } from 'vue'
import type { Router } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

import { ALL_JOBS_ID } from '@/features/jobs/jobViewHelpers'
import { useJobsNavigationActions } from '@/features/jobs/useJobsNavigationActions'
import type { JobRecord } from '@/types/domain'

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

function mountNavigation(options: {
  canCreateJobs?: boolean
  canManageGlobalJobDefaults?: boolean
  canUseJobSetupEditor?: boolean
  editDrawerOpen?: boolean
  selectedJobId?: string | null
} = {}) {
  const canCreateJobs = ref(options.canCreateJobs ?? true)
  const canManageGlobalJobDefaults = ref(options.canManageGlobalJobDefaults ?? true)
  const canUseJobSetupEditor = ref(options.canUseJobSetupEditor ?? true)
  const editDrawerOpen = ref(options.editDrawerOpen ?? false)
  const selectedJobId = ref<string | typeof ALL_JOBS_ID | null>(options.selectedJobId ?? null)
  const resetCreateForm = vi.fn()
  const push = vi.fn(() => Promise.resolve())
  const router = { push } as unknown as Router

  const actions = useJobsNavigationActions({
    editDrawerOpen,
    getCanCreateJobs: () => canCreateJobs.value,
    getCanManageGlobalJobDefaults: () => canManageGlobalJobDefaults.value,
    getCanUseJobSetupEditor: () => canUseJobSetupEditor.value,
    resetCreateForm,
    router,
    selectedJobId,
  })

  return {
    actions,
    canCreateJobs,
    canManageGlobalJobDefaults,
    canUseJobSetupEditor,
    editDrawerOpen,
    push,
    resetCreateForm,
    selectedJobId,
  }
}

describe('useJobsNavigationActions', () => {
  it('opens create mode only for users who can create jobs', () => {
    const manager = mountNavigation()

    manager.actions.openCreateMode()

    expect(manager.editDrawerOpen.value).toBe(true)
    expect(manager.selectedJobId.value).toBe('new')
    expect(manager.resetCreateForm).toHaveBeenCalledTimes(1)

    const fieldUser = mountNavigation({ canCreateJobs: false })

    fieldUser.actions.openCreateMode()

    expect(fieldUser.editDrawerOpen.value).toBe(false)
    expect(fieldUser.selectedJobId.value).toBeNull()
    expect(fieldUser.resetCreateForm).not.toHaveBeenCalled()
  })

  it('opens edit drawer to a provided job or all-jobs defaults', () => {
    const { actions, editDrawerOpen, selectedJobId } = mountNavigation()

    actions.openEditDrawer('job-alpha')

    expect(editDrawerOpen.value).toBe(true)
    expect(selectedJobId.value).toBe('job-alpha')

    selectedJobId.value = null
    actions.openEditDrawer()

    expect(editDrawerOpen.value).toBe(true)
    expect(selectedJobId.value).toBe(ALL_JOBS_ID)
  })

  it('preserves create mode when reopening the edit drawer without a job id', () => {
    const { actions, selectedJobId } = mountNavigation({ selectedJobId: 'new' })

    actions.openEditDrawer()

    expect(selectedJobId.value).toBe('new')
  })

  it('does not open the edit drawer for users who cannot manage jobs', () => {
    const { actions, editDrawerOpen, selectedJobId } = mountNavigation({ canUseJobSetupEditor: false })

    actions.openEditDrawer('job-alpha')

    expect(editDrawerOpen.value).toBe(false)
    expect(selectedJobId.value).toBeNull()
  })

  it('closes the edit drawer without changing selection', () => {
    const { actions, editDrawerOpen, selectedJobId } = mountNavigation({
      editDrawerOpen: true,
      selectedJobId: 'job-alpha',
    })

    actions.closeEditDrawer()

    expect(editDrawerOpen.value).toBe(false)
    expect(selectedJobId.value).toBe('job-alpha')
  })

  it('selects editable jobs in edit mode and routes to dashboards outside edit mode', () => {
    const manager = mountNavigation({ editDrawerOpen: true })

    manager.actions.handleJobPrimaryAction(makeJob({ id: 'job-alpha' }))

    expect(manager.selectedJobId.value).toBe('job-alpha')
    expect(manager.push).not.toHaveBeenCalled()

    const browsingManager = mountNavigation({ editDrawerOpen: false })

    browsingManager.actions.handleJobPrimaryAction(makeJob({ id: 'job-beta' }))

    expect(browsingManager.selectedJobId.value).toBeNull()
    expect(browsingManager.push).toHaveBeenCalledWith('/jobs/job-beta')

    const fieldUser = mountNavigation({ canUseJobSetupEditor: false, editDrawerOpen: true })

    fieldUser.actions.handleJobPrimaryAction(makeJob({ id: 'job-gamma' }))

    expect(fieldUser.selectedJobId.value).toBeNull()
    expect(fieldUser.push).toHaveBeenCalledWith('/jobs/job-gamma')
  })

  it('selects jobs in setup mode even when editability is enforced by the detail pane', () => {
    const projectManager = mountNavigation({
      canCreateJobs: false,
      canManageGlobalJobDefaults: false,
      canUseJobSetupEditor: true,
      editDrawerOpen: true,
    })

    projectManager.actions.handleJobPrimaryAction(makeJob({ id: 'job-unassigned' }))

    expect(projectManager.selectedJobId.value).toBe('job-unassigned')
    expect(projectManager.push).not.toHaveBeenCalled()
  })

  it('opens non-admin setup mode without selecting all-jobs defaults', () => {
    const projectManager = mountNavigation({
      canCreateJobs: false,
      canManageGlobalJobDefaults: false,
      canUseJobSetupEditor: true,
    })

    projectManager.actions.openEditDrawer()

    expect(projectManager.editDrawerOpen.value).toBe(true)
    expect(projectManager.selectedJobId.value).toBeNull()
  })
})
