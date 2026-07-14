import {
  getShopCatalogItemDisplayName,
  getShopCategoryDisplayName,
  type ShopCatalogConfirmAction,
} from '@/features/shopCatalog/adminViewHelpers'
import { deleteShopCatalogItem, deleteShopCategory } from '@/services/shopCatalog'
import type { ShopCatalogItemRecord, ShopCategoryRecord } from '@/types/domain'

interface Ref<T> {
  value: T
}

interface ReadonlyRef<T> {
  readonly value: T
}

interface UseShopCatalogDeleteActionsOptions {
  activeFolderId: Ref<string | null>
  catalogConfirmAction: Ref<ShopCatalogConfirmAction | null>
  deleteLoading: Ref<boolean>
  resetDetailMessages: () => void
  selectedCategory: ReadonlyRef<ShopCategoryRecord | null>
  selectedCategoryHasChildren: ReadonlyRef<boolean>
  selectedInspectorKey: Ref<string>
  selectedItem: ReadonlyRef<ShopCatalogItemRecord | null>
  setDetailError: (error: unknown, fallbackMessage: string) => void
  setDetailErrorMessage: (message: string) => void
}

export function useShopCatalogDeleteActions({
  activeFolderId,
  catalogConfirmAction,
  deleteLoading,
  resetDetailMessages,
  selectedCategory,
  selectedCategoryHasChildren,
  selectedInspectorKey,
  selectedItem,
  setDetailError,
  setDetailErrorMessage,
}: UseShopCatalogDeleteActionsOptions) {
  function handleDeleteCategory() {
    if (!selectedCategory.value) return

    if (selectedCategoryHasChildren.value) {
      setDetailErrorMessage('Empty the folder before deleting it.')
      return
    }

    catalogConfirmAction.value = {
      kind: 'delete-category',
      categoryId: selectedCategory.value.id,
      label: getShopCategoryDisplayName(selectedCategory.value),
      parentId: selectedCategory.value.parentId,
    }
  }

  async function confirmDeleteCategory(action: Extract<ShopCatalogConfirmAction, { kind: 'delete-category' }>) {
    resetDetailMessages()
    deleteLoading.value = true
    try {
      await deleteShopCategory(action.categoryId)
      selectedInspectorKey.value = 'root'
      activeFolderId.value = action.parentId
    } catch (error) {
      setDetailError(error, 'Failed to delete folder.')
    } finally {
      deleteLoading.value = false
      catalogConfirmAction.value = null
    }
  }

  function handleDeleteItem() {
    if (!selectedItem.value) return

    catalogConfirmAction.value = {
      kind: 'delete-item',
      itemId: selectedItem.value.id,
      label: getShopCatalogItemDisplayName(selectedItem.value),
      categoryId: selectedItem.value.categoryId,
    }
  }

  async function confirmDeleteItem(action: Extract<ShopCatalogConfirmAction, { kind: 'delete-item' }>) {
    resetDetailMessages()
    deleteLoading.value = true
    try {
      await deleteShopCatalogItem(action.itemId)
      selectedInspectorKey.value = action.categoryId ? `category:${action.categoryId}` : 'root'
      activeFolderId.value = action.categoryId
    } catch (error) {
      setDetailError(error, 'Failed to delete catalog item.')
    } finally {
      deleteLoading.value = false
      catalogConfirmAction.value = null
    }
  }

  return {
    confirmDeleteCategory,
    confirmDeleteItem,
    handleDeleteCategory,
    handleDeleteItem,
  }
}
