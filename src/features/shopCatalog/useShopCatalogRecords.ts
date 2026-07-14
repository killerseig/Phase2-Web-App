import { ref } from 'vue'
import { subscribeShopCatalogItems, subscribeShopCategories } from '@/services/shopCatalog'
import type { ShopCatalogItemRecord, ShopCategoryRecord } from '@/types/domain'
import { normalizeError } from '@/utils/normalizeError'

type ShopCatalogRecordsLoadingMode = 'all' | 'category-or-items'

interface UseShopCatalogRecordsOptions {
  loadingMode?: ShopCatalogRecordsLoadingMode
  categoryErrorMessage?: string
  itemErrorMessage?: string
  fallbackErrorMessage?: string
}

export function useShopCatalogRecords(options: UseShopCatalogRecordsOptions = {}) {
  const loadingMode = options.loadingMode ?? 'all'
  const categories = ref<ShopCategoryRecord[]>([])
  const items = ref<ShopCatalogItemRecord[]>([])
  const loading = ref(true)
  const error = ref('')

  let unsubscribeCategories: (() => void) | null = null
  let unsubscribeItems: (() => void) | null = null

  function stopCatalogRecords() {
    unsubscribeCategories?.()
    unsubscribeCategories = null
    unsubscribeItems?.()
    unsubscribeItems = null
  }

  function subscribeCatalogRecords() {
    stopCatalogRecords()
    loading.value = true
    error.value = ''

    let categoriesReady = false
    let itemsReady = false

    const markReady = (source: 'categories' | 'items') => {
      if (loadingMode === 'all') {
        if (categoriesReady && itemsReady) {
          loading.value = false
        }
        return
      }

      if (source === 'items' || categories.value.length || items.value.length) {
        loading.value = false
      }
    }

    try {
      unsubscribeCategories = subscribeShopCategories(
        (nextCategories) => {
          categories.value = nextCategories
          categoriesReady = true
          markReady('categories')
        },
        (caughtError) => {
          error.value = normalizeError(caughtError, options.categoryErrorMessage ?? 'Failed to load shop catalog folders.')
          loading.value = false
        },
      )

      unsubscribeItems = subscribeShopCatalogItems(
        (nextItems) => {
          items.value = nextItems
          itemsReady = true
          markReady('items')
        },
        (caughtError) => {
          error.value = normalizeError(caughtError, options.itemErrorMessage ?? 'Failed to load shop catalog items.')
          loading.value = false
        },
      )
    } catch (caughtError) {
      error.value = normalizeError(caughtError, options.fallbackErrorMessage ?? 'Failed to load shop catalog.')
      loading.value = false
    }
  }

  return {
    categories,
    error,
    items,
    loading,
    stopCatalogRecords,
    subscribeCatalogRecords,
  }
}
