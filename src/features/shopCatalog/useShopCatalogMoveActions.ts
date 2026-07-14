import type { ShopCatalogDragPayload } from '@/features/shopCatalog/adminViewHelpers'
import { updateShopCatalogItem, updateShopCategory } from '@/services/shopCatalog'
import type { ShopCatalogItemRecord, ShopCategoryRecord } from '@/types/domain'

interface ReadonlyRef<T> {
  readonly value: T
}

interface UseShopCatalogMoveActionsOptions {
  categoriesById: ReadonlyRef<ReadonlyMap<string, ShopCategoryRecord>>
  ensureExpandedToCategory: (categoryId: string | null) => void
  inspectItem: (item: ShopCatalogItemRecord, options?: { showInspector?: boolean }) => void
  items: ReadonlyRef<ShopCatalogItemRecord[]>
  resetDetailMessages: () => void
  selectFolder: (categoryId: string, options?: { showInspector?: boolean }) => void
  setDetailError: (error: unknown, fallbackMessage: string) => void
  setDetailInfo: (message: string) => void
}

export function useShopCatalogMoveActions({
  categoriesById,
  ensureExpandedToCategory,
  inspectItem,
  items,
  resetDetailMessages,
  selectFolder,
  setDetailError,
  setDetailInfo,
}: UseShopCatalogMoveActionsOptions) {
  async function moveDraggedEntry(payload: ShopCatalogDragPayload, targetCategoryId: string | null) {
    resetDetailMessages()

    if (payload.kind === 'category') {
      const category = categoriesById.value.get(payload.id) ?? null
      if (!category) return

      await updateShopCategory(category.id, {
        name: category.name,
        parentId: targetCategoryId,
        active: category.active,
      })

      ensureExpandedToCategory(targetCategoryId)
      selectFolder(category.id, { showInspector: false })
      setDetailInfo(targetCategoryId ? 'Folder moved.' : 'Folder moved to top level.')
      return
    }

    const item = items.value.find((candidate) => candidate.id === payload.id) ?? null
    if (!item) return

    await updateShopCatalogItem(item.id, {
      description: item.description,
      categoryId: targetCategoryId,
      sku: item.sku ?? null,
      price: item.price,
      active: item.active,
    })

    ensureExpandedToCategory(targetCategoryId)
    inspectItem(
      {
        ...item,
        categoryId: targetCategoryId,
      },
      { showInspector: false },
    )
    setDetailInfo(targetCategoryId ? 'Item moved.' : 'Item moved to top level.')
  }

  function handleDragMoveError(error: unknown) {
    setDetailError(error, 'Failed to move catalog entry.')
  }

  return {
    handleDragMoveError,
    moveDraggedEntry,
  }
}
