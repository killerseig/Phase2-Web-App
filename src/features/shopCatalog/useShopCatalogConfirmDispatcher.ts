import type { ShopCatalogConfirmAction } from '@/features/shopCatalog/adminViewHelpers'

interface Ref<T> {
  value: T
}

interface UseShopCatalogConfirmDispatcherOptions {
  catalogConfirmAction: Ref<ShopCatalogConfirmAction | null>
  confirmArchiveCategory: (action: Extract<ShopCatalogConfirmAction, { kind: 'archive-category' }>) => Promise<void>
  confirmArchiveItem: (action: Extract<ShopCatalogConfirmAction, { kind: 'archive-item' }>) => Promise<void>
  confirmDeleteCategory: (action: Extract<ShopCatalogConfirmAction, { kind: 'delete-category' }>) => Promise<void>
  confirmDeleteItem: (action: Extract<ShopCatalogConfirmAction, { kind: 'delete-item' }>) => Promise<void>
}

export function useShopCatalogConfirmDispatcher({
  catalogConfirmAction,
  confirmArchiveCategory,
  confirmArchiveItem,
  confirmDeleteCategory,
  confirmDeleteItem,
}: UseShopCatalogConfirmDispatcherOptions) {
  async function confirmCatalogAction() {
    const action = catalogConfirmAction.value
    if (!action) return

    if (action.kind === 'archive-category') {
      await confirmArchiveCategory(action)
      return
    }

    if (action.kind === 'archive-item') {
      await confirmArchiveItem(action)
      return
    }

    if (action.kind === 'delete-category') {
      await confirmDeleteCategory(action)
      return
    }

    await confirmDeleteItem(action)
  }

  return {
    confirmCatalogAction,
  }
}
