import {
  getShopCatalogDescendantCategoryIds,
  getShopCatalogItemDisplayName,
  getShopCategoryDisplayName,
  type ShopCatalogConfirmAction,
} from '@/features/shopCatalog/adminViewHelpers'
import { updateShopCatalogItem, updateShopCategory } from '@/services/shopCatalog'
import type { ShopCatalogItemRecord, ShopCategoryRecord } from '@/types/domain'

interface Ref<T> {
  value: T
}

interface ReadonlyRef<T> {
  readonly value: T
}

interface UseShopCatalogArchiveActionsOptions {
  activeFolderId: Ref<string | null>
  catalogConfirmAction: Ref<ShopCatalogConfirmAction | null>
  categoriesById: ReadonlyRef<ReadonlyMap<string, ShopCategoryRecord>>
  childCategoriesByParent: ReadonlyRef<ReadonlyMap<string | null, readonly ShopCategoryRecord[]>>
  inspectItem: (item: ShopCatalogItemRecord, options?: { showInspector?: boolean }) => void
  items: ReadonlyRef<ShopCatalogItemRecord[]>
  resetDetailMessages: () => void
  saveLoading: Ref<boolean>
  selectFolder: (categoryId: string, options?: { showInspector?: boolean }) => void
  selectedCategory: ReadonlyRef<ShopCategoryRecord | null>
  selectedInspectorKey: Ref<string>
  selectedItem: ReadonlyRef<ShopCatalogItemRecord | null>
  setDetailError: (error: unknown, fallbackMessage: string) => void
  setDetailInfo: (message: string) => void
  showArchived: ReadonlyRef<boolean>
}

export function useShopCatalogArchiveActions({
  activeFolderId,
  catalogConfirmAction,
  categoriesById,
  childCategoriesByParent,
  inspectItem,
  items,
  resetDetailMessages,
  saveLoading,
  selectFolder,
  selectedCategory,
  selectedInspectorKey,
  selectedItem,
  setDetailError,
  setDetailInfo,
  showArchived,
}: UseShopCatalogArchiveActionsOptions) {
  function getDescendantCategoryIdsWithSelf(categoryId: string) {
    const descendantIds = getShopCatalogDescendantCategoryIds(categoryId, childCategoriesByParent.value)
    descendantIds.add(categoryId)
    return Array.from(descendantIds)
  }

  function handleArchiveCategory(
    nextActive: boolean,
    categoryId = selectedCategory.value?.id ?? null,
    options?: { showInspector?: boolean },
  ) {
    if (!categoryId) return

    const category = categoriesById.value.get(categoryId) ?? null
    if (!category) return

    resetDetailMessages()

    catalogConfirmAction.value = {
      kind: 'archive-category',
      categoryId,
      label: getShopCategoryDisplayName(category),
      nextActive,
      showInspector: options?.showInspector ?? true,
    }
  }

  async function confirmArchiveCategory(action: Extract<ShopCatalogConfirmAction, { kind: 'archive-category' }>) {
    const category = categoriesById.value.get(action.categoryId) ?? null
    if (!category) {
      catalogConfirmAction.value = null
      return
    }

    resetDetailMessages()

    const nextActive = action.nextActive
    const categoryId = action.categoryId
    const actionLabel = nextActive ? 'restored' : 'archived'

    saveLoading.value = true
    try {
      const categoryIdsToUpdate = getDescendantCategoryIdsWithSelf(categoryId)
      const itemIdsToUpdate = items.value
        .filter((item) => item.categoryId != null && categoryIdsToUpdate.includes(item.categoryId))
        .map((item) => item.id)

      await Promise.all([
        ...categoryIdsToUpdate.map(async (nextCategoryId) => {
          const nextCategory = categoriesById.value.get(nextCategoryId) ?? null
          if (!nextCategory) return

          await updateShopCategory(nextCategoryId, {
            name: nextCategory.name,
            parentId: nextCategory.parentId,
            active: nextActive,
          })
        }),
        ...itemIdsToUpdate.map(async (itemId) => {
          const nextItem = items.value.find((candidate) => candidate.id === itemId) ?? null
          if (!nextItem) return

          await updateShopCatalogItem(itemId, {
            description: nextItem.description,
            categoryId: nextItem.categoryId,
            sku: nextItem.sku ?? null,
            price: nextItem.price,
            active: nextActive,
          })
        }),
      ])

      if (!nextActive && !showArchived.value) {
        activeFolderId.value = category.parentId
        selectedInspectorKey.value = category.parentId ? `category:${category.parentId}` : 'root'
      } else {
        selectFolder(categoryId, { showInspector: action.showInspector })
      }

      setDetailInfo(`Folder ${actionLabel}.`)
    } catch (error) {
      setDetailError(error, `Failed to ${nextActive ? 'restore' : 'archive'} folder.`)
    } finally {
      saveLoading.value = false
      catalogConfirmAction.value = null
    }
  }

  function handleArchiveItem(
    nextActive: boolean,
    itemId = selectedItem.value?.id ?? null,
    options?: { showInspector?: boolean },
  ) {
    if (!itemId) return

    const item = items.value.find((candidate) => candidate.id === itemId) ?? null
    if (!item) return

    resetDetailMessages()

    catalogConfirmAction.value = {
      kind: 'archive-item',
      itemId,
      label: getShopCatalogItemDisplayName(item),
      nextActive,
      showInspector: options?.showInspector ?? true,
    }
  }

  async function confirmArchiveItem(action: Extract<ShopCatalogConfirmAction, { kind: 'archive-item' }>) {
    const item = items.value.find((candidate) => candidate.id === action.itemId) ?? null
    if (!item) {
      catalogConfirmAction.value = null
      return
    }

    resetDetailMessages()

    const nextActive = action.nextActive
    const itemId = action.itemId
    const actionLabel = nextActive ? 'restored' : 'archived'

    saveLoading.value = true
    try {
      await updateShopCatalogItem(itemId, {
        description: item.description,
        categoryId: item.categoryId,
        sku: item.sku ?? null,
        price: item.price,
        active: nextActive,
      })

      if (!nextActive && !showArchived.value) {
        selectedInspectorKey.value = item.categoryId ? `category:${item.categoryId}` : 'root'
        activeFolderId.value = item.categoryId
      } else {
        inspectItem(
          {
            ...item,
            active: nextActive,
          },
          { showInspector: action.showInspector },
        )
      }

      setDetailInfo(`Item ${actionLabel}.`)
    } catch (error) {
      setDetailError(error, `Failed to ${nextActive ? 'restore' : 'archive'} item.`)
    } finally {
      saveLoading.value = false
      catalogConfirmAction.value = null
    }
  }

  return {
    confirmArchiveCategory,
    confirmArchiveItem,
    handleArchiveCategory,
    handleArchiveItem,
  }
}
