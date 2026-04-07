import { createPinia, setActivePinia } from 'pinia'
import { effectScope } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useShopCatalogStore } from '@/stores/shopCatalog'
import { useShopCategoriesStore } from '@/stores/shopCategories'
import { useShopCatalogSources } from '@/composables/useShopCatalogSources'

describe('useShopCatalogSources', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('combines catalog and category loading and error state', () => {
    const catalogStore = useShopCatalogStore()
    const categoriesStore = useShopCategoriesStore()

    const scope = effectScope()
    try {
      const sources = scope.run(() => useShopCatalogSources())

      expect(sources?.loading.value).toBe(false)
      expect(sources?.error.value).toBe('')

      catalogStore.loading = true
      expect(sources?.loading.value).toBe(true)

      catalogStore.loading = false
      categoriesStore.isLoading = true
      expect(sources?.loading.value).toBe(true)

      categoriesStore.isLoading = false
      categoriesStore.error = 'Category error'
      expect(sources?.error.value).toBe('Category error')

      categoriesStore.error = null
      catalogStore.error = 'Catalog error'
      expect(sources?.error.value).toBe('Catalog error')
    } finally {
      scope.stop()
    }
  })

  it('forwards subscribe, stop, and clearErrors to both stores', () => {
    const catalogStore = useShopCatalogStore()
    const categoriesStore = useShopCategoriesStore()

    const subscribeCatalog = vi.fn()
    const subscribeAllCategories = vi.fn()
    const stopCatalogSubscription = vi.fn()
    const stopCategoriesSubscription = vi.fn()
    const clearCatalogError = vi.fn()
    const clearCategoriesError = vi.fn()

    catalogStore.subscribeCatalog = subscribeCatalog
    categoriesStore.subscribeAllCategories = subscribeAllCategories
    catalogStore.stopCatalogSubscription = stopCatalogSubscription
    categoriesStore.stopCategoriesSubscription = stopCategoriesSubscription
    catalogStore.clearError = clearCatalogError
    categoriesStore.clearError = clearCategoriesError

    const scope = effectScope()
    try {
      const sources = scope.run(() => useShopCatalogSources())

      sources?.subscribe()
      expect(subscribeAllCategories).toHaveBeenCalledTimes(1)
      expect(subscribeCatalog).toHaveBeenCalledTimes(1)

      sources?.stop()
      expect(stopCategoriesSubscription).toHaveBeenCalledTimes(1)
      expect(stopCatalogSubscription).toHaveBeenCalledTimes(1)

      sources?.clearErrors()
      expect(clearCategoriesError).toHaveBeenCalledTimes(1)
      expect(clearCatalogError).toHaveBeenCalledTimes(1)
    } finally {
      scope.stop()
    }
  })
})
