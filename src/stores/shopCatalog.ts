import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref, computed } from 'vue'
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

export const useShopCatalogStore = defineStore('shopCatalog', () => {
  const items = ref<ShopCatalogItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  let unsubscribeCatalog: (() => void) | null = null

  // Computed
  const availableItems = computed(() => items.value.filter(i => i.active !== false))

  const setStoreError = (err: unknown, fallback: string) => {
    error.value = normalizeError(err, fallback)
  }

  const updateCachedItem = (itemId: string, updater: (item: ShopCatalogItem) => void) => {
    const item = items.value.find((entry) => entry.id === itemId)
    if (item) updater(item)
  }

  const stopCatalogSubscription = () => {
    if (!unsubscribeCatalog) return
    unsubscribeCatalog()
    unsubscribeCatalog = null
  }

  // Actions
  async function fetchCatalog(activeOnly = false) {
    loading.value = true
    error.value = null
    try {
      items.value = await listCatalogService(activeOnly)
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
        items.value = nextItems
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
    loading.value = true
    error.value = null
    try {
      const itemId = await createCatalogItemService(description, categoryId, sku, price)
      // Re-fetch catalog to get the new item
      const catalog = await listCatalogService(false)
      const newItem = catalog.find(i => i.id === itemId)
      if (newItem) {
        items.value.push(newItem)
        return newItem
      }
      throw new Error('Failed to retrieve created item')
    } catch (err) {
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
    try {
      await updateCatalogItemService(itemId, updates)
      updateCachedItem(itemId, (item) => {
        if (updates.description !== undefined) item.description = updates.description
        if (updates.sku !== undefined) item.sku = updates.sku ?? undefined
        if (updates.price !== undefined) item.price = updates.price ?? undefined
      })
    } catch (err) {
      setStoreError(err, 'Failed to update item')
      logError('Shop Catalog Store', 'Error updating item', err)
      throw err
    }
  }

  async function setItemActive(itemId: string, active: boolean) {
    error.value = null
    try {
      await setCatalogItemActiveService(itemId, active)
      updateCachedItem(itemId, (item) => {
        item.active = active
      })
    } catch (err) {
      setStoreError(err, 'Failed to update item status')
      logError('Shop Catalog Store', 'Error updating item status', err)
      throw err
    }
  }

  async function deleteItem(itemId: string) {
    error.value = null
    try {
      await deleteCatalogItemService(itemId)
      items.value = items.value.filter(i => i.id !== itemId)
    } catch (err) {
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
    items.value = []
    loading.value = false
    error.value = null
  }

  return {
    // State
    items,
    loading,
    error,

    // Computed
    availableItems,

    // Actions
    fetchCatalog,
    subscribeCatalog,
    createItem,
    updateItem,
    setItemActive,
    deleteItem,
    stopCatalogSubscription,
    clearError,
    $reset,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useShopCatalogStore, import.meta.hot))
}

