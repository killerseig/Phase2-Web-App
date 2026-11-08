import { computed, getCurrentScope, onScopeDispose, reactive, watch } from 'vue'
import {
  clearShopOrderItemNoteDraftState,
  clearShopOrderItemNoteSaveTimer,
  normalizeOrderItemNoteValue,
  syncShopOrderItemNoteDraftState,
  type ShopOrderItemNoteDraftState,
} from '@/features/shopOrders/viewHelpers'
import type { ShopOrderItemRecord, ShopOrderRecord } from '@/types/domain'
import type { ReadonlyRef } from '@/types/reactivity'

interface UseShopOrderItemNotesOptions {
  cloneOrderItems: (order?: ShopOrderRecord | null) => ShopOrderItemRecord[]
  persistOrderItems: (
    orderId: string,
    nextItems: ShopOrderItemRecord[],
    successMessage: string,
  ) => Promise<boolean>
  selectedOrder: ReadonlyRef<ShopOrderRecord | null>
  getContextEpoch?: () => number
}

export function useShopOrderItemNotes({
  cloneOrderItems,
  persistOrderItems,
  selectedOrder,
  getContextEpoch,
}: UseShopOrderItemNotesOptions) {
  const orderItemNoteDrafts = reactive<Record<string, string>>({})
  const savingOrderItemNoteIds = reactive<Record<string, boolean>>({})
  const queuedOrderItemNoteSaveIds = reactive<Record<string, boolean>>({})
  const orderItemNoteSaveTimers = new Map<string, ReturnType<typeof setTimeout>>()
  const noteSaves = new Map<string, Promise<boolean>>()
  let contextVersion = 0
  let disposed = false
  watch([() => selectedOrder.value?.id, () => getContextEpoch?.()], () => {
    contextVersion += 1
    for (const id of orderItemNoteSaveTimers.keys()) clearOrderItemNoteTimer(id)
  }, { flush: 'sync' })
  if (getCurrentScope()) onScopeDispose(() => { disposed = true; clearOrderItemNoteDrafts() })
  const hasUnsavedOrderItemNotes = computed(() => selectedOrder.value?.status === 'draft' &&
    selectedOrder.value.items.some(item => normalizeOrderItemNoteValue(orderItemNoteDrafts[item.id] ?? item.note) !== normalizeOrderItemNoteValue(item.note)))

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
    contextVersion += 1
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

  async function saveOrderItemNote(orderItemId: string): Promise<boolean> {
    if (disposed) return false
    const running = noteSaves.get(orderItemId)
    if (running) {
      queuedOrderItemNoteSaveIds[orderItemId] = true
      return running
    }
    if (!selectedOrder.value || selectedOrder.value.status !== 'draft') return true

    const selectedItem = selectedOrder.value.items.find((item) => item.id === orderItemId)
    if (!selectedItem) return true

    const draftValue = orderItemNoteDrafts[orderItemId] ?? selectedItem.note ?? ''
    if (normalizeOrderItemNoteValue(draftValue) === normalizeOrderItemNoteValue(selectedItem.note)) {
      clearOrderItemNoteTimer(orderItemId)
      return true
    }

    clearOrderItemNoteTimer(orderItemId)
    const orderId = selectedOrder.value.id
    const version = contextVersion
    savingOrderItemNoteIds[orderItemId] = true
    const isCurrent = () => !disposed && selectedOrder.value?.id === orderId && contextVersion === version
    const saving = (async () => {
      let value = draftValue
      do {
        clearOrderItemNoteTimer(orderItemId)
        delete queuedOrderItemNoteSaveIds[orderItemId]
        const nextItems = cloneOrderItems(selectedOrder.value)
        const targetItem = nextItems.find(item => item.id === orderItemId)
        if (!targetItem) return false
        targetItem.note = value
        if (!await persistOrderItems(orderId, nextItems, 'Order note updated.')) return false
        if (!isCurrent()) return false
        const nextValue = orderItemNoteDrafts[orderItemId] ?? value
        if (normalizeOrderItemNoteValue(nextValue) === normalizeOrderItemNoteValue(value)) return true
        value = nextValue
      } while (isCurrent())
      return false
    })()
    noteSaves.set(orderItemId, saving)
    try { return await saving } finally {
      if (noteSaves.get(orderItemId) === saving) noteSaves.delete(orderItemId)
      if (isCurrent()) {
        delete savingOrderItemNoteIds[orderItemId]
        delete queuedOrderItemNoteSaveIds[orderItemId]
      }
    }
  }

  async function prepareOrderItemNoteNavigation() {
    const orderId = selectedOrder.value?.id
    const version = contextVersion
    const isCurrent = () => !disposed && selectedOrder.value?.id === orderId && contextVersion === version
    while (isCurrent() && noteSaves.size) {
      if ((await Promise.all(noteSaves.values())).some(saved => !saved)) return false
    }
    for (const item of selectedOrder.value?.items ?? []) {
      if (!isCurrent() || !await saveOrderItemNote(item.id)) return false
    }
    return isCurrent()
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
    hasUnsavedOrderItemNotes,
    prepareOrderItemNoteNavigation,
    orderItemNoteDrafts,
    syncOrderItemNoteDrafts,
  }
}
