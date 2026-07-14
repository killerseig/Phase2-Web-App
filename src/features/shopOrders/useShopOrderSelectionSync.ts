import { watch, type ComputedRef, type Ref } from 'vue'
import type { ShopOrderRecord } from '@/types/domain'
import type { OrderMetaFormState } from './viewHelpers'

type UseShopOrderSelectionSyncOptions = {
  applySelectedOrderToForm: (order: ShopOrderRecord | null) => void
  clearOrderItemNoteDrafts: () => void
  clearOrderMetaSaveTimer: () => void
  hasSelectedOrderChanged: (
    order: ShopOrderRecord,
    previousOrder: ShopOrderRecord | null,
  ) => boolean
  orderMetaForm: OrderMetaFormState
  orders: Ref<ShopOrderRecord[]>
  queueOrderMetaSave: () => void
  selectedOrder: ComputedRef<ShopOrderRecord | null>
  selectedOrderId: Ref<string | null>
  shouldHydrateSelectedOrder: (
    order: ShopOrderRecord,
    previousOrder: ShopOrderRecord | null,
  ) => boolean
  syncOrderItemNoteDrafts: (order: ShopOrderRecord | null, force?: boolean) => void
}

export function useShopOrderSelectionSync({
  applySelectedOrderToForm,
  clearOrderItemNoteDrafts,
  clearOrderMetaSaveTimer,
  hasSelectedOrderChanged,
  orderMetaForm,
  orders,
  queueOrderMetaSave,
  selectedOrder,
  selectedOrderId,
  shouldHydrateSelectedOrder,
  syncOrderItemNoteDrafts,
}: UseShopOrderSelectionSyncOptions) {
  watch(
    orders,
    (nextOrders) => {
      const selectedStillExists = selectedOrderId.value
        ? nextOrders.some((order) => order.id === selectedOrderId.value)
        : false

      if (selectedStillExists) return

      selectedOrderId.value = nextOrders[0]?.id ?? null
    },
    { immediate: true },
  )

  watch(
    selectedOrder,
    (order, previousOrder) => {
      if (!order) {
        clearOrderMetaSaveTimer()
        clearOrderItemNoteDrafts()
        applySelectedOrderToForm(null)
        return
      }

      if (hasSelectedOrderChanged(order, previousOrder ?? null)) {
        clearOrderMetaSaveTimer()
        clearOrderItemNoteDrafts()
        applySelectedOrderToForm(order)
        syncOrderItemNoteDrafts(order, true)
        return
      }

      syncOrderItemNoteDrafts(order)

      if (shouldHydrateSelectedOrder(order, previousOrder ?? null)) {
        applySelectedOrderToForm(order)
      }
    },
    { immediate: true },
  )

  watch(
    orderMetaForm,
    () => {
      queueOrderMetaSave()
    },
    { deep: true },
  )
}
