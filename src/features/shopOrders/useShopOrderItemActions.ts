import {
  createEmptyCustomItemFormState,
  getShopOrderCatalogItemDescription,
  makeLocalShopOrderItemId,
  readShopOrderQuantity,
  type CustomItemFormState,
} from '@/features/shopOrders/viewHelpers'
import type {
  ShopCatalogItemRecord,
  ShopCategoryRecord,
  ShopOrderItemRecord,
  ShopOrderRecord,
} from '@/types/domain'

interface Ref<T> {
  value: T
}

interface ReadonlyRef<T> {
  readonly value: T
}

interface DraftOrderTarget {
  orderId: string
  items: ShopOrderItemRecord[]
}

interface UseShopOrderItemActionsOptions {
  categoriesById: ReadonlyRef<ReadonlyMap<string, ShopCategoryRecord>>
  cloneOrderItems: (order: ShopOrderRecord) => ShopOrderItemRecord[]
  closeRemoveItemConfirm: () => void
  customItemForm: CustomItemFormState
  ensureDraftOrderTarget: () => Promise<DraftOrderTarget | null>
  persistOrderItems: (
    orderId: string,
    items: ShopOrderItemRecord[],
    successMessage: string,
  ) => Promise<boolean>
  removeItemTargetId: ReadonlyRef<string | null>
  selectedOrder: ReadonlyRef<ShopOrderRecord | null>
  setActionError: (message: string) => void
}

export function useShopOrderItemActions({
  categoriesById,
  cloneOrderItems,
  closeRemoveItemConfirm,
  customItemForm,
  ensureDraftOrderTarget,
  persistOrderItems,
  removeItemTargetId,
  selectedOrder,
  setActionError,
}: UseShopOrderItemActionsOptions) {
  async function addCatalogItemToOrder(item: ShopCatalogItemRecord, quantity: number) {
    const targetOrder = await ensureDraftOrderTarget()
    if (!targetOrder) return false

    const nextQuantity = readShopOrderQuantity(quantity)
    const itemDescription = getShopOrderCatalogItemDescription(item, categoriesById.value)
    const nextItems = targetOrder.items
    const existingItem = nextItems.find(
      (entry) => entry.sourceType === 'catalog' && entry.catalogItemId === item.id,
    )

    if (existingItem) {
      existingItem.quantity = (existingItem.quantity ?? 0) + nextQuantity
    } else {
      nextItems.push({
        id: makeLocalShopOrderItemId(),
        sourceType: 'catalog',
        catalogItemId: item.id,
        description: itemDescription,
        quantity: nextQuantity,
        note: '',
        categoryId: item.categoryId,
        sku: item.sku,
      })
    }

    return persistOrderItems(
      targetOrder.orderId,
      nextItems,
      `${itemDescription} added to the current order.`,
    )
  }

  async function addCustomItemToOrder() {
    if (!customItemForm.description.trim()) {
      setActionError('Enter a description for the custom item.')
      return
    }

    const targetOrder = await ensureDraftOrderTarget()
    if (!targetOrder) return

    const nextItems = targetOrder.items
    nextItems.push({
      id: makeLocalShopOrderItemId(),
      sourceType: 'custom',
      catalogItemId: null,
      description: customItemForm.description.trim(),
      quantity: readShopOrderQuantity(customItemForm.quantity),
      note: customItemForm.note.trim(),
      categoryId: null,
      sku: null,
    })

    const saved = await persistOrderItems(
      targetOrder.orderId,
      nextItems,
      'Custom item added to the current order.',
    )
    if (saved) {
      Object.assign(customItemForm, createEmptyCustomItemFormState())
    }
  }

  async function updateOrderItemQuantity(orderItemId: string, rawValue: string) {
    if (!selectedOrder.value || selectedOrder.value.status !== 'draft') return

    const nextItems = cloneOrderItems(selectedOrder.value)
    const targetItem = nextItems.find((item) => item.id === orderItemId)
    if (!targetItem) return

    targetItem.quantity = readShopOrderQuantity(rawValue)
    await persistOrderItems(selectedOrder.value.id, nextItems, 'Order quantity updated.')
  }

  async function confirmRemoveOrderItem() {
    if (!selectedOrder.value || selectedOrder.value.status !== 'draft' || !removeItemTargetId.value) {
      closeRemoveItemConfirm()
      return
    }

    const nextItems = cloneOrderItems(selectedOrder.value).filter((item) => item.id !== removeItemTargetId.value)
    await persistOrderItems(selectedOrder.value.id, nextItems, 'Order item removed.')
    closeRemoveItemConfirm()
  }

  return {
    addCatalogItemToOrder,
    addCustomItemToOrder,
    confirmRemoveOrderItem,
    updateOrderItemQuantity,
  }
}
