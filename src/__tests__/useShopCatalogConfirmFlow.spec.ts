import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useShopCatalogConfirmDialog } from '@/features/shopCatalog/useShopCatalogConfirmDialog'
import { useShopCatalogConfirmDispatcher } from '@/features/shopCatalog/useShopCatalogConfirmDispatcher'
import type { ShopCatalogConfirmAction } from '@/features/shopCatalog/adminViewHelpers'

const archiveCategoryAction: Extract<ShopCatalogConfirmAction, { kind: 'archive-category' }> = {
  kind: 'archive-category',
  categoryId: 'cat-tools',
  label: 'Tools',
  nextActive: false,
  showInspector: true,
}

const restoreItemAction: Extract<ShopCatalogConfirmAction, { kind: 'archive-item' }> = {
  kind: 'archive-item',
  itemId: 'item-drill',
  label: 'Cordless Drill',
  nextActive: true,
  showInspector: false,
}

const deleteCategoryAction: Extract<ShopCatalogConfirmAction, { kind: 'delete-category' }> = {
  kind: 'delete-category',
  categoryId: 'cat-tools',
  label: 'Tools',
  parentId: null,
}

const deleteItemAction: Extract<ShopCatalogConfirmAction, { kind: 'delete-item' }> = {
  kind: 'delete-item',
  itemId: 'item-drill',
  label: 'Cordless Drill',
  categoryId: 'cat-tools',
}

function mountDispatcher(action: ShopCatalogConfirmAction | null) {
  const catalogConfirmAction = ref<ShopCatalogConfirmAction | null>(action)
  const confirmArchiveCategory = vi.fn(async () => {})
  const confirmArchiveItem = vi.fn(async () => {})
  const confirmDeleteCategory = vi.fn(async () => {})
  const confirmDeleteItem = vi.fn(async () => {})
  const dispatcher = useShopCatalogConfirmDispatcher({
    catalogConfirmAction,
    confirmArchiveCategory,
    confirmArchiveItem,
    confirmDeleteCategory,
    confirmDeleteItem,
  })

  return {
    catalogConfirmAction,
    confirmArchiveCategory,
    confirmArchiveItem,
    confirmDeleteCategory,
    confirmDeleteItem,
    dispatcher,
  }
}

describe('useShopCatalogConfirmDialog', () => {
  it('derives archive confirmation copy and destructive state from the selected action', () => {
    const isBusy = ref(false)
    const dialog = useShopCatalogConfirmDialog(isBusy)

    dialog.catalogConfirmAction.value = archiveCategoryAction

    expect(dialog.catalogConfirmTitle.value).toBe('Archive folder?')
    expect(dialog.catalogConfirmMessage.value).toBe('Archive folder "Tools" and its catalog contents?')
    expect(dialog.catalogConfirmLabel.value).toBe('Archive Folder')
    expect(dialog.catalogConfirmDestructive.value).toBe(true)
  })

  it('derives restore confirmation copy as non-destructive', () => {
    const isBusy = ref(false)
    const dialog = useShopCatalogConfirmDialog(isBusy)

    dialog.catalogConfirmAction.value = restoreItemAction

    expect(dialog.catalogConfirmTitle.value).toBe('Restore item?')
    expect(dialog.catalogConfirmMessage.value).toBe('Restore item "Cordless Drill"?')
    expect(dialog.catalogConfirmLabel.value).toBe('Restore Item')
    expect(dialog.catalogConfirmDestructive.value).toBe(false)
  })

  it('keeps the confirm action open while busy and clears it when idle', () => {
    const isBusy = ref(true)
    const dialog = useShopCatalogConfirmDialog(isBusy)

    dialog.catalogConfirmAction.value = deleteItemAction
    dialog.handleCatalogConfirmOpenUpdate(false)

    expect(dialog.catalogConfirmAction.value).toBe(deleteItemAction)

    isBusy.value = false
    dialog.handleCatalogConfirmOpenUpdate(false)

    expect(dialog.catalogConfirmAction.value).toBeNull()
  })

  it('uses safe fallback copy when no action is selected', () => {
    const dialog = useShopCatalogConfirmDialog(ref(false))

    expect(dialog.catalogConfirmTitle.value).toBe('Confirm catalog action')
    expect(dialog.catalogConfirmMessage.value).toBe('')
    expect(dialog.catalogConfirmLabel.value).toBe('Confirm')
    expect(dialog.catalogConfirmDestructive.value).toBe(false)
  })
})

describe('useShopCatalogConfirmDispatcher', () => {
  it('does nothing when no confirm action is selected', async () => {
    const {
      confirmArchiveCategory,
      confirmArchiveItem,
      confirmDeleteCategory,
      confirmDeleteItem,
      dispatcher,
    } = mountDispatcher(null)

    await dispatcher.confirmCatalogAction()

    expect(confirmArchiveCategory).not.toHaveBeenCalled()
    expect(confirmArchiveItem).not.toHaveBeenCalled()
    expect(confirmDeleteCategory).not.toHaveBeenCalled()
    expect(confirmDeleteItem).not.toHaveBeenCalled()
  })

  it('dispatches archive category actions to the archive category handler', async () => {
    const { confirmArchiveCategory, confirmArchiveItem, confirmDeleteCategory, confirmDeleteItem, dispatcher } =
      mountDispatcher(archiveCategoryAction)

    await dispatcher.confirmCatalogAction()

    expect(confirmArchiveCategory).toHaveBeenCalledWith(archiveCategoryAction)
    expect(confirmArchiveItem).not.toHaveBeenCalled()
    expect(confirmDeleteCategory).not.toHaveBeenCalled()
    expect(confirmDeleteItem).not.toHaveBeenCalled()
  })

  it('dispatches archive item actions to the archive item handler', async () => {
    const { confirmArchiveCategory, confirmArchiveItem, confirmDeleteCategory, confirmDeleteItem, dispatcher } =
      mountDispatcher(restoreItemAction)

    await dispatcher.confirmCatalogAction()

    expect(confirmArchiveCategory).not.toHaveBeenCalled()
    expect(confirmArchiveItem).toHaveBeenCalledWith(restoreItemAction)
    expect(confirmDeleteCategory).not.toHaveBeenCalled()
    expect(confirmDeleteItem).not.toHaveBeenCalled()
  })

  it('dispatches delete category actions to the delete category handler', async () => {
    const { confirmArchiveCategory, confirmArchiveItem, confirmDeleteCategory, confirmDeleteItem, dispatcher } =
      mountDispatcher(deleteCategoryAction)

    await dispatcher.confirmCatalogAction()

    expect(confirmArchiveCategory).not.toHaveBeenCalled()
    expect(confirmArchiveItem).not.toHaveBeenCalled()
    expect(confirmDeleteCategory).toHaveBeenCalledWith(deleteCategoryAction)
    expect(confirmDeleteItem).not.toHaveBeenCalled()
  })

  it('dispatches delete item actions to the delete item handler', async () => {
    const { confirmArchiveCategory, confirmArchiveItem, confirmDeleteCategory, confirmDeleteItem, dispatcher } =
      mountDispatcher(deleteItemAction)

    await dispatcher.confirmCatalogAction()

    expect(confirmArchiveCategory).not.toHaveBeenCalled()
    expect(confirmArchiveItem).not.toHaveBeenCalled()
    expect(confirmDeleteCategory).not.toHaveBeenCalled()
    expect(confirmDeleteItem).toHaveBeenCalledWith(deleteItemAction)
  })
})
