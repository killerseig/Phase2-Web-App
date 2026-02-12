import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  createCatalogItem as createCatalogItemService,
  deleteCatalogItem as deleteCatalogItemService,
  listCatalog as listCatalogService,
  setCatalogItemActive as setCatalogItemActiveService,
  updateCatalogItem as updateCatalogItemService,
  type ShopCatalogItem,
} from '@/services'

export const useShopCatalogStore = defineStore('shopCatalog', () => {
  const items = ref<ShopCatalogItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const allItems = computed(() => items.value)
  const availableItems = computed(() => items.value.filter(i => i.active !== false))
  const isLoading = computed(() => loading.value)
  const hasError = computed(() => error.value !== null)

  // Actions
  async function fetchCatalog(activeOnly = false) {
    loading.value = true
    error.value = null
    try {
      items.value = await listCatalogService(activeOnly)
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to load catalog'
      console.error('[Shop Catalog Store] Error loading catalog:', e)
    } finally {
      loading.value = false
    }
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
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to create item'
      console.error('[Shop Catalog Store] Error creating item:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateItem(itemId: string, updates: { description?: string; sku?: string; price?: number }) {
    error.value = null
    try {
      await updateCatalogItemService(itemId, updates)
      const idx = items.value.findIndex(i => i.id === itemId)
      if (idx !== -1) {
        items.value[idx] = { ...items.value[idx], ...updates }
      }
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to update item'
      console.error('[Shop Catalog Store] Error updating item:', e)
      throw e
    }
  }

  async function setItemActive(itemId: string, active: boolean) {
    error.value = null
    try {
      await setCatalogItemActiveService(itemId, active)
      const idx = items.value.findIndex(i => i.id === itemId)
      if (idx !== -1) {
        items.value[idx] = { ...items.value[idx], active }
      }
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to update item status'
      console.error('[Shop Catalog Store] Error updating item status:', e)
      throw e
    }
  }

  async function deleteItem(itemId: string) {
    error.value = null
    try {
      await deleteCatalogItemService(itemId)
      items.value = items.value.filter(i => i.id !== itemId)
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to delete item'
      console.error('[Shop Catalog Store] Error deleting item:', e)
      throw e
    }
  }

  function clearError() {
    error.value = null
  }

  function resetStore() {
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
    allItems,
    availableItems,
    isLoading,
    hasError,

    // Actions
    fetchCatalog,
    createItem,
    updateItem,
    setItemActive,
    deleteItem,
    clearError,
    resetStore,
  }
})
