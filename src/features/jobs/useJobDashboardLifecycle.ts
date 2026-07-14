import { onMounted, onUnmounted, watch, type ComputedRef } from 'vue'

interface UseJobDashboardLifecycleOptions {
  jobId: ComputedRef<string>
  subscribeRouteJob: () => void
  stopRouteJobSubscription: () => void
}

export function useJobDashboardLifecycle({
  jobId,
  subscribeRouteJob,
  stopRouteJobSubscription,
}: UseJobDashboardLifecycleOptions) {
  onMounted(() => {
    subscribeRouteJob()
  })

  watch(jobId, () => {
    subscribeRouteJob()
  })

  onUnmounted(() => {
    stopRouteJobSubscription()
  })
}
