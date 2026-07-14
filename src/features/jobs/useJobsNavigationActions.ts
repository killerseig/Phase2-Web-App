import type { Router } from 'vue-router'
import { ALL_JOBS_ID } from '@/features/jobs/jobViewHelpers'
import type { JobRecord } from '@/types/domain'

interface Ref<T> {
  value: T
}

interface UseJobsNavigationActionsOptions {
  editDrawerOpen: Ref<boolean>
  getIsAdmin: () => boolean
  resetCreateForm: () => void
  router: Router
  selectedJobId: Ref<string | 'new' | typeof ALL_JOBS_ID | null>
}

export function useJobsNavigationActions({
  editDrawerOpen,
  getIsAdmin,
  resetCreateForm,
  router,
  selectedJobId,
}: UseJobsNavigationActionsOptions) {
  function openCreateMode() {
    if (!getIsAdmin()) return
    editDrawerOpen.value = true
    selectedJobId.value = 'new'
    resetCreateForm()
  }

  function openEditDrawer(jobId?: string) {
    if (!getIsAdmin()) return

    editDrawerOpen.value = true

    if (jobId) {
      selectedJobId.value = jobId
      return
    }

    if (selectedJobId.value === 'new') return

    selectedJobId.value = ALL_JOBS_ID
  }

  function closeEditDrawer() {
    editDrawerOpen.value = false
  }

  function handleJobPrimaryAction(job: JobRecord) {
    if (getIsAdmin() && editDrawerOpen.value) {
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
