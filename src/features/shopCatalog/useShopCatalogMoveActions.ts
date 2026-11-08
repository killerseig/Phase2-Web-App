import type { ShopCatalogDragPayload } from '@/features/shopCatalog/adminViewHelpers'
import { watch } from 'vue'
import { useAdminRequestScope, type AdminRequestContext } from '@/features/admin/useAdminRequestContext'
import { updateShopCatalogItem, updateShopCategory } from '@/services/shopCatalog'
import type { ShopCatalogItemRecord, ShopCategoryRecord } from '@/types/domain'
import type { ReadonlyRef } from '@/types/reactivity'

interface UseShopCatalogMoveActionsOptions {
  context?: AdminRequestContext
  selectedInspectorKey?: ReadonlyRef<string>
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
  context,
  selectedInspectorKey,
  categoriesById,
  ensureExpandedToCategory,
  inspectItem,
  items,
  resetDetailMessages,
  selectFolder,
  setDetailError,
  setDetailInfo,
}: UseShopCatalogMoveActionsOptions) {
  const scope = useAdminRequestScope(context, () => selectedInspectorKey?.value)
  let moving = false
  watch(scope.revision, () => { moving = false }, { flush: 'sync' })
  async function moveDraggedEntry(payload: ShopCatalogDragPayload, targetCategoryId: string | null) {
    if (!scope.allowed.value || moving) return
    const request = scope.capture()
    moving = true
    resetDetailMessages()
    try {
    if (payload.kind === 'category') {
      const category = categoriesById.value.get(payload.id) ?? null
      if (!category) return

      await updateShopCategory(category.id, {
        name: category.name,
        parentId: targetCategoryId,
        active: category.active,
      })
      if (!request.current()) return
      moving = false

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
    if (!request.current()) return
    moving = false

    ensureExpandedToCategory(targetCategoryId)
    inspectItem(
      {
        ...item,
        categoryId: targetCategoryId,
      },
      { showInspector: false },
    )
    setDetailInfo(targetCategoryId ? 'Item moved.' : 'Item moved to top level.')
    } catch (error) {
      if (request.current()) throw error
    } finally {
      if (request.current()) moving = false
    }
  }

  function handleDragMoveError(error: unknown) {
    if (!scope.allowed.value) return
    setDetailError(error, 'Failed to move catalog entry.')
  }

  return {
    handleDragMoveError,
    moveDraggedEntry,
  }
}
