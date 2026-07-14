import { computed, ref, type ComputedRef, type Ref } from 'vue'
import {
  getShopCatalogSelectedCategoryId,
  getShopCatalogSelectedItemId,
} from '@/features/shopCatalog/adminViewHelpers'
import type { ShopCatalogItemRecord, ShopCategoryRecord } from '@/types/domain'

export type ShopCatalogInspectorKey =
  | 'root'
  | 'new-category'
  | 'new-item'
  | `category:${string}`
  | `item:${string}`

interface UseShopCatalogSelectionOptions {
  cancelInlineCreate: () => void
  categoriesById: ComputedRef<Map<string, ShopCategoryRecord>>
  ensureExpandedToCategory: (categoryId: string | null) => void
  items: Ref<ShopCatalogItemRecord[]>
  showInspectorPanel: () => void
}

export function useShopCatalogSelection({
  cancelInlineCreate,
  categoriesById,
  ensureExpandedToCategory,
  items,
  showInspectorPanel,
}: UseShopCatalogSelectionOptions) {
  const activeFolderId = ref<string | null>(null)
  const selectedInspectorKey = ref<ShopCatalogInspectorKey>('root')

  const selectedCategoryId = computed(() => getShopCatalogSelectedCategoryId(selectedInspectorKey.value))
  const selectedItemId = computed(() => getShopCatalogSelectedItemId(selectedInspectorKey.value))

  const selectedCategory = computed(() =>
    selectedCategoryId.value ? categoriesById.value.get(selectedCategoryId.value) ?? null : null,
  )

  const selectedItem = computed(() =>
    selectedItemId.value ? items.value.find((item) => item.id === selectedItemId.value) ?? null : null,
  )

  const isRootInspector = computed(() => selectedInspectorKey.value === 'root')
  const isCreateCategoryMode = computed(() => selectedInspectorKey.value === 'new-category')
  const isCreateItemMode = computed(() => selectedInspectorKey.value === 'new-item')

  function selectRoot() {
    activeFolderId.value = null
    selectedInspectorKey.value = 'root'
    cancelInlineCreate()
  }

  function selectFolder(categoryId: string, options?: { showInspector?: boolean; ensureExpanded?: boolean }) {
    activeFolderId.value = categoryId
    selectedInspectorKey.value = `category:${categoryId}`
    if (options?.showInspector ?? true) {
      showInspectorPanel()
    }
    if (options?.ensureExpanded ?? true) {
      ensureExpandedToCategory(categoryId)
    }
    cancelInlineCreate()
  }

  function inspectItem(item: ShopCatalogItemRecord, options?: { showInspector?: boolean }) {
    activeFolderId.value = item.categoryId
    selectedInspectorKey.value = `item:${item.id}`
    if (options?.showInspector ?? true) {
      showInspectorPanel()
    }
    ensureExpandedToCategory(item.categoryId)
    cancelInlineCreate()
  }

  return {
    activeFolderId,
    inspectItem,
    isCreateCategoryMode,
    isCreateItemMode,
    isRootInspector,
    selectFolder,
    selectedCategory,
    selectedCategoryId,
    selectedInspectorKey,
    selectedItem,
    selectedItemId,
    selectRoot,
  }
}
