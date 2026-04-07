import { updateShopOrderItems, type ShopOrderItem } from '@/services'
import { useToast } from '@/composables/useToast'
import { sanitizeShopOrderItems } from '@/utils/shopOrderItems'
import { logError } from '@/utils/logger'
import type { UseShopOrderMutationsOptions } from './shopOrderMutationTypes'

type PersistOrderItemsErrorMessage = string | ((error: unknown) => string)

type RunOptimisticOrderItemUpdateOptions = {
  orderId: string
  nextItems: ShopOrderItem[]
  successMessage?: string
  errorMessage: PersistOrderItemsErrorMessage
  logMessage: string
  onRollback?: (previousItems: ShopOrderItem[], error: unknown) => void
}

export function useShopOrderItemPersistence(options: UseShopOrderMutationsOptions) {
  const toast = options.toast ?? useToast()
  let persistItemsChain: Promise<void> = Promise.resolve()

  const cloneItems = (items: ShopOrderItem[] = []) => items.map((item) => ({ ...item }))

  const getOrderItems = (orderId: string) => {
    const order = options.orders.value.find((entry) => entry.id === orderId)
    return cloneItems(order?.items ?? [])
  }

  const setOrderItems = (orderId: string, items: ShopOrderItem[]) => {
    const order = options.orders.value.find((entry) => entry.id === orderId)
    if (!order) return
    order.items = cloneItems(items)
  }

  const queuePersistItems = (task: () => Promise<void>) => {
    const nextTask = persistItemsChain.then(task, task)
    persistItemsChain = nextTask.catch(() => {})
    return nextTask
  }

  const persistItems = (orderId: string, items: ShopOrderItem[]) =>
    queuePersistItems(async () => {
      await updateShopOrderItems(options.jobId.value, orderId, sanitizeShopOrderItems(items))
    })

  const runOptimisticItemUpdate = async (config: RunOptimisticOrderItemUpdateOptions) => {
    const previousItems = getOrderItems(config.orderId)
    setOrderItems(config.orderId, config.nextItems)

    try {
      await persistItems(config.orderId, config.nextItems)

      if (config.successMessage) {
        toast.show(config.successMessage, 'success')
      }
    } catch (error) {
      setOrderItems(config.orderId, previousItems)
      config.onRollback?.(previousItems, error)
      logError('ShopOrders', config.logMessage, error)

      const errorMessage = typeof config.errorMessage === 'function'
        ? config.errorMessage(error)
        : config.errorMessage
      toast.show(errorMessage, 'error')
    }
  }

  return {
    cloneItems,
    setOrderItems,
    persistItems,
    runOptimisticItemUpdate,
  }
}
