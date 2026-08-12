import { onMounted, onUnmounted, watch } from 'vue'
import type { ReadonlyRef } from '@/types/reactivity'

interface UseJobDashboardLifecycleOptions {
  jobId: ReadonlyRef<string>
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

  watch(() => jobId.value, () => {
    subscribeRouteJob()
  })

  onUnmounted(() => {
    stopRouteJobSubscription()
  })
}
