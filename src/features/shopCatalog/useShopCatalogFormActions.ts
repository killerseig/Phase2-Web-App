import { watch } from 'vue'
import { useAdminRequestScope, type AdminRequestContext } from '@/features/admin/useAdminRequestContext'
import {
  buildShopCatalogCategoryWritePayload,
  buildShopCatalogItemWritePayload,
  validateShopCatalogCategoryForm,
  validateShopCatalogItemForm,
  type ShopCatalogCategoryFormState,
  type ShopCatalogItemFormState,
} from '@/features/shopCatalog/adminViewHelpers'
import {
  createShopCatalogItem,
  createShopCategory,
  updateShopCatalogItem,
  updateShopCategory,
} from '@/services/shopCatalog'
import type { ShopCatalogItemRecord, ShopCategoryRecord } from '@/types/domain'
import type { ReadonlyRef, WritableRef } from '@/types/reactivity'

interface UseShopCatalogFormActionsOptions {
  context?: AdminRequestContext
  activeFolderId: WritableRef<string | null>
  createCategoryForm: ShopCatalogCategoryFormState
  createItemForm: ShopCatalogItemFormState
  createLoading: WritableRef<boolean>
  detailCategoryForm: ShopCatalogCategoryFormState
  detailItemForm: ShopCatalogItemFormState
  ensureExpandedToCategory: (categoryId: string | null) => void
  expandedCategoryIds: WritableRef<string[]>
  resetDetailMessages: () => void
  saveLoading: WritableRef<boolean>
  selectedCategory: ReadonlyRef<ShopCategoryRecord | null>
  selectedInspectorKey: WritableRef<string>
  selectedItem: ReadonlyRef<ShopCatalogItemRecord | null>
  setCreateError: (error: unknown, fallbackMessage: string) => void
  setCreateErrorMessage: (message: string) => void
  setDetailError: (error: unknown, fallbackMessage: string) => void
  setDetailErrorMessage: (message: string) => void
  setDetailInfo: (message: string) => void
  showInspectorPanel: () => void
}

export function useShopCatalogFormActions({
  context,
  activeFolderId,
  createCategoryForm,
  createItemForm,
  createLoading,
  detailCategoryForm,
  detailItemForm,
  ensureExpandedToCategory,
  expandedCategoryIds,
  resetDetailMessages,
  saveLoading,
  selectedCategory,
  selectedInspectorKey,
  selectedItem,
  setCreateError,
  setCreateErrorMessage,
  setDetailError,
  setDetailErrorMessage,
  setDetailInfo,
  showInspectorPanel,
}: UseShopCatalogFormActionsOptions) {
  const createScope = useAdminRequestScope(context, () => selectedInspectorKey.value, () => [createCategoryForm, createItemForm])
  const detailScope = useAdminRequestScope(context, () => selectedInspectorKey.value, () => [detailCategoryForm, detailItemForm])
  watch(createScope.revision, () => { createLoading.value = false }, { flush: 'sync' })
  watch(detailScope.revision, () => { saveLoading.value = false }, { flush: 'sync' })
  async function handleCreateCategory() {
    if (!createScope.allowed.value || createLoading.value) return
    const request = createScope.capture()
    setCreateErrorMessage('')
    setDetailInfo('')

    const validationMessage = validateShopCatalogCategoryForm(createCategoryForm)
    if (validationMessage) {
      setCreateErrorMessage(validationMessage)
      return
    }

    createLoading.value = true
    try {
      const categoryId = await createShopCategory(buildShopCatalogCategoryWritePayload(createCategoryForm))
      if (!request.draftCurrent()) return
      createLoading.value = false

      activeFolderId.value = createCategoryForm.parentId
      ensureExpandedToCategory(createCategoryForm.parentId)
      expandedCategoryIds.value = Array.from(new Set([...expandedCategoryIds.value, categoryId]))
      selectedInspectorKey.value = `category:${categoryId}`
      showInspectorPanel()
    } catch (error) {
      if (request.draftCurrent()) setCreateError(error, 'Failed to create folder.')
    } finally {
      if (request.current()) createLoading.value = false
    }
  }

  async function handleCreateItem() {
    if (!createScope.allowed.value || createLoading.value) return
    const request = createScope.capture()
    setCreateErrorMessage('')
    setDetailInfo('')

    const validationMessage = validateShopCatalogItemForm(createItemForm)
    if (validationMessage) {
      setCreateErrorMessage(validationMessage)
      return
    }

    createLoading.value = true
    try {
      const itemId = await createShopCatalogItem(buildShopCatalogItemWritePayload(createItemForm))
      if (!request.draftCurrent()) return
      createLoading.value = false

      activeFolderId.value = createItemForm.categoryId
      ensureExpandedToCategory(createItemForm.categoryId)
      selectedInspectorKey.value = `item:${itemId}`
      showInspectorPanel()
    } catch (error) {
      if (request.draftCurrent()) setCreateError(error, 'Failed to create catalog item.')
    } finally {
      if (request.current()) createLoading.value = false
    }
  }

  async function handleSaveCategory() {
    if (!detailScope.allowed.value || !selectedCategory.value || saveLoading.value) return
    const request = detailScope.capture()

    resetDetailMessages()

    const validationMessage = validateShopCatalogCategoryForm(detailCategoryForm)
    if (validationMessage) {
      setDetailErrorMessage(validationMessage)
      return
    }

    saveLoading.value = true
    try {
      await updateShopCategory(selectedCategory.value.id, buildShopCatalogCategoryWritePayload(detailCategoryForm))
      if (!request.draftCurrent()) return

      activeFolderId.value = selectedCategory.value.id
      ensureExpandedToCategory(detailCategoryForm.parentId)
      setDetailInfo('Folder updated.')
    } catch (error) {
      if (request.draftCurrent()) setDetailError(error, 'Failed to update folder.')
    } finally {
      if (request.current()) saveLoading.value = false
    }
  }

  async function handleSaveItem() {
    if (!detailScope.allowed.value || !selectedItem.value || saveLoading.value) return
    const request = detailScope.capture()

    resetDetailMessages()

    const validationMessage = validateShopCatalogItemForm(detailItemForm)
    if (validationMessage) {
      setDetailErrorMessage(validationMessage)
      return
    }

    saveLoading.value = true
    try {
      await updateShopCatalogItem(
        selectedItem.value.id,
        buildShopCatalogItemWritePayload(detailItemForm, selectedItem.value.categoryId),
      )
      if (!request.draftCurrent()) return

      activeFolderId.value = selectedItem.value.categoryId
      ensureExpandedToCategory(selectedItem.value.categoryId)
      setDetailInfo('Catalog item updated.')
    } catch (error) {
      if (request.draftCurrent()) setDetailError(error, 'Failed to update catalog item.')
    } finally {
      if (request.current()) saveLoading.value = false
    }
  }

  return {
    handleCreateCategory,
    handleCreateItem,
    handleSaveCategory,
    handleSaveItem,
  }
}
