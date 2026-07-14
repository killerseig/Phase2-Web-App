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

interface Ref<T> {
  value: T
}

interface ReadonlyRef<T> {
  readonly value: T
}

interface UseShopCatalogFormActionsOptions {
  activeFolderId: Ref<string | null>
  createCategoryForm: ShopCatalogCategoryFormState
  createItemForm: ShopCatalogItemFormState
  createLoading: Ref<boolean>
  detailCategoryForm: ShopCatalogCategoryFormState
  detailItemForm: ShopCatalogItemFormState
  ensureExpandedToCategory: (categoryId: string | null) => void
  expandedCategoryIds: Ref<string[]>
  resetDetailMessages: () => void
  saveLoading: Ref<boolean>
  selectedCategory: ReadonlyRef<ShopCategoryRecord | null>
  selectedInspectorKey: Ref<string>
  selectedItem: ReadonlyRef<ShopCatalogItemRecord | null>
  setCreateError: (error: unknown, fallbackMessage: string) => void
  setCreateErrorMessage: (message: string) => void
  setDetailError: (error: unknown, fallbackMessage: string) => void
  setDetailErrorMessage: (message: string) => void
  setDetailInfo: (message: string) => void
  showInspectorPanel: () => void
}

export function useShopCatalogFormActions({
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
  async function handleCreateCategory() {
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

      activeFolderId.value = createCategoryForm.parentId
      ensureExpandedToCategory(createCategoryForm.parentId)
      expandedCategoryIds.value = Array.from(new Set([...expandedCategoryIds.value, categoryId]))
      selectedInspectorKey.value = `category:${categoryId}`
      showInspectorPanel()
    } catch (error) {
      setCreateError(error, 'Failed to create folder.')
    } finally {
      createLoading.value = false
    }
  }

  async function handleCreateItem() {
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

      activeFolderId.value = createItemForm.categoryId
      ensureExpandedToCategory(createItemForm.categoryId)
      selectedInspectorKey.value = `item:${itemId}`
      showInspectorPanel()
    } catch (error) {
      setCreateError(error, 'Failed to create catalog item.')
    } finally {
      createLoading.value = false
    }
  }

  async function handleSaveCategory() {
    if (!selectedCategory.value) return

    resetDetailMessages()

    const validationMessage = validateShopCatalogCategoryForm(detailCategoryForm)
    if (validationMessage) {
      setDetailErrorMessage(validationMessage)
      return
    }

    saveLoading.value = true
    try {
      await updateShopCategory(selectedCategory.value.id, buildShopCatalogCategoryWritePayload(detailCategoryForm))

      activeFolderId.value = selectedCategory.value.id
      ensureExpandedToCategory(detailCategoryForm.parentId)
      setDetailInfo('Folder updated.')
    } catch (error) {
      setDetailError(error, 'Failed to update folder.')
    } finally {
      saveLoading.value = false
    }
  }

  async function handleSaveItem() {
    if (!selectedItem.value) return

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

      activeFolderId.value = selectedItem.value.categoryId
      ensureExpandedToCategory(selectedItem.value.categoryId)
      setDetailInfo('Catalog item updated.')
    } catch (error) {
      setDetailError(error, 'Failed to update catalog item.')
    } finally {
      saveLoading.value = false
    }
  }

  return {
    handleCreateCategory,
    handleCreateItem,
    handleSaveCategory,
    handleSaveItem,
  }
}
