import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useShopCatalogStore } from '@/stores/shopCatalog'
import { useShopCategoriesStore } from '@/stores/shopCategories'

export function useShopCatalogSources() {
  const categoriesStore = useShopCategoriesStore()
  const catalogStore = useShopCatalogStore()

  const {
    categories,
    isLoading: categoriesLoading,
    error: categoriesError,
  } = storeToRefs(categoriesStore)
  const {
    items: catalogItems,
    loading: catalogLoading,
    error: catalogError,
  } = storeToRefs(catalogStore)

  const loading = computed(() => categoriesLoading.value || catalogLoading.value)
  const error = computed(() => categoriesError.value || catalogError.value || '')

  const subscribe = () => {
    categoriesStore.subscribeAllCategories()
    catalogStore.subscribeCatalog()
  }

  const stop = () => {
    categoriesStore.stopCategoriesSubscription()
    catalogStore.stopCatalogSubscription()
  }

  const clearErrors = () => {
    categoriesStore.clearError()
    catalogStore.clearError()
  }

  return {
    categoriesStore,
    catalogStore,
    categories,
    catalogItems,
    loading,
    error,
    subscribe,
    stop,
    clearErrors,
  }
}
