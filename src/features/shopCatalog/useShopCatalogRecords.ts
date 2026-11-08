import { getCurrentScope, onScopeDispose, ref, watch } from 'vue'
import type { AdminRequestContext } from '@/features/admin/useAdminRequestContext'
import { subscribeShopCatalogItems, subscribeShopCategories } from '@/services/shopCatalog'
import type { ShopCatalogItemRecord, ShopCategoryRecord } from '@/types/domain'
import { normalizeError } from '@/utils/normalizeError'

type ShopCatalogRecordsLoadingMode = 'all' | 'category-or-items'

interface UseShopCatalogRecordsOptions {
  context?: AdminRequestContext
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
  let generation = 0, disposed = false

  function stopCatalogRecords() {
    generation++
    unsubscribeCategories?.()
    unsubscribeCategories = null
    unsubscribeItems?.()
    unsubscribeItems = null
  }

  function subscribeCatalogRecords() {
    stopCatalogRecords()
    if (disposed || (options.context && !options.context.allowed.value)) { clear(); return }
    const owner = generation, contextCurrent = options.context?.capture() ?? (() => true)
    const current = () => !disposed && owner === generation && contextCurrent()
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
      const stopCategories = subscribeShopCategories(
        (nextCategories) => {
          if (!current()) return
          categories.value = nextCategories
          categoriesReady = true
          markReady('categories')
        },
        (caughtError) => {
          if (!current()) return
          clearDenied(caughtError)
          error.value = normalizeError(caughtError, options.categoryErrorMessage ?? 'Failed to load shop catalog folders.')
          loading.value = false
        },
      )
      if (!current()) { stopCategories(); return }
      unsubscribeCategories = stopCategories

      const stopItems = subscribeShopCatalogItems(
        (nextItems) => {
          if (!current()) return
          items.value = nextItems
          itemsReady = true
          markReady('items')
        },
        (caughtError) => {
          if (!current()) return
          clearDenied(caughtError)
          error.value = normalizeError(caughtError, options.itemErrorMessage ?? 'Failed to load shop catalog items.')
          loading.value = false
        },
      )
      if (current()) unsubscribeItems = stopItems
      else stopItems()
    } catch (caughtError) {
      if (!current()) return
      clearDenied(caughtError)
      error.value = normalizeError(caughtError, options.fallbackErrorMessage ?? 'Failed to load shop catalog.')
      loading.value = false
    }
  }

  function clear() { categories.value = []; items.value = []; loading.value = false; error.value = '' }
  function clearDenied(reason: unknown) {
    const code = typeof reason === 'object' && reason !== null && 'code' in reason ? String(reason.code) : ''
    if (/permission-denied|unauthenticated/.test(code)) { stopCatalogRecords(); categories.value = []; items.value = [] }
  }
  if (options.context) watch(options.context.revision, () => { stopCatalogRecords(); clear() }, { flush: 'sync' })
  if (getCurrentScope()) onScopeDispose(() => { disposed = true; stopCatalogRecords(); clear() })

  return {
    categories,
    error,
    items,
    loading,
    stopCatalogRecords,
    subscribeCatalogRecords,
  }
}
