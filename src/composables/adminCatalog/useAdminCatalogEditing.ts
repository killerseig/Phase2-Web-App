import { normalizeError } from '@/services/serviceUtils'
import type { ShopCatalogItem } from '@/services'
import { runAdminCatalogMutation } from './adminCatalogMutationRunner'
import type {
  AdminCatalogMutationState,
  UseAdminCatalogMutationsOptions,
} from './adminCatalogMutationTypes'
import type {
  AdminCatalogCategoryUpdates,
  AdminCatalogItemUpdates,
} from './adminCatalogTreeTypes'

export function useAdminCatalogEditing(
  options: UseAdminCatalogMutationsOptions,
  state: AdminCatalogMutationState,
) {
  async function createCategory(name: string, parentId: string | null) {
    const nextName = name.trim()
    if (!nextName) return

    await runAdminCatalogMutation(
      () => options.categoriesStore.createCategory(nextName, parentId),
      {
        pending: state.saving,
        toast: options.toast,
        successMessage: `Category "${nextName}" created`,
        errorMessage: 'Failed to create category',
      },
    )
  }

  async function createItem(
    description: string,
    categoryId?: string,
    sku?: string,
    price?: number,
  ) {
    const nextDescription = description.trim()
    if (!nextDescription) return

    await runAdminCatalogMutation(
      () => options.catalogStore.createItem(nextDescription, categoryId, sku, price),
      {
        pending: state.saving,
        toast: options.toast,
        successMessage: 'Item added',
        errorMessage: 'Failed to add item',
      },
    )
  }

  function editItem(item: ShopCatalogItem) {
    state.editingItemId.value = item.id
  }

  async function saveInlineDraftItem(itemId: string, updates: AdminCatalogItemUpdates) {
    const description = updates.description?.trim() ?? ''
    if (!description) return

    const draftParentId = state.inlineDraftItem.value?.categoryId
    state.editingItemId.value = null
    await runAdminCatalogMutation(
      () => options.catalogStore.createItem(
        description,
        draftParentId,
        updates.sku ?? undefined,
        updates.price ?? undefined,
      ),
      {
        pending: state.saving,
        toast: options.toast,
        successMessage: 'Item added',
        errorMessage: (error) => `Failed to add item: ${normalizeError(error, 'Unknown error')}`,
        logContext: {
          scope: 'AdminShopCatalog',
          message: 'Failed to create inline item',
        },
        onSuccess: () => {
          state.inlineDraftItem.value = null
        },
        onError: () => {
          state.editingItemId.value = itemId
        },
      },
    )
  }

  async function saveExistingItem(itemId: string, updates: AdminCatalogItemUpdates) {
    state.editingItemId.value = null
    await runAdminCatalogMutation(
      () => options.catalogStore.updateItem(itemId, updates),
      {
        pending: state.saving,
        toast: options.toast,
        successMessage: 'Item updated',
        errorMessage: (error) => `Failed to update item: ${normalizeError(error, 'Unknown error')}`,
        logContext: {
          scope: 'AdminShopCatalog',
          message: 'Failed to update item',
        },
      },
    )
  }

  async function saveItemFromTree(itemId: string, updates: AdminCatalogItemUpdates) {
    if (state.inlineDraftItem.value?.id === itemId) {
      await saveInlineDraftItem(itemId, updates)
      return
    }

    await saveExistingItem(itemId, updates)
  }

  function editCategory(categoryId: string) {
    const category = options.categoriesStore.getCategoryById(categoryId)
    if (!category) return

    state.editingCategoryId.value = categoryId
    state.editCategoryName.value = category.name
    state.editCategoryNameOriginal.value = category.name
  }

  async function saveCategoryEdit(categoryId: string, updates: AdminCatalogCategoryUpdates) {
    const nextName = updates.name.trim()
    if (!nextName) {
      options.toast.show('Category name is required', 'error')
      return
    }

    if (nextName === state.editCategoryNameOriginal.value) {
      state.editingCategoryId.value = null
      return
    }

    state.editingCategoryId.value = null
    await runAdminCatalogMutation(
      () => options.categoriesStore.updateCategory(categoryId, { name: nextName }),
      {
        pending: state.savingCategoryEdit,
        toast: options.toast,
        successMessage: 'Category updated',
        errorMessage: 'Failed to update category',
      },
    )
  }

  function cancelCategoryEdit() {
    state.editingCategoryId.value = null
    state.editCategoryName.value = ''
    state.editCategoryNameOriginal.value = ''
  }

  function cancelItemEdit() {
    if (state.inlineDraftItem.value && state.editingItemId.value === state.inlineDraftItem.value.id) {
      state.inlineDraftItem.value = null
    }
    state.editingItemId.value = null
  }

  return {
    createCategory,
    createItem,
    editItem,
    saveItemFromTree,
    editCategory,
    saveCategoryEdit,
    cancelCategoryEdit,
    cancelItemEdit,
  }
}
