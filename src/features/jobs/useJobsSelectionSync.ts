import { watch } from 'vue'
import {
  ALL_JOBS_ID,
  resolveJobsViewSelectionAfterVisibleJobsChange,
} from '@/features/jobs/jobViewHelpers'
import type { JobRecord } from '@/types/domain'
import type { ReadonlyRef, WritableRef } from '@/types/reactivity'

interface UseJobsSelectionSyncOptions {
  applySelectedJobToForm: (job: JobRecord | null) => void
  clearDetailAutosaveTimer: () => void
  editDrawerOpen: WritableRef<boolean>
  getCanManageGlobalJobDefaults: () => boolean
  getCanUseJobSetupEditor: () => boolean
  selectedJob: ReadonlyRef<JobRecord | null>
  selectedJobId: WritableRef<string | 'new' | typeof ALL_JOBS_ID | null>
  shouldHydrateSelectedJob: (job: JobRecord, previousJob: JobRecord | null) => boolean
  visibleJobs: ReadonlyRef<JobRecord[]>
}

export function useJobsSelectionSync({
  applySelectedJobToForm,
  clearDetailAutosaveTimer,
  editDrawerOpen,
  getCanManageGlobalJobDefaults,
  getCanUseJobSetupEditor,
  selectedJob,
  selectedJobId,
  shouldHydrateSelectedJob,
  visibleJobs,
}: UseJobsSelectionSyncOptions) {
  watch(
    () => selectedJob.value,
    (job, previousJob) => {
      if (!job) {
        clearDetailAutosaveTimer()
        applySelectedJobToForm(null)
        return
      }

      if (shouldHydrateSelectedJob(job, previousJob ?? null)) {
        clearDetailAutosaveTimer()
        applySelectedJobToForm(job)
      }
    },
    { immediate: true },
  )

  watch(
    () => visibleJobs.value,
    (nextJobs) => {
      const nextSelection = resolveJobsViewSelectionAfterVisibleJobsChange({
        canManageGlobalJobDefaults: getCanManageGlobalJobDefaults(),
        canUseJobSetupEditor: getCanUseJobSetupEditor(),
        selectedJobId: selectedJobId.value,
        nextJobs,
        editDrawerOpen: editDrawerOpen.value,
      })
      if (nextSelection !== undefined) selectedJobId.value = nextSelection
    },
    { immediate: true },
  )

  watch(editDrawerOpen, (isOpen) => {
    if (!getCanUseJobSetupEditor()) return

    if (isOpen && !selectedJobId.value && getCanManageGlobalJobDefaults()) {
      selectedJobId.value = ALL_JOBS_ID
    }

    if (!isOpen) {
      clearDetailAutosaveTimer()
    }
  })
}
