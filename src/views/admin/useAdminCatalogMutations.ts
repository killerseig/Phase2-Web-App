import { ref, type Ref } from 'vue'
import type { ToastNotifier } from '@/composables/useToast'
import {
  deleteCatalogItem as deleteCatalogItemService,
  deleteCategory as deleteCategoryService,
  type ShopCatalogItem,
} from '@/services'
import { normalizeError } from '@/services/serviceUtils'
import { useShopCatalogStore } from '@/stores/shopCatalog'
import type { ConfirmVariant } from '@/stores/confirm'
import { type ShopCategory, useShopCategoriesStore } from '@/stores/shopCategories'
import {
  collectCatalogSubtreeDescendants,
  createCatalogItemNodeId,
  isCatalogItemNodeId,
  type CatalogTreeChildNodeMap,
} from '@/utils/catalogTree'
import { logError } from '@/utils'

type ConfirmFn = (
  message: string,
  options?: {
    title?: string
    confirmText?: string
    variant?: ConfirmVariant
  },
) => Promise<boolean>

type UseAdminCatalogMutationsOptions = {
  categoriesStore: ReturnType<typeof useShopCategoriesStore>
  catalogStore: ReturnType<typeof useShopCatalogStore>
  categories: Ref<ShopCategory[]>
  allItems: Ref<ShopCatalogItem[]>
  getChildIds: () => CatalogTreeChildNodeMap
  confirm: ConfirmFn
  toast: ToastNotifier
}

