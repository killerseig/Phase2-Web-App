import { computed, ref, type ComputedRef } from 'vue'
import { getRemoveShopOrderItemConfirmMessage } from '@/features/shopOrders/viewHelpers'
import type { ShopOrderRecord } from '@/types/domain'

interface UseShopOrderConfirmDialogsOptions {
  selectedOrder: ComputedRef<ShopOrderRecord | null>
}

export function useShopOrderConfirmDialogs({
  selectedOrder,
}: UseShopOrderConfirmDialogsOptions) {
  const deleteDraftConfirmOpen = ref(false)
  const removeItemConfirmOpen = ref(false)
  const removeItemTargetId = ref<string | null>(null)
  const submitConfirmOpen = ref(false)

  const removeItemTarget = computed(() =>
    selectedOrder.value?.items.find((item) => item.id === removeItemTargetId.value) ?? null,
  )

  const removeItemConfirmMessage = computed(() =>
    getRemoveShopOrderItemConfirmMessage(removeItemTarget.value),
  )

  function requestRemoveOrderItem(orderItemId: string) {
    if (!selectedOrder.value || selectedOrder.value.status !== 'draft') return

    const targetItem = selectedOrder.value.items.find((item) => item.id === orderItemId)
    if (!targetItem) return

    removeItemTargetId.value = orderItemId
    removeItemConfirmOpen.value = true
  }

  function closeRemoveItemConfirm() {
    removeItemConfirmOpen.value = false
    removeItemTargetId.value = null
  }

  function requestDeleteDraftOrder() {
    if (!selectedOrder.value || selectedOrder.value.status !== 'draft') return

    deleteDraftConfirmOpen.value = true
  }

  function closeDeleteDraftConfirm() {
    deleteDraftConfirmOpen.value = false
  }

  function openSubmitConfirm() {
    submitConfirmOpen.value = true
  }

  function closeSubmitConfirm() {
    submitConfirmOpen.value = false
  }

  return {
    closeDeleteDraftConfirm,
    closeRemoveItemConfirm,
    closeSubmitConfirm,
    deleteDraftConfirmOpen,
    openSubmitConfirm,
    removeItemConfirmMessage,
    removeItemConfirmOpen,
    removeItemTargetId,
    requestDeleteDraftOrder,
    requestRemoveOrderItem,
    submitConfirmOpen,
  }
}
