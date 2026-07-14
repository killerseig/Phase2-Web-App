import { onBeforeUnmount, onMounted } from 'vue'

interface UseJobsLifecycleOptions {
  clearDetailAutosaveTimer: () => void
  startAdminSubscriptions: () => void
  startJobsSubscription: () => void
  stopAdminSubscriptions: () => void
  stopJobsSubscription: () => void
}

export function useJobsLifecycle({
  clearDetailAutosaveTimer,
  startAdminSubscriptions,
  startJobsSubscription,
  stopAdminSubscriptions,
  stopJobsSubscription,
}: UseJobsLifecycleOptions) {
  onMounted(() => {
    startJobsSubscription()
    startAdminSubscriptions()
  })

  onBeforeUnmount(() => {
    clearDetailAutosaveTimer()
    stopJobsSubscription()
    stopAdminSubscriptions()
  })
}