export function useAdminCatalogMutations(options: UseAdminCatalogMutationsOptions) {
  const saving = ref(false)
  const editingItemId = ref<string | null>(null)
  const editingCategoryId = ref<string | null>(null)
  const editCategoryName = ref('')
  const editCategoryNameOriginal = ref('')
  const savingCategoryEdit = ref(false)
  const inlineDraftItem = ref<ShopCatalogItem | null>(null)

  const collectDeleteSubtree = (rootNodeId: string) =>
    collectCatalogSubtreeDescendants(options.getChildIds(), rootNodeId)

  const deleteTreeNode = async (nodeId: string) => {
    if (isCatalogItemNodeId(nodeId)) {
      await deleteCatalogItemService(nodeId.slice('item-'.length))
      return
    }

    await deleteCategoryService(nodeId)
  }

  async function createCategory(name: string, parentId: string | null) {
    const nextName = name.trim()
    if (!nextName) return

    saving.value = true
    try {
      await options.categoriesStore.createCategory(nextName, parentId)
      options.toast.show(`Category "${nextName}" created`, 'success')
    } catch {
      options.toast.show('Failed to create category', 'error')
    } finally {
      saving.value = false
    }
  }

  async function createItem(
    description: string,
    categoryId?: string,
    sku?: string,
    price?: number,
  ) {
    const nextDescription = description.trim()
    if (!nextDescription) return

    saving.value = true
    try {
      await options.catalogStore.createItem(nextDescription, categoryId, sku, price)
      options.toast.show('Item added', 'success')
    } catch {
      options.toast.show('Failed to add item', 'error')
    } finally {
      saving.value = false
    }
  }

  async function archiveCategory(categoryId: string) {
    const category = options.categoriesStore.getCategoryById(categoryId)
    if (!category) return

    saving.value = true
    try {
      await options.categoriesStore.archiveCategory(categoryId)
      options.toast.show(`Archived "${category.name}"`, 'success')
    } catch {
      options.toast.show('Failed to archive category', 'error')
    } finally {
      saving.value = false
    }
  }

  async function reactivateCategory(categoryId: string) {
    const visited = new Set<string>()
    const MAX_DEPTH = 100
    const reactivateRecursive = async (id: string, depth = 0): Promise<void> => {
      if (depth > MAX_DEPTH || visited.has(id)) return
      visited.add(id)

      const current = options.categoriesStore.getCategoryById(id)
      if (!current) return

      await options.categoriesStore.reactivateCategory(id)

      if (!current.parentId) return

      if (current.parentId.startsWith('item-')) {
        const itemId = current.parentId.slice(5)
        const item = options.allItems.value.find((entry) => entry.id === itemId)
        if (item && !item.active) {
          await options.catalogStore.setItemActive(itemId, true)
        }
        return
      }

      const parentCategory = options.categoriesStore.getCategoryById(current.parentId)
      if (parentCategory && !parentCategory.active) {
        await reactivateRecursive(current.parentId, depth + 1)
      }
    }

    const category = options.categoriesStore.getCategoryById(categoryId)
    if (!category) return

    saving.value = true
    try {
      await reactivateRecursive(categoryId)
      options.toast.show(`Reactivated "${category.name}"`, 'success')
    } catch (error) {
      logError('AdminShopCatalog', 'Error reactivating category', error)
      options.toast.show('Failed to reactivate category', 'error')
    } finally {
      saving.value = false
    }
  }

  async function deleteCategory(categoryId: string) {
    const category = options.categoriesStore.getCategoryById(categoryId)
    if (!category) return

    const subtree = collectDeleteSubtree(categoryId)
    const totalDescendants = subtree.descendantCategoryIds.length + subtree.descendantItemIds.length
    const confirmed = await options.confirm(
      totalDescendants > 0
        ? `Delete "${category.name}" and ${totalDescendants} descendant item(s)/category(ies)? This cannot be undone.`
        : `Delete "${category.name}"? This cannot be undone.`,
      {
        title: 'Delete Category',
        confirmText: 'Delete',
        variant: 'danger',
      },
    )
    if (!confirmed) return

    const categoryIdsToDelete = [...subtree.descendantCategoryIds, categoryId]
    const rollbackItems = options.catalogStore.beginOptimisticDelete(subtree.descendantItemIds)
    const rollbackCategories = options.categoriesStore.beginOptimisticDelete(categoryIdsToDelete)
    const inlineDraftNodeId = inlineDraftItem.value ? createCatalogItemNodeId(inlineDraftItem.value.id) : null
    const shouldClearInlineDraft = !!inlineDraftNodeId && subtree.descendantNodeIds.includes(inlineDraftNodeId)
    const previousInlineDraft = shouldClearInlineDraft ? inlineDraftItem.value : null

    if (shouldClearInlineDraft) {
      inlineDraftItem.value = null
      if (editingItemId.value === previousInlineDraft?.id) {
        editingItemId.value = null
      }
    }

    saving.value = true
    try {
      for (const nodeId of subtree.descendantNodeIds) {
        await deleteTreeNode(nodeId)
      }

      await deleteCategoryService(categoryId)
      rollbackItems.commit()
      rollbackCategories.commit()
      options.toast.show(
        `Deleted "${category.name}"${totalDescendants ? ` with ${totalDescendants} descendants` : ''}`,
        'success',
      )
    } catch {
      rollbackItems.rollback()
      rollbackCategories.rollback()
      if (previousInlineDraft) {
        inlineDraftItem.value = previousInlineDraft
        editingItemId.value = previousInlineDraft.id
      }
      options.toast.show('Failed to delete category', 'error')
    } finally {
      saving.value = false
    }
  }

  function editItem(item: ShopCatalogItem) {
    editingItemId.value = item.id
  }

  async function saveItemFromTree(
    itemId: string,
    updates: { description?: string; sku?: string | null; price?: number | null },
  ) {
    if (inlineDraftItem.value?.id === itemId) {
      const description = updates.description?.trim() ?? ''
      if (!description) return

      const draftParentId = inlineDraftItem.value.categoryId
      editingItemId.value = null
      saving.value = true
      try {
        await options.catalogStore.createItem(
          description,
          draftParentId,
          updates.sku ?? undefined,
          updates.price ?? undefined,
        )
        inlineDraftItem.value = null
        options.toast.show('Item added', 'success')
      } catch (error) {
        editingItemId.value = itemId
        logError('AdminShopCatalog', 'Failed to create inline item', error)
        options.toast.show(`Failed to add item: ${normalizeError(error, 'Unknown error')}`, 'error')
      } finally {
        saving.value = false
      }
      return
    }

    editingItemId.value = null
    saving.value = true
    try {
      await options.catalogStore.updateItem(itemId, updates)
      options.toast.show('Item updated', 'success')
    } catch (error) {
      logError('AdminShopCatalog', 'Failed to update item', error)
      options.toast.show(`Failed to update item: ${normalizeError(error, 'Unknown error')}`, 'error')
    } finally {
      saving.value = false
    }
  }

  function editCategory(categoryId: string) {
    const category = options.categoriesStore.getCategoryById(categoryId)
    if (!category) return

    editingCategoryId.value = categoryId
    editCategoryName.value = category.name
    editCategoryNameOriginal.value = category.name
  }

  async function saveCategoryEdit(categoryId: string, updates: { name: string }) {
    const nextName = updates.name.trim()
    if (!nextName) {
      options.toast.show('Category name is required', 'error')
      return
    }

    if (nextName === editCategoryNameOriginal.value) {
      editingCategoryId.value = null
      return
    }

    editingCategoryId.value = null
    savingCategoryEdit.value = true
    try {
      await options.categoriesStore.updateCategory(categoryId, { name: nextName })
      options.toast.show('Category updated', 'success')
    } catch {
      options.toast.show('Failed to update category', 'error')
    } finally {
      savingCategoryEdit.value = false
    }
  }

  function cancelCategoryEdit() {
    editingCategoryId.value = null
    editCategoryName.value = ''
    editCategoryNameOriginal.value = ''
  }

  function cancelItemEdit() {
    if (inlineDraftItem.value && editingItemId.value === inlineDraftItem.value.id) {
      inlineDraftItem.value = null
    }
    editingItemId.value = null
  }

  async function deleteItem(item: ShopCatalogItem) {
    const subtree = collectDeleteSubtree(createCatalogItemNodeId(item.id))
    const cascadeCount = subtree.descendantCategoryIds.length + subtree.descendantItemIds.length
    const confirmed = await options.confirm(
      cascadeCount > 0
        ? `Delete "${item.description}" and ${cascadeCount} descendant item(s)/category(ies)? This cannot be undone.`
        : `Delete "${item.description}"? This cannot be undone.`,
      {
        title: 'Delete Item',
        confirmText: 'Delete',
        variant: 'danger',
      },
    )
    if (!confirmed) return

    const itemIdsToDelete = [...subtree.descendantItemIds, item.id]
    const rollbackItems = options.catalogStore.beginOptimisticDelete(itemIdsToDelete)
    const rollbackCategories = options.categoriesStore.beginOptimisticDelete(subtree.descendantCategoryIds)
    const inlineDraftNodeId = inlineDraftItem.value ? createCatalogItemNodeId(inlineDraftItem.value.id) : null
    const shouldClearInlineDraft = !!inlineDraftNodeId && subtree.descendantNodeIds.includes(inlineDraftNodeId)
    const previousInlineDraft = shouldClearInlineDraft ? inlineDraftItem.value : null

    if (shouldClearInlineDraft) {
      inlineDraftItem.value = null
      if (editingItemId.value === previousInlineDraft?.id) {
        editingItemId.value = null
      }
    }

    saving.value = true
    try {
      for (const nodeId of subtree.descendantNodeIds) {
        await deleteTreeNode(nodeId)
      }

      await deleteCatalogItemService(item.id)
      rollbackItems.commit()
      rollbackCategories.commit()
      options.toast.show(
        cascadeCount > 0 ? `Item and ${cascadeCount} descendants deleted` : 'Item deleted',
        'success',
      )
    } catch {
      rollbackItems.rollback()
      rollbackCategories.rollback()
      if (previousInlineDraft) {
        inlineDraftItem.value = previousInlineDraft
        editingItemId.value = previousInlineDraft.id
      }
      options.toast.show('Failed to delete item', 'error')
    } finally {
      saving.value = false
    }
  }

  async function archiveItem(item: ShopCatalogItem) {
    saving.value = true
    try {
      const childCategories = options.categories.value.filter((category) => category.parentId === `item-${item.id}`)

      await Promise.all([
        options.catalogStore.setItemActive(item.id, false),
        ...childCategories.map((category) => options.categoriesStore.archiveCategory(category.id)),
      ])

      options.toast.show(
        `Archived "${item.description}" and ${childCategories.length} subcategories`,
        'success',
      )
    } catch {
      options.toast.show('Failed to archive item', 'error')
    } finally {
      saving.value = false
    }
  }

  async function reactivateItem(item: ShopCatalogItem) {
    saving.value = true
    try {
      await options.catalogStore.setItemActive(item.id, true)
      options.toast.show(`Reactivated "${item.description}"`, 'success')
    } catch {
      options.toast.show('Failed to reactivate item', 'error')
    } finally {
      saving.value = false
    }
  }

  return {
    saving,
    editingItemId,
    editingCategoryId,
    editCategoryName,
    savingCategoryEdit,
    inlineDraftItem,
    createCategory,
    createItem,
    archiveCategory,
    reactivateCategory,
    deleteCategory,
    editItem,
    saveItemFromTree,
    editCategory,
    saveCategoryEdit,
    cancelCategoryEdit,
    cancelItemEdit,
    deleteItem,
    archiveItem,
    reactivateItem,
  }
}
