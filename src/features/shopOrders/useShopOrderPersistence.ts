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
  itemActionLoading: WritableRef<boolean>
  replaceOrderLocally: (order: ShopOrderRecord) => void
  selectedOrder: ReadonlyRef<ShopOrderRecord | null>
  setActionError: (message: string) => void
  setActionInfo: (message: string) => void
}

export function useShopOrderPersistence({
  getActor,
  itemActionLoading,
  replaceOrderLocally,
  selectedOrder,
  setActionError,
  setActionInfo,
}: UseShopOrderPersistenceOptions) {
  let itemPersistQueue: Promise<void> = Promise.resolve()
  let itemPersistRevision = 0
  let activeMutationCount = 0

  function beginMutation() {
    activeMutationCount += 1
    itemActionLoading.value = activeMutationCount > 0

    return () => {
      activeMutationCount = Math.max(0, activeMutationCount - 1)
      itemActionLoading.value = activeMutationCount > 0
    }
  }

  async function persistOrderMeta(orderId: string, form: OrderMetaFormState) {
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
      setActionInfo('Order details saved.')
      return true
    } catch (error) {
      setActionError(normalizeError(error, 'Failed to save order details.'))
      setActionInfo('')
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
    if (!orderId) {
      setActionError('Start an order before changing items.')
      setActionInfo('')
      return false
    }

    itemActionLoading.value = true
    setActionError('')

    const sortedItems = getSortedShopOrderItems(nextItems)
    const previousOrder = selectedOrder.value?.id === orderId ? selectedOrder.value : null
    const persistRevision = ++itemPersistRevision

    if (previousOrder) {
      replaceOrderLocally({
        ...previousOrder,
        items: sortedItems,
      })
    }

    const endMutation = beginMutation()

    const persistOperation = itemPersistQueue
      .catch(() => undefined)
      .then(() => updateShopOrderRecord(orderId, { items: sortedItems }, getActor()))
    itemPersistQueue = persistOperation

    try {
      await persistOperation
      setActionError('')
      setActionInfo(successMessage)
      return true
    } catch (error) {
      if (previousOrder && persistRevision === itemPersistRevision) {
        replaceOrderLocally(previousOrder)
      }
      setActionError(normalizeError(error, 'Failed to update shop order items.'))
      setActionInfo('')
      return false
    } finally {
      endMutation()
    }
  }

  return {
    cloneOrderItems,
    persistOrderItems,
    persistOrderMeta,
  }
}
