import { watch } from 'vue'
import { useAdminRequestScope, type AdminRequestContext } from '@/features/admin/useAdminRequestContext'
import {
  getShopCatalogItemDisplayName,
  getShopCategoryDisplayName,
  type ShopCatalogConfirmAction,
} from '@/features/shopCatalog/adminViewHelpers'
import { deleteShopCatalogItem, deleteShopCategory } from '@/services/shopCatalog'
import type { ShopCatalogItemRecord, ShopCategoryRecord } from '@/types/domain'
import type { ReadonlyRef, WritableRef } from '@/types/reactivity'

interface UseShopCatalogDeleteActionsOptions {
  context?: AdminRequestContext
  activeFolderId: WritableRef<string | null>
  catalogConfirmAction: WritableRef<ShopCatalogConfirmAction | null>
  deleteLoading: WritableRef<boolean>
  resetDetailMessages: () => void
  selectedCategory: ReadonlyRef<ShopCategoryRecord | null>
  selectedCategoryHasChildren: ReadonlyRef<boolean>
  selectedInspectorKey: WritableRef<string>
  selectedItem: ReadonlyRef<ShopCatalogItemRecord | null>
  setDetailError: (error: unknown, fallbackMessage: string) => void
  setDetailErrorMessage: (message: string) => void
}

export function useShopCatalogDeleteActions({
  context,
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
  const scope = useAdminRequestScope(context, () => selectedInspectorKey.value)
  watch(scope.revision, () => { deleteLoading.value = false; catalogConfirmAction.value = null }, { flush: 'sync' })
  function handleDeleteCategory() {
    if (!scope.allowed.value || deleteLoading.value || !selectedCategory.value) return

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
    if (!scope.allowed.value || deleteLoading.value || catalogConfirmAction.value !== action) return
    const request = scope.capture()
    resetDetailMessages()
    deleteLoading.value = true
    try {
      await deleteShopCategory(action.categoryId)
      if (!request.current()) return
      deleteLoading.value = false
      catalogConfirmAction.value = null
      selectedInspectorKey.value = 'root'
      activeFolderId.value = action.parentId
    } catch (error) {
      if (request.current()) setDetailError(error, 'Failed to delete folder.')
    } finally {
      if (request.current()) { deleteLoading.value = false; catalogConfirmAction.value = null }
    }
  }

  function handleDeleteItem() {
    if (!scope.allowed.value || deleteLoading.value || !selectedItem.value) return

    catalogConfirmAction.value = {
      kind: 'delete-item',
      itemId: selectedItem.value.id,
      label: getShopCatalogItemDisplayName(selectedItem.value),
      categoryId: selectedItem.value.categoryId,
    }
  }

  async function confirmDeleteItem(action: Extract<ShopCatalogConfirmAction, { kind: 'delete-item' }>) {
    if (!scope.allowed.value || deleteLoading.value || catalogConfirmAction.value !== action) return
    const request = scope.capture()
    resetDetailMessages()
    deleteLoading.value = true
    try {
      await deleteShopCatalogItem(action.itemId)
      if (!request.current()) return
      deleteLoading.value = false
      catalogConfirmAction.value = null
      selectedInspectorKey.value = action.categoryId ? `category:${action.categoryId}` : 'root'
      activeFolderId.value = action.categoryId
    } catch (error) {
      if (request.current()) setDetailError(error, 'Failed to delete catalog item.')
    } finally {
      if (request.current()) { deleteLoading.value = false; catalogConfirmAction.value = null }
    }
  }

  return {
    confirmDeleteCategory,
    confirmDeleteItem,
    handleDeleteCategory,
    handleDeleteItem,
  }
}
