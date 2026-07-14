import type { ComputedRef } from 'vue'
import { useSubscribedRecords } from '@/composables/useSubscribedRecords'
import { subscribeShopOrders } from '@/services/shopOrders'
import type { ShopOrderRecord } from '@/types/domain'

interface UseShopOrderRecordsOptions {
  jobId: ComputedRef<string>
}

export function useShopOrderRecords({ jobId }: UseShopOrderRecordsOptions) {
  function subscribeCurrentJobShopOrders(
    onUpdate: (records: ShopOrderRecord[]) => void,
    onError?: (error: unknown) => void,
  ) {
    if (!jobId.value) return () => {}
    return subscribeShopOrders(jobId.value, onUpdate, onError)
  }

  const {
    error: ordersError,
    loading: ordersLoading,
    records: orders,
    start: startOrdersSubscription,
    stop: stopOrdersSubscription,
  } = useSubscribedRecords<ShopOrderRecord>(subscribeCurrentJobShopOrders, {
    errorMessage: 'Failed to load shop orders.',
  })

  return {
    orders,
    ordersError,
    ordersLoading,
    startOrdersSubscription,
    stopOrdersSubscription,
  }
}
