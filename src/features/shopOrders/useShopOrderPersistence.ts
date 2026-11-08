import { getCurrentScope, onScopeDispose, watch } from 'vue'
import {
  cloneSortedShopOrderItems,
  getSortedShopOrderItems,
  type OrderMetaFormState,
} from '@/features/shopOrders/viewHelpers'
import { updateShopOrderRecord } from '@/services/shopOrders'
import type { ShopOrderItemRecord, ShopOrderRecord } from '@/types/domain'
import type { ReadonlyRef, WritableRef } from '@/types/reactivity'
import { normalizeError } from '@/utils/normalizeError'

interface ShopOrderActor {
  userId: string | null
  displayName: string | null
}

interface UseShopOrderPersistenceOptions {
  getActor: () => ShopOrderActor
  getContextEpoch?: () => number
  itemActionLoading: WritableRef<boolean>
  replaceOrderLocally: (order: ShopOrderRecord) => void
  selectedOrder: ReadonlyRef<ShopOrderRecord | null>
  setActionError: (message: string) => void
  setActionInfo: (message: string) => void
}

export function useShopOrderPersistence({
  getActor,
  getContextEpoch,
  itemActionLoading,
  replaceOrderLocally,
  selectedOrder,
  setActionError,
  setActionInfo,
}: UseShopOrderPersistenceOptions) {
  let itemPersistQueue: Promise<void> = Promise.resolve()
  let itemPersistRevision = 0
  let activeMutationCount = 0
  const pendingItemSaves = new Set<Promise<boolean>>()
  let contextVersion = 0
  let disposed = false
  watch([() => selectedOrder.value?.id, () => getActor().userId, () => getContextEpoch?.()],
    () => { contextVersion += 1 }, { flush: 'sync' })
  if (getCurrentScope()) onScopeDispose(() => { disposed = true; contextVersion += 1 })
  function captureContext() {
    const version = contextVersion
    return () => !disposed && contextVersion === version
  }

  function beginMutation() {
    activeMutationCount += 1
    itemActionLoading.value = activeMutationCount > 0

    return () => {
      activeMutationCount = Math.max(0, activeMutationCount - 1)
      itemActionLoading.value = activeMutationCount > 0
    }
  }

  async function persistOrderMeta(orderId: string, form: OrderMetaFormState) {
    const isCurrent = captureContext()
    if (!isCurrent()) return false
    const endMutation = beginMutation()
    setActionError('')

    try {
      await updateShopOrderRecord(
        orderId,
        {
          deliveryDate: form.deliveryDate,
          comments: form.comments,
        },
        getActor(),
      )
      if (isCurrent() && selectedOrder.value?.id === orderId) setActionInfo('Order details saved.')
      return isCurrent()
    } catch (error) {
      if (isCurrent() && selectedOrder.value?.id === orderId) {
        setActionError(normalizeError(error, 'Failed to save order details.'))
        setActionInfo('')
      }
      return false
    } finally {
      endMutation()
    }
  }

  function cloneOrderItems(order: ShopOrderRecord | null = selectedOrder.value) {
    return cloneSortedShopOrderItems(order)
  }

  async function persistOrderItems(
    orderId: string,
    nextItems: ShopOrderItemRecord[],
    successMessage: string,
  ) {
    const isCurrent = captureContext()
    if (!isCurrent()) return false
    if (!orderId) {
      setActionError('Start an order before changing items.')
      setActionInfo('')
      return false
    }

    itemActionLoading.value = true
    setActionError('')

    const sortedItems = getSortedShopOrderItems(nextItems).map(item => ({ ...item }))
    const previousOrder = selectedOrder.value?.id === orderId ? selectedOrder.value : null
    const persistRevision = ++itemPersistRevision

    if (previousOrder) {
      replaceOrderLocally({
        ...previousOrder,
        items: sortedItems,
      })
    }

    const endMutation = beginMutation()
    const actor = getActor()

    const persistOperation = itemPersistQueue
      .catch(() => undefined)
      .then(() => {
        if (!isCurrent()) throw new Error('The shop order context changed before saving.')
        return updateShopOrderRecord(orderId, { items: sortedItems }, actor)
      })
    itemPersistQueue = persistOperation

    const result = (async () => { try {
      await persistOperation
      if (isCurrent() && selectedOrder.value?.id === orderId) {
        setActionError('')
        setActionInfo(successMessage)
      }
      return isCurrent()
    } catch (error) {
      if (isCurrent() && previousOrder && persistRevision === itemPersistRevision && selectedOrder.value?.id === orderId) {
        replaceOrderLocally(previousOrder)
      }
      if (isCurrent() && selectedOrder.value?.id === orderId) {
        setActionError(normalizeError(error, 'Failed to update shop order items.'))
        setActionInfo('')
      }
      return false
    } finally {
      endMutation()
    } })()
    pendingItemSaves.add(result)
    try { return await result } finally { pendingItemSaves.delete(result) }
  }

  async function prepareOrderItemNavigation() {
    const isCurrent = captureContext()
    while (isCurrent() && pendingItemSaves.size) {
      if ((await Promise.all(pendingItemSaves)).some(saved => !saved)) return false
    }
    return isCurrent()
  }

  return {
    cloneOrderItems,
    persistOrderItems,
    persistOrderMeta,
    prepareOrderItemNavigation,
  }
}
