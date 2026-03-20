import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  createCatalogItem as createCatalogItemService,
  deleteCatalogItem as deleteCatalogItemService,
  listCatalog as listCatalogService,
  setCatalogItemActive as setCatalogItemActiveService,
  subscribeCatalog as subscribeCatalogService,
  updateCatalogItem as updateCatalogItemService,
  type ShopCatalogItem,
} from '@/services'
import { normalizeError } from '@/services/serviceUtils'
import { logError } from '@/utils'

function cloneItem(item: ShopCatalogItem): ShopCatalogItem {
  return { ...item }
}

function sortItems(items: ShopCatalogItem[]): ShopCatalogItem[] {
  return items.slice().sort((a, b) => a.description.localeCompare(b.description))
}

function normalizeString(value?: string | null): string | null {
  return value ?? null
}

function normalizeNumber(value?: number | null): number | null {
  return value ?? null
}

function itemsMatch(serverItem: ShopCatalogItem, pendingItem: ShopCatalogItem): boolean {
  return (
    serverItem.description === pendingItem.description &&
    normalizeString(serverItem.categoryId) === normalizeString(pendingItem.categoryId) &&
    normalizeString(serverItem.sku) === normalizeString(pendingItem.sku) &&
    normalizeNumber(serverItem.price) === normalizeNumber(pendingItem.price) &&
    (serverItem.active ?? true) === (pendingItem.active ?? true)
  )
}

