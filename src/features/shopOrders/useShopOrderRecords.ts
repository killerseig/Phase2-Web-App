import { useSubscribedRecords } from '@/composables/useSubscribedRecords'
import { subscribeShopOrders } from '@/services/shopOrders'
import type { ShopOrderRecord } from '@/types/domain'
import type { ReadonlyRef } from '@/types/reactivity'
import { replaceRecordById } from '@/utils/optimisticRecords'

interface UseShopOrderRecordsOptions {
  jobId: ReadonlyRef<string>
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

  function replaceOrderLocally(order: ShopOrderRecord) {
    orders.value = replaceRecordById(orders.value, order)
  }

  return {
    orders,
    ordersError,
    ordersLoading,
    replaceOrderLocally,
    startOrdersSubscription,
    stopOrdersSubscription,
  }
}
