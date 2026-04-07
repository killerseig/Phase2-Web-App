import {
  deleteCatalogItem as deleteCatalogItemService,
  deleteCategory as deleteCategoryService,
  type ShopCatalogItem,
} from '@/services'
import {
  createCatalogItemNodeId,
  collectCatalogSubtreeDescendants,
  getCatalogItemIdFromNodeId,
  isCatalogItemNodeId,
} from '@/utils/catalogTree'
import type {
  AdminCatalogMutationState,
  UseAdminCatalogMutationsOptions,
} from './adminCatalogMutationTypes'

type InlineDraftSnapshot = ShopCatalogItem | null

type CatalogDeleteSubtree = ReturnType<typeof collectCatalogSubtreeDescendants>

type CascadeDeleteOptions = {
  affectedNodeIds: string[]
  confirmMessage: string
  confirmTitle: string
  descendantNodeIds: string[]
  optimisticItemIds: string[]
  optimisticCategoryIds: string[]
  deleteRoot: () => Promise<void>
  successMessage: string
  failureMessage: string
}

async function deleteTreeNode(nodeId: string) {
  if (isCatalogItemNodeId(nodeId)) {
    const itemId = getCatalogItemIdFromNodeId(nodeId)
    if (itemId) {
      await deleteCatalogItemService(itemId)
    }
    return
  }

  await deleteCategoryService(nodeId)
}

function clearInlineDraftIfNeeded(
  state: AdminCatalogMutationState,
  affectedNodeIds: readonly string[],
): InlineDraftSnapshot {
  const inlineDraft = state.inlineDraftItem.value
  if (!inlineDraft) return null

  const inlineDraftNodeId = createCatalogItemNodeId(inlineDraft.id)
  if (!affectedNodeIds.includes(inlineDraftNodeId)) return null

  state.inlineDraftItem.value = null
  if (state.editingItemId.value === inlineDraft.id) {
    state.editingItemId.value = null
  }

  return inlineDraft
}

function restoreInlineDraft(
  state: AdminCatalogMutationState,
  previousInlineDraft: InlineDraftSnapshot,
) {
  if (!previousInlineDraft) return

  state.inlineDraftItem.value = previousInlineDraft
  state.editingItemId.value = previousInlineDraft.id
}

function pruneInlineDraftFromSubtree(
  state: AdminCatalogMutationState,
  subtree: CatalogDeleteSubtree,
): CatalogDeleteSubtree {
  const inlineDraftId = state.inlineDraftItem.value?.id
  if (!inlineDraftId) return subtree

  const inlineDraftNodeId = createCatalogItemNodeId(inlineDraftId)

  return {
    descendantNodeIds: subtree.descendantNodeIds.filter((nodeId) => nodeId !== inlineDraftNodeId),
    descendantCategoryIds: subtree.descendantCategoryIds,
    descendantItemIds: subtree.descendantItemIds.filter((itemId) => itemId !== inlineDraftId),
  }
}

function discardInlineDraftItemIfNeeded(
  state: AdminCatalogMutationState,
  itemId: string,
): boolean {
  return !!clearInlineDraftIfNeeded(state, [createCatalogItemNodeId(itemId)])
}

export function useAdminCatalogDeleteActions(
  options: UseAdminCatalogMutationsOptions,
  state: AdminCatalogMutationState,
) {
  async function runCascadeDelete(config: CascadeDeleteOptions) {
    const confirmed = await options.confirm(config.confirmMessage, {
      title: config.confirmTitle,
      confirmText: 'Delete',
      variant: 'danger',
    })
    if (!confirmed) return

    const rollbackItems = options.catalogStore.beginOptimisticDelete(config.optimisticItemIds)
    const rollbackCategories = options.categoriesStore.beginOptimisticDelete(config.optimisticCategoryIds)
    const previousInlineDraft = clearInlineDraftIfNeeded(state, config.affectedNodeIds)

    state.saving.value = true
    try {
      for (const nodeId of config.descendantNodeIds) {
        await deleteTreeNode(nodeId)
      }

      await config.deleteRoot()
      rollbackItems.commit()
      rollbackCategories.commit()
      options.toast.show(config.successMessage, 'success')
    } catch {
      rollbackItems.rollback()
      rollbackCategories.rollback()
      restoreInlineDraft(state, previousInlineDraft)
      options.toast.show(config.failureMessage, 'error')
    } finally {
      state.saving.value = false
    }
  }

  async function deleteCategory(categoryId: string) {
    const category = options.categoriesStore.getCategoryById(categoryId)
    if (!category) return

    const rawSubtree = collectCatalogSubtreeDescendants(options.getChildIds(), categoryId)
    const subtree = pruneInlineDraftFromSubtree(state, rawSubtree)
    const totalDescendants = subtree.descendantCategoryIds.length + subtree.descendantItemIds.length

    await runCascadeDelete({
      affectedNodeIds: rawSubtree.descendantNodeIds,
      confirmMessage: totalDescendants > 0
        ? `Delete "${category.name}" and ${totalDescendants} descendant item(s)/category(ies)? This cannot be undone.`
        : `Delete "${category.name}"? This cannot be undone.`,
      confirmTitle: 'Delete Category',
      descendantNodeIds: subtree.descendantNodeIds,
      optimisticItemIds: subtree.descendantItemIds,
      optimisticCategoryIds: [...subtree.descendantCategoryIds, categoryId],
      deleteRoot: () => deleteCategoryService(categoryId),
      successMessage: `Deleted "${category.name}"${totalDescendants ? ` with ${totalDescendants} descendants` : ''}`,
      failureMessage: 'Failed to delete category',
    })
  }

  async function deleteItem(item: ShopCatalogItem) {
    if (discardInlineDraftItemIfNeeded(state, item.id)) {
      return
    }

    const rootNodeId = createCatalogItemNodeId(item.id)
    const rawSubtree = collectCatalogSubtreeDescendants(options.getChildIds(), rootNodeId)
    const subtree = pruneInlineDraftFromSubtree(state, rawSubtree)
    const cascadeCount = subtree.descendantCategoryIds.length + subtree.descendantItemIds.length

    await runCascadeDelete({
      affectedNodeIds: rawSubtree.descendantNodeIds,
      confirmMessage: cascadeCount > 0
        ? `Delete "${item.description}" and ${cascadeCount} descendant item(s)/category(ies)? This cannot be undone.`
        : `Delete "${item.description}"? This cannot be undone.`,
      confirmTitle: 'Delete Item',
      descendantNodeIds: subtree.descendantNodeIds,
      optimisticItemIds: [...subtree.descendantItemIds, item.id],
      optimisticCategoryIds: subtree.descendantCategoryIds,
      deleteRoot: () => deleteCatalogItemService(item.id),
      successMessage: cascadeCount > 0 ? `Item and ${cascadeCount} descendants deleted` : 'Item deleted',
      failureMessage: 'Failed to delete item',
    })
  }

  return {
    deleteCategory,
    deleteItem,
  }
}
