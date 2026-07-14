import { onBeforeUnmount, onMounted } from 'vue'

interface ReadonlyRef<T> {
  readonly value: T
}

type UseDailyLogSubscriptionLifecycleOptions = {
  jobId: ReadonlyRef<string | null>
  startRecipientDefaultsSubscription: () => void
  stopLogsSubscription: () => void
  stopRecipientDefaultsSubscription: () => void
  stopRouteJobSubscription: () => void
  subscribeLogsForSelectedDate: () => void | Promise<void>
  subscribeRouteJob: () => void
}

export function useDailyLogSubscriptionLifecycle({
  jobId,
  startRecipientDefaultsSubscription,
  stopLogsSubscription,
  stopRecipientDefaultsSubscription,
  stopRouteJobSubscription,
  subscribeLogsForSelectedDate,
  subscribeRouteJob,
}: UseDailyLogSubscriptionLifecycleOptions) {
  onMounted(() => {
    startRecipientDefaultsSubscription()

    if (jobId.value) {
      subscribeRouteJob()
      void subscribeLogsForSelectedDate()
    }
  })

  onBeforeUnmount(() => {
    stopLogsSubscription()
    stopRecipientDefaultsSubscription()
    stopRouteJobSubscription()
  })
}
