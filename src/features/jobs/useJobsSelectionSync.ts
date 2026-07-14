import { watch } from 'vue'
import {
  ALL_JOBS_ID,
  resolveJobsViewSelectionAfterVisibleJobsChange,
} from '@/features/jobs/jobViewHelpers'
import type { JobRecord } from '@/types/domain'

interface Ref<T> {
  value: T
}

interface ReadonlyRef<T> {
  readonly value: T
}

interface UseJobsSelectionSyncOptions {
  applySelectedJobToForm: (job: JobRecord | null) => void
  clearDetailAutosaveTimer: () => void
  editDrawerOpen: Ref<boolean>
  getIsAdmin: () => boolean
  selectedJob: ReadonlyRef<JobRecord | null>
  selectedJobId: Ref<string | 'new' | typeof ALL_JOBS_ID | null>
  shouldHydrateSelectedJob: (job: JobRecord, previousJob: JobRecord | null) => boolean
  visibleJobs: ReadonlyRef<JobRecord[]>
}

export function useJobsSelectionSync({
  applySelectedJobToForm,
  clearDetailAutosaveTimer,
  editDrawerOpen,
  getIsAdmin,
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
        isAdmin: getIsAdmin(),
        selectedJobId: selectedJobId.value,
        nextJobs,
        editDrawerOpen: editDrawerOpen.value,
      })
      if (nextSelection !== undefined) selectedJobId.value = nextSelection
    },
    { immediate: true },
  )

  watch(editDrawerOpen, (isOpen) => {
    if (!getIsAdmin()) return

    if (isOpen && !selectedJobId.value) {
      selectedJobId.value = ALL_JOBS_ID
    }

    if (!isOpen) {
      clearDetailAutosaveTimer()
    }
  })
}
