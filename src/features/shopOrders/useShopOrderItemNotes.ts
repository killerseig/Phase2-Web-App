import { reactive, type ComputedRef } from 'vue'
import {
  clearShopOrderItemNoteDraftState,
  clearShopOrderItemNoteSaveTimer,
  normalizeOrderItemNoteValue,
  syncShopOrderItemNoteDraftState,
  type ShopOrderItemNoteDraftState,
} from '@/features/shopOrders/viewHelpers'
import type { ShopOrderItemRecord, ShopOrderRecord } from '@/types/domain'

interface UseShopOrderItemNotesOptions {
  cloneOrderItems: (order?: ShopOrderRecord | null) => ShopOrderItemRecord[]
  persistOrderItems: (
    orderId: string,
    nextItems: ShopOrderItemRecord[],
    successMessage: string,
  ) => Promise<boolean>
  selectedOrder: ComputedRef<ShopOrderRecord | null>
}

export function useShopOrderItemNotes({
  cloneOrderItems,
  persistOrderItems,
  selectedOrder,
}: UseShopOrderItemNotesOptions) {
  const orderItemNoteDrafts = reactive<Record<string, string>>({})
  const savingOrderItemNoteIds = reactive<Record<string, boolean>>({})
  const queuedOrderItemNoteSaveIds = reactive<Record<string, boolean>>({})
  const orderItemNoteSaveTimers = new Map<string, ReturnType<typeof setTimeout>>()

  const orderItemNoteDraftState: ShopOrderItemNoteDraftState = {
    noteDrafts: orderItemNoteDrafts,
    savingIds: savingOrderItemNoteIds,
    queuedSaveIds: queuedOrderItemNoteSaveIds,
    saveTimers: orderItemNoteSaveTimers,
  }

  function clearOrderItemNoteTimer(orderItemId: string) {
    clearShopOrderItemNoteSaveTimer(orderItemNoteSaveTimers, orderItemId)
  }

  function clearOrderItemNoteDrafts() {
    clearShopOrderItemNoteDraftState(orderItemNoteDraftState)
  }

  function syncOrderItemNoteDrafts(order: ShopOrderRecord | null, force = false) {
    syncShopOrderItemNoteDraftState(order, orderItemNoteDraftState, force)
  }

  function queueOrderItemNoteSave(orderItemId: string) {
    if (!selectedOrder.value || selectedOrder.value.status !== 'draft') return

    const selectedItem = selectedOrder.value.items.find((item) => item.id === orderItemId)
    if (!selectedItem) return

    const draftValue = orderItemNoteDrafts[orderItemId] ?? selectedItem.note ?? ''
    if (normalizeOrderItemNoteValue(draftValue) === normalizeOrderItemNoteValue(selectedItem.note)) {
      clearOrderItemNoteTimer(orderItemId)
      return
    }

    clearOrderItemNoteTimer(orderItemId)
    orderItemNoteSaveTimers.set(orderItemId, setTimeout(() => {
      void saveOrderItemNote(orderItemId)
    }, 700))
  }

  async function saveOrderItemNote(orderItemId: string) {
    if (!selectedOrder.value || selectedOrder.value.status !== 'draft') return

    const selectedItem = selectedOrder.value.items.find((item) => item.id === orderItemId)
    if (!selectedItem) return

    const draftValue = orderItemNoteDrafts[orderItemId] ?? selectedItem.note ?? ''
    if (normalizeOrderItemNoteValue(draftValue) === normalizeOrderItemNoteValue(selectedItem.note)) {
      clearOrderItemNoteTimer(orderItemId)
      return
    }

    if (savingOrderItemNoteIds[orderItemId]) {
      queuedOrderItemNoteSaveIds[orderItemId] = true
      return
    }

    clearOrderItemNoteTimer(orderItemId)

    const nextItems = cloneOrderItems(selectedOrder.value)
    const targetItem = nextItems.find((item) => item.id === orderItemId)
    if (!targetItem) return

    targetItem.note = draftValue
    savingOrderItemNoteIds[orderItemId] = true

    try {
      await persistOrderItems(selectedOrder.value.id, nextItems, 'Order note updated.')
    } finally {
      delete savingOrderItemNoteIds[orderItemId]
    }

    if (queuedOrderItemNoteSaveIds[orderItemId]) {
      delete queuedOrderItemNoteSaveIds[orderItemId]
      await saveOrderItemNote(orderItemId)
    }
  }

  function handleOrderItemNoteInput(orderItemId: string, rawValue: string) {
    if (!selectedOrder.value || selectedOrder.value.status !== 'draft') return

    orderItemNoteDrafts[orderItemId] = rawValue
    queueOrderItemNoteSave(orderItemId)
  }

  async function handleOrderItemNoteBlur(orderItemId: string) {
    clearOrderItemNoteTimer(orderItemId)
    await saveOrderItemNote(orderItemId)
  }

  return {
    clearOrderItemNoteDrafts,
    handleOrderItemNoteBlur,
    handleOrderItemNoteInput,
    orderItemNoteDrafts,
    syncOrderItemNoteDrafts,
  }
}
