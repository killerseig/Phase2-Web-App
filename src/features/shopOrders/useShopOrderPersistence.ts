import {
  cloneSortedShopOrderItems,
  getSortedShopOrderItems,
  type OrderMetaFormState,
} from '@/features/shopOrders/viewHelpers'
import { updateShopOrderRecord } from '@/services/shopOrders'
import type { ShopOrderItemRecord, ShopOrderRecord } from '@/types/domain'
import { normalizeError } from '@/utils/normalizeError'

interface Ref<T> {
  value: T
}

interface ReadonlyRef<T> {
  readonly value: T
}

interface ShopOrderActor {
  userId: string | null
  displayName: string | null
}

interface UseShopOrderPersistenceOptions {
  getActor: () => ShopOrderActor
  itemActionLoading: Ref<boolean>
  selectedOrder: ReadonlyRef<ShopOrderRecord | null>
  setActionError: (message: string) => void
  setActionInfo: (message: string) => void
}

export function useShopOrderPersistence({
  getActor,
  itemActionLoading,
  selectedOrder,
  setActionError,
  setActionInfo,
}: UseShopOrderPersistenceOptions) {
  async function persistOrderMeta(orderId: string, form: OrderMetaFormState) {
    itemActionLoading.value = true
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
      itemActionLoading.value = false
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

    try {
      await updateShopOrderRecord(orderId, { items: getSortedShopOrderItems(nextItems) }, getActor())
      setActionInfo(successMessage)
      return true
    } catch (error) {
      setActionError(normalizeError(error, 'Failed to update shop order items.'))
      setActionInfo('')
      return false
    } finally {
      itemActionLoading.value = false
    }
  }

  return {
    cloneOrderItems,
    persistOrderItems,
    persistOrderMeta,
  }
}
