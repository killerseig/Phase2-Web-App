import { watch } from 'vue'

interface UseJobsSideEffectsOptions {
  detailForm: object
  getJobsError: () => string | null
  queueDetailAutosave: () => void
  showJobsError: (message: string) => void
}

export function useJobsSideEffects({
  detailForm,
  getJobsError,
  queueDetailAutosave,
  showJobsError,
}: UseJobsSideEffectsOptions) {
  watch(
    detailForm,
    () => {
      queueDetailAutosave()
    },
    { deep: true },
  )

  watch(
    getJobsError,
    (message, previous) => {
      if (!message || message === previous) return
      showJobsError(message)
    },
  )
}
