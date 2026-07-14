import { watch } from 'vue'
import type { ShopCatalogItemRecord, ShopCategoryRecord } from '@/types/domain'

interface Ref<T> {
  value: T
}

interface ReadonlyRef<T> {
  readonly value: T
}

interface UseShopCatalogSelectionSyncOptions {
  activeFolderId: Ref<string | null>
  applySelectedCategoryToForm: (category: ShopCategoryRecord | null) => void
  applySelectedItemToForm: (item: ShopCatalogItemRecord | null) => void
  categories: ReadonlyRef<ShopCategoryRecord[]>
  initializeRootCategories: (categories?: ShopCategoryRecord[]) => void
  isCreateCategoryMode: ReadonlyRef<boolean>
  isCreateItemMode: ReadonlyRef<boolean>
  items: ReadonlyRef<ShopCatalogItemRecord[]>
  resetCreateCategoryForm: () => void
  resetCreateItemForm: () => void
  selectedCategory: ReadonlyRef<ShopCategoryRecord | null>
  selectedCategoryId: ReadonlyRef<string | null>
  selectedInspectorKey: Ref<string>
  selectedItem: ReadonlyRef<ShopCatalogItemRecord | null>
  selectedItemId: ReadonlyRef<string | null>
  treeInitialized: Ref<boolean>
}

export function useShopCatalogSelectionSync({
  activeFolderId,
  applySelectedCategoryToForm,
  applySelectedItemToForm,
  categories,
  initializeRootCategories,
  isCreateCategoryMode,
  isCreateItemMode,
  items,
  resetCreateCategoryForm,
  resetCreateItemForm,
  selectedCategory,
  selectedCategoryId,
  selectedInspectorKey,
  selectedItem,
  selectedItemId,
  treeInitialized,
}: UseShopCatalogSelectionSyncOptions) {
  watch(
    () => selectedCategory.value,
    (category) => {
      if (isCreateCategoryMode.value) {
        resetCreateCategoryForm()
        return
      }

      applySelectedCategoryToForm(category)
    },
  )

  watch(
    () => selectedItem.value,
    (item) => {
      if (isCreateItemMode.value) {
        resetCreateItemForm()
        return
      }

      applySelectedItemToForm(item)
    },
  )

  watch(
    () => categories.value,
    (nextCategories) => {
      if (!treeInitialized.value) {
        initializeRootCategories(nextCategories)
        treeInitialized.value = true
      }

      if (activeFolderId.value && !nextCategories.some((category) => category.id === activeFolderId.value)) {
        activeFolderId.value = null
        selectedInspectorKey.value = 'root'
      }

      if (selectedCategoryId.value && !nextCategories.some((category) => category.id === selectedCategoryId.value)) {
        selectedInspectorKey.value = 'root'
      }
    },
  )

  watch(
    () => items.value,
    (nextItems) => {
      if (selectedItemId.value && !nextItems.some((item) => item.id === selectedItemId.value)) {
        selectedInspectorKey.value = activeFolderId.value ? `category:${activeFolderId.value}` : 'root'
      }
    },
  )
}