function createTempItemId(): string {
  return `temp-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export const useShopCatalogStore = defineStore('shopCatalog', () => {
  const items = ref<ShopCatalogItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const serverItems = ref<ShopCatalogItem[]>([])
  let unsubscribeCatalog: (() => void) | null = null
  const pendingDeletedItemIds = new Set<string>()
  const pendingUpsertItems = new Map<string, ShopCatalogItem>()

  const availableItems = computed(() => items.value.filter((item) => item.active !== false))

  const setStoreError = (err: unknown, fallback: string) => {
    error.value = normalizeError(err, fallback)
  }

  const ensureServerStateInitialized = () => {
    if (!serverItems.value.length && items.value.length) {
      serverItems.value = sortItems(items.value.map(cloneItem))
    }
  }

  const applyCatalogState = () => {
    const visibleServerItems = sortItems(
      serverItems.value.filter((item) => !pendingDeletedItemIds.has(item.id)).map(cloneItem)
    )
    const serverItemsById = new Map(visibleServerItems.map((item) => [item.id, item] as const))

    for (const [itemId, pendingItem] of Array.from(pendingUpsertItems.entries())) {
      const serverItem = serverItemsById.get(itemId)
      if (serverItem && itemsMatch(serverItem, pendingItem)) {
        pendingUpsertItems.delete(itemId)
      }
    }

    const mergedItems = visibleServerItems.map((item) => cloneItem(pendingUpsertItems.get(item.id) ?? item))
    const mergedIds = new Set(mergedItems.map((item) => item.id))

    for (const [itemId, pendingItem] of pendingUpsertItems.entries()) {
      if (!mergedIds.has(itemId) && !pendingDeletedItemIds.has(itemId)) {
        mergedItems.push(cloneItem(pendingItem))
      }
    }

    items.value = sortItems(mergedItems)
  }

  const applyCatalogSnapshot = (nextItems: ShopCatalogItem[]) => {
    serverItems.value = sortItems(nextItems.map(cloneItem))
    const snapshotIds = new Set(serverItems.value.map((item) => item.id))

    for (const itemId of Array.from(pendingDeletedItemIds)) {
      if (!snapshotIds.has(itemId)) {
        pendingDeletedItemIds.delete(itemId)
      }
    }

    applyCatalogState()
  }

  const withOptimisticItem = (itemId: string, nextItem: ShopCatalogItem) => {
    const previousPending = pendingUpsertItems.get(itemId)
    pendingUpsertItems.set(itemId, cloneItem(nextItem))
    applyCatalogState()

    return {
      rollback() {
        if (previousPending) {
          pendingUpsertItems.set(itemId, previousPending)
        } else {
          pendingUpsertItems.delete(itemId)
        }
        applyCatalogState()
      },
    }
  }

  const stopCatalogSubscription = () => {
    if (!unsubscribeCatalog) return
    unsubscribeCatalog()
    unsubscribeCatalog = null
  }

  const beginOptimisticDelete = (itemIds: string[]) => {
    ensureServerStateInitialized()
    const deleteIds = new Set(itemIds)
    const previousPendingItems = new Map<string, ShopCatalogItem>()

    deleteIds.forEach((itemId) => {
      const pendingItem = pendingUpsertItems.get(itemId)
      if (pendingItem) {
        previousPendingItems.set(itemId, pendingItem)
        pendingUpsertItems.delete(itemId)
      }
      pendingDeletedItemIds.add(itemId)
    })

    applyCatalogState()

    return {
      rollback() {
        deleteIds.forEach((itemId) => pendingDeletedItemIds.delete(itemId))
        previousPendingItems.forEach((item, itemId) => pendingUpsertItems.set(itemId, item))
        applyCatalogState()
      },
      commit() {
        applyCatalogState()
      },
    }
  }

  async function fetchCatalog(activeOnly = false) {
    loading.value = true
    error.value = null
    try {
      applyCatalogSnapshot(await listCatalogService(activeOnly))
    } catch (err) {
      setStoreError(err, 'Failed to load catalog')
      logError('Shop Catalog Store', 'Error loading catalog', err)
    } finally {
      loading.value = false
    }
  }

  function subscribeCatalog(activeOnly = false) {
    stopCatalogSubscription()
    loading.value = true
    error.value = null

    unsubscribeCatalog = subscribeCatalogService(
      activeOnly,
      (nextItems) => {
        applyCatalogSnapshot(nextItems)
        loading.value = false
      },
      (err) => {
        setStoreError(err, 'Failed to subscribe to catalog')
        loading.value = false
        logError('Shop Catalog Store', 'Error subscribing to catalog', err)
      }
    )
  }

  async function createItem(description: string, categoryId?: string, sku?: string, price?: number) {
    const nextDescription = description.trim()
    const nextSku = sku?.trim() || undefined
    const nextCategoryId = categoryId || undefined
    const tempItem: ShopCatalogItem = {
      id: createTempItemId(),
      description: nextDescription,
      categoryId: nextCategoryId,
      sku: nextSku,
      price: price ?? undefined,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    loading.value = true
    error.value = null
    pendingUpsertItems.set(tempItem.id, cloneItem(tempItem))
    applyCatalogState()

    try {
      const itemId = await createCatalogItemService(nextDescription, nextCategoryId, nextSku, price)
      const createdItem: ShopCatalogItem = {
        ...tempItem,
        id: itemId,
      }
      pendingUpsertItems.delete(tempItem.id)
      pendingUpsertItems.set(createdItem.id, cloneItem(createdItem))
      applyCatalogState()
      return createdItem
    } catch (err) {
      pendingUpsertItems.delete(tempItem.id)
      applyCatalogState()
      setStoreError(err, 'Failed to create item')
      logError('Shop Catalog Store', 'Error creating item', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updateItem(
    itemId: string,
    updates: { description?: string; sku?: string | null; price?: number | null }
  ) {
    error.value = null
    ensureServerStateInitialized()
    const currentItem = items.value.find((entry) => entry.id === itemId)

    if (!currentItem) {
      await updateCatalogItemService(itemId, updates)
      return
    }

    const nextItem: ShopCatalogItem = {
      ...cloneItem(currentItem),
      description: updates.description !== undefined ? updates.description : currentItem.description,
      sku: updates.sku !== undefined ? updates.sku ?? undefined : currentItem.sku,
      price: updates.price !== undefined ? updates.price ?? undefined : currentItem.price,
      updatedAt: new Date(),
    }

    const optimisticChange = withOptimisticItem(itemId, nextItem)

    try {
      await updateCatalogItemService(itemId, updates)
    } catch (err) {
      optimisticChange.rollback()
      setStoreError(err, 'Failed to update item')
      logError('Shop Catalog Store', 'Error updating item', err)
      throw err
    }
  }

  async function setItemActive(itemId: string, active: boolean) {
    error.value = null
    ensureServerStateInitialized()
    const currentItem = items.value.find((entry) => entry.id === itemId)

    if (!currentItem) {
      await setCatalogItemActiveService(itemId, active)
      return
    }

    const optimisticChange = withOptimisticItem(itemId, {
      ...cloneItem(currentItem),
      active,
      updatedAt: new Date(),
    })

    try {
      await setCatalogItemActiveService(itemId, active)
    } catch (err) {
      optimisticChange.rollback()
      setStoreError(err, 'Failed to update item status')
      logError('Shop Catalog Store', 'Error updating item status', err)
      throw err
    }
  }

  async function deleteItem(itemId: string) {
    error.value = null
    const optimisticDelete = beginOptimisticDelete([itemId])

    try {
      await deleteCatalogItemService(itemId)
      optimisticDelete.commit()
    } catch (err) {
      optimisticDelete.rollback()
      setStoreError(err, 'Failed to delete item')
      logError('Shop Catalog Store', 'Error deleting item', err)
      throw err
    }
  }

  function clearError() {
    error.value = null
  }

  function $reset() {
    stopCatalogSubscription()
    pendingDeletedItemIds.clear()
    pendingUpsertItems.clear()
    serverItems.value = []
    items.value = []
    loading.value = false
    error.value = null
  }

  return {
    items,
    loading,
    error,
    availableItems,
    fetchCatalog,
    subscribeCatalog,
    createItem,
    updateItem,
    setItemActive,
    deleteItem,
    beginOptimisticDelete,
    stopCatalogSubscription,
    clearError,
    $reset,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useShopCatalogStore, import.meta.hot))
}
