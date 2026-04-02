import { computed } from 'vue'
import type { ShopOrder, ShopOrderItem } from '@/services'
import { normalizeError } from '@/services/serviceUtils'
import {
  buildCatalogSelectionQuantities,
  mergeShopOrderItem,
} from '@/utils/shopOrderItems'
import type { CatalogOrderSelection, CatalogItemQuantityUpdate } from '@/types/shopOrders'
import { buildCatalogSelectionNote, normalizeCatalogOrderQuantity } from '@/utils/catalogOrder'
import { logError } from '@/utils/logger'
import { useToast } from '@/composables/useToast'
import { useShopOrderItemPersistence } from '@/views/shopOrders/useShopOrderItemPersistence'
import type {
  ShopOrderMutationState,
  UseShopOrderMutationsOptions,
} from '@/views/shopOrders/shopOrderMutationTypes'

type DraftSnapshot = {
  description: string
  quantity: string
  note: string
  catalogItemId: string | null
  selectedCatalogItem: CatalogOrderSelection | null
}

export function useShopOrderItemActions(
  options: UseShopOrderMutationsOptions,
  state: ShopOrderMutationState,
) {
  const toast = options.toast ?? useToast()
  const {
    cloneItems,
    setOrderItems,
    persistItems,
    runOptimisticItemUpdate,
  } = useShopOrderItemPersistence(options)
  const selectedCatalogItemQuantities = computed(() =>
    buildCatalogSelectionQuantities(options.selected.value?.items ?? []),
  )

  const captureDraftSnapshot = (): DraftSnapshot => ({
    description: state.newItemDescription.value,
    quantity: state.newItemQty.value,
    note: state.newItemNote.value,
    catalogItemId: state.newItemCatalogId.value,
    selectedCatalogItem: state.selectedCatalogItem.value,
  })

  const resetDraft = () => {
    state.newItemDescription.value = ''
    state.newItemQty.value = ''
    state.newItemNote.value = ''
    state.newItemCatalogId.value = null
    state.selectedCatalogItem.value = null
  }

  const restoreDraft = (snapshot: DraftSnapshot) => {
    state.newItemDescription.value = snapshot.description
    state.newItemQty.value = snapshot.quantity
    state.newItemNote.value = snapshot.note
    state.newItemCatalogId.value = snapshot.catalogItemId
    state.selectedCatalogItem.value = snapshot.selectedCatalogItem
  }

  const normalizeCatalogSelection = (item: CatalogOrderSelection) => {
    const description = item.description.trim()
    const defaultQty = state.catalogItemQtys.value[item.id]
    const quantity = normalizeCatalogOrderQuantity(item.quantity, defaultQty ?? 1)
    return {
      description,
      quantity,
      catalogItemId: item.id,
      note: buildCatalogSelectionNote(item),
    }
  }

  const addItemOptimistically = async (item: ShopOrderItem, snapshot: DraftSnapshot) => {
    const selectedOrder = options.selected.value
    if (!selectedOrder) return

    const orderId = selectedOrder.id
    const previousItems = cloneItems(selectedOrder.items ?? [])
    const nextItems = mergeShopOrderItem(previousItems, item)

    resetDraft()
    await runOptimisticItemUpdate({
      orderId,
      nextItems,
      successMessage: 'Item added successfully',
      errorMessage: (error) => `Failed to add item: ${normalizeError(error, 'Unknown error')}`,
      logMessage: 'Add item error',
      onRollback: () => {
        restoreDraft(snapshot)
      },
    })
  }

  const addItem = async () => {
    const description = state.newItemDescription.value.trim()
    if (!description) {
      toast.show('Description is required', 'error')
      return
    }

    if (!options.selected.value) {
      toast.show('No order selected', 'error')
      return
    }

    const snapshot = captureDraftSnapshot()
    const quantity = normalizeCatalogOrderQuantity(state.newItemQty.value)
    const note = state.newItemNote.value.trim() || undefined

    await addItemOptimistically(
      {
        description,
        quantity,
        ...(note ? { note } : {}),
        catalogItemId: state.newItemCatalogId.value ?? null,
      },
      snapshot,
    )
  }

  const selectCatalogItem = (item: CatalogOrderSelection) => {
    const normalized = normalizeCatalogSelection(item)
    if (!normalized.description) {
      toast.show('Catalog item is missing a description', 'error')
      return
    }

    state.newItemCatalogId.value = normalized.catalogItemId
    state.newItemDescription.value = normalized.description
    state.newItemQty.value = String(normalized.quantity)
    state.newItemNote.value = normalized.note
    state.selectedCatalogItem.value = item
    void addItem()

    if (item.id) {
      state.catalogItemQtys.value[item.id] = 1
    }
  }

  const updateCatalogItemQty = ({ id, qty }: CatalogItemQuantityUpdate) => {
    state.catalogItemQtys.value[id] = normalizeCatalogOrderQuantity(qty)
  }

  const handleSelectedItemsUpdate = (items: ShopOrder['items']) => {
    const selectedOrder = options.selected.value
    if (!selectedOrder) return

    setOrderItems(selectedOrder.id, items)
    void persistItems(selectedOrder.id, items).catch((error) => {
      logError('ShopOrders', 'Failed to persist items', error)
      toast.show('Failed to save item changes', 'error')
    })
  }

  const handleDeleteSelectedItem = async (index: number) => {
    const selectedOrder = options.selected.value
    if (!selectedOrder) return

    const previousItems = cloneItems(selectedOrder.items ?? [])
    const nextItems = previousItems.filter((_, itemIndex) => itemIndex !== index)

    await runOptimisticItemUpdate({
      orderId: selectedOrder.id,
      nextItems,
      errorMessage: (error) => `Failed to delete item: ${normalizeError(error, 'Unknown error')}`,
      logMessage: 'Delete item error',
    })
  }

  return {
    selectedCatalogItemQuantities,
    addItem,
    selectCatalogItem,
    updateCatalogItemQty,
    handleSelectedItemsUpdate,
    handleDeleteSelectedItem,
  }
}
