import type { ShopCatalogItemRecord } from '@/types/domain'

interface ReadonlyRef<T> {
  readonly value: T
}

interface UseShopCatalogContextDeleteActionsOptions {
  closeContextMenu: () => void
  handleDeleteCategory: () => void
  handleDeleteItem: () => void
  inspectItem: (item: ShopCatalogItemRecord, options?: { showInspector?: boolean }) => void
  items: ReadonlyRef<ShopCatalogItemRecord[]>
  selectFolder: (categoryId: string, options?: { showInspector?: boolean }) => void
}

export function useShopCatalogContextDeleteActions({
  closeContextMenu,
  handleDeleteCategory,
  handleDeleteItem,
  inspectItem,
  items,
  selectFolder,
}: UseShopCatalogContextDeleteActionsOptions) {
  function deleteCategoryFromContext(categoryId: string) {
    selectFolder(categoryId, { showInspector: false })
    closeContextMenu()
    void handleDeleteCategory()
  }

  function deleteItemFromContext(itemId: string) {
    const item = items.value.find((candidate) => candidate.id === itemId)
    if (item) {
      inspectItem(item, { showInspector: false })
    }

    closeContextMenu()
    void handleDeleteItem()
  }

  return {
    deleteCategoryFromContext,
    deleteItemFromContext,
  }
}
