import { watch } from 'vue'
import type { ShopOrderRecord } from '@/types/domain'
import type { ReadonlyRef, WritableRef } from '@/types/reactivity'
import { getNextShopOrderSelectionId, type OrderMetaFormState } from './viewHelpers'

type UseShopOrderSelectionSyncOptions = {
  applySelectedOrderToForm: (order: ShopOrderRecord | null) => void
  clearOrderItemNoteDrafts: () => void
  clearOrderMetaSaveTimer: () => void
  ensureFreshDraftDeliveryDate: (order: ShopOrderRecord | null) => boolean
  hasSelectedOrderChanged: (
    order: ShopOrderRecord,
    previousOrder: ShopOrderRecord | null,
  ) => boolean
  orderMetaForm: OrderMetaFormState
  orders: WritableRef<ShopOrderRecord[]>
  queueOrderMetaSave: () => void
  selectedOrder: ReadonlyRef<ShopOrderRecord | null>
  selectedOrderId: WritableRef<string | null>
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
  ensureFreshDraftDeliveryDate,
  hasSelectedOrderChanged,
  orderMetaForm,
  orders,
  queueOrderMetaSave,
  selectedOrder,
  selectedOrderId,
  shouldHydrateSelectedOrder,
  syncOrderItemNoteDrafts,
}: UseShopOrderSelectionSyncOptions) {
  function selectOrder(orderId: string) {
    selectedOrderId.value = orderId
  }

  watch(
    () => orders.value,
    (nextOrders) => {
      selectedOrderId.value = getNextShopOrderSelectionId(nextOrders, selectedOrderId.value)
    },
    { immediate: true },
  )

  watch(
    () => selectedOrder.value,
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
        if (ensureFreshDraftDeliveryDate(order)) {
          queueOrderMetaSave()
        }
        syncOrderItemNoteDrafts(order, true)
        return
      }

      syncOrderItemNoteDrafts(order)

      if (shouldHydrateSelectedOrder(order, previousOrder ?? null)) {
        applySelectedOrderToForm(order)
        if (ensureFreshDraftDeliveryDate(order)) {
          queueOrderMetaSave()
        }
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

  return {
    selectOrder,
  }
}
