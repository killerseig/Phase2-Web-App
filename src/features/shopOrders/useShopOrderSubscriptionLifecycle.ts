import { onBeforeUnmount, onMounted, watch } from 'vue'

interface ReadonlyRef<T> {
  readonly value: T
}

type UseShopOrderSubscriptionLifecycleOptions = {
  clearOrderItemNoteDrafts: () => void
  clearOrderMetaSaveTimer: () => void
  jobId: ReadonlyRef<string | null>
  startOrdersSubscription: () => void
  stopCatalogRecords: () => void
  stopOrdersSubscription: () => void
  stopRouteJobSubscription: () => void
  subscribeCatalogRecords: () => void
  subscribeRouteJob: () => void
}

export function useShopOrderSubscriptionLifecycle({
  clearOrderItemNoteDrafts,
  clearOrderMetaSaveTimer,
  jobId,
  startOrdersSubscription,
  stopCatalogRecords,
  stopOrdersSubscription,
  stopRouteJobSubscription,
  subscribeCatalogRecords,
  subscribeRouteJob,
}: UseShopOrderSubscriptionLifecycleOptions) {
  function subscribeOrders() {
    if (!jobId.value) return
    startOrdersSubscription()
  }

  watch(
    () => jobId.value,
    (nextJobId, previousJobId) => {
      if (!nextJobId || nextJobId === previousJobId) return
      clearOrderMetaSaveTimer()
      clearOrderItemNoteDrafts()
      subscribeRouteJob()
      subscribeCatalogRecords()
      subscribeOrders()
    },
  )

  onMounted(() => {
    subscribeRouteJob()
    subscribeCatalogRecords()
    subscribeOrders()
  })

  onBeforeUnmount(() => {
    clearOrderMetaSaveTimer()
    clearOrderItemNoteDrafts()
    stopCatalogRecords()
    stopOrdersSubscription()
    stopRouteJobSubscription()
  })
}
