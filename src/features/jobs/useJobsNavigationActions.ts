import type { Router } from 'vue-router'
import { ALL_JOBS_ID } from '@/features/jobs/jobViewHelpers'
import type { JobRecord } from '@/types/domain'
import type { WritableRef } from '@/types/reactivity'

interface UseJobsNavigationActionsOptions {
  editDrawerOpen: WritableRef<boolean>
  getCanCreateJobs: () => boolean
  getCanManageGlobalJobDefaults: () => boolean
  getCanUseJobSetupEditor: () => boolean
  resetCreateForm: () => void
  router: Router
  selectedJobId: WritableRef<string | 'new' | typeof ALL_JOBS_ID | null>
}

export function useJobsNavigationActions({
  editDrawerOpen,
  getCanCreateJobs,
  getCanManageGlobalJobDefaults,
  getCanUseJobSetupEditor,
  resetCreateForm,
  router,
  selectedJobId,
}: UseJobsNavigationActionsOptions) {
  function openCreateMode() {
    if (!getCanCreateJobs()) return
    editDrawerOpen.value = true
    selectedJobId.value = 'new'
    resetCreateForm()
  }

  function openEditDrawer(jobId?: string) {
    if (!getCanUseJobSetupEditor()) return

    editDrawerOpen.value = true

    if (jobId) {
      selectedJobId.value = jobId
      return
    }

    if (selectedJobId.value === 'new') return

    selectedJobId.value = getCanManageGlobalJobDefaults() ? ALL_JOBS_ID : null
  }

  function closeEditDrawer() {
    editDrawerOpen.value = false
  }

  function handleJobPrimaryAction(job: JobRecord) {
    if (getCanUseJobSetupEditor() && editDrawerOpen.value) {
      selectedJobId.value = job.id
      return
    }

    void router.push(`/jobs/${job.id}`)
  }

  return {
    closeEditDrawer,
    handleJobPrimaryAction,
    openCreateMode,
    openEditDrawer,
  }
}
