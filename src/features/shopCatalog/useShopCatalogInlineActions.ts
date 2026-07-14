import {
  getShopCatalogItemDisplayName,
  getShopCategoryDisplayName,
} from '@/features/shopCatalog/adminViewHelpers'
import type { ShopCatalogTreeNode as TreeNode } from '@/features/shopCatalog/treeTypes'
import type { ShopCatalogContextMenuTarget } from '@/features/shopCatalog/useShopCatalogContextMenu'
import { createShopCatalogItem, createShopCategory, updateShopCatalogItem, updateShopCategory } from '@/services/shopCatalog'
import type { ShopCatalogItemRecord, ShopCategoryRecord } from '@/types/domain'

interface Ref<T> {
  value: T
}

interface ReadonlyRef<T> {
  readonly value: T
}

interface InlineCreateState {
  key: TreeNode['key'] | null
  kind: 'category' | 'item' | null
  parentId: string | null
  value: string
  saving: boolean
}

interface InlineRenameState {
  key: TreeNode['key'] | null
  value: string
  saving: boolean
}

interface UseShopCatalogInlineActionsOptions {
  activeFolderId: Ref<string | null>
  cancelInlineCreate: () => void
  cancelRename: () => void
  categoriesById: ReadonlyRef<ReadonlyMap<string, ShopCategoryRecord>>
  closeContextMenu: () => void
  createState: InlineCreateState
  ensureExpandedToCategory: (categoryId: string | null) => void
  expandedCategoryIds: Ref<string[]>
  focusInlineInput: (options?: { select?: boolean }) => Promise<void>
  inspectItem: (item: ShopCatalogItemRecord, options?: { showInspector?: boolean }) => void
  items: ReadonlyRef<ShopCatalogItemRecord[]>
  prepareCreateItemForm: (categoryId: string | null) => void
  renameState: InlineRenameState
  rootBucketExpanded: Ref<boolean>
  selectFolder: (categoryId: string, options?: { showInspector?: boolean }) => void
  selectedInspectorKey: Ref<string>
  setCreateError: (error: unknown, fallbackMessage: string) => void
  setCreateErrorMessage: (message: string) => void
  setDetailError: (error: unknown, fallbackMessage: string) => void
  showInspectorPanel: () => void
  startInlineCreate: (kind: 'category' | 'item', parentId: string | null) => void
  startInlineRename: (key: TreeNode['key'], value: string) => void
}

export function useShopCatalogInlineActions({
  activeFolderId,
  cancelInlineCreate,
  cancelRename,
  categoriesById,
  closeContextMenu,
  createState,
  ensureExpandedToCategory,
  expandedCategoryIds,
  focusInlineInput,
  inspectItem,
  items,
  prepareCreateItemForm,
  renameState,
  rootBucketExpanded,
  selectFolder,
  selectedInspectorKey,
  setCreateError,
  setCreateErrorMessage,
  setDetailError,
  showInspectorPanel,
  startInlineCreate,
  startInlineRename,
}: UseShopCatalogInlineActionsOptions) {
  function openCreateItemMode(parentId: string | null = activeFolderId.value) {
    cancelRename()
    cancelInlineCreate()
    activeFolderId.value = parentId
    selectedInspectorKey.value = 'new-item'
    showInspectorPanel()
    prepareCreateItemForm(parentId)

    if (parentId) {
      ensureExpandedToCategory(parentId)
    } else {
      rootBucketExpanded.value = true
    }
  }

  async function beginInlineCreate(kind: 'category' | 'item', parentId: string | null = activeFolderId.value) {
    setCreateErrorMessage('')

    if (parentId == null) {
      rootBucketExpanded.value = true
    }

    if (parentId) {
      ensureExpandedToCategory(parentId)
      selectedInspectorKey.value = `category:${parentId}`
    }

    startInlineCreate(kind, parentId)
    closeContextMenu()
    await focusInlineInput()
  }

  async function beginRenameNode(target: ShopCatalogContextMenuTarget) {
    if (target.kind === 'root') return

    if (target.kind === 'category') {
      const category = categoriesById.value.get(target.id) ?? null
      if (!category) return
      selectFolder(target.id, { showInspector: false })
      startInlineRename(`category:${target.id}`, getShopCategoryDisplayName(category))
    } else {
      const item = items.value.find((candidate) => candidate.id === target.id) ?? null
      if (!item) return
      inspectItem(item, { showInspector: false })
      startInlineRename(`item:${target.id}`, getShopCatalogItemDisplayName(item))
    }

    closeContextMenu()
    await focusInlineInput({ select: true })
  }

  async function saveInlineCreate() {
    if (!createState.key || !createState.kind || createState.saving) return

    const nextValue = createState.value.trim()
    if (!nextValue) {
      cancelInlineCreate()
      return
    }

    createState.saving = true
    setCreateErrorMessage('')

    try {
      if (createState.kind === 'category') {
        const categoryId = await createShopCategory({
          name: nextValue,
          parentId: createState.parentId,
          active: true,
        })

        if (createState.parentId) {
          ensureExpandedToCategory(createState.parentId)
        }

        expandedCategoryIds.value = Array.from(new Set([...expandedCategoryIds.value, categoryId]))
        selectFolder(categoryId, { showInspector: false })
      } else {
        const itemId = await createShopCatalogItem({
          description: nextValue,
          categoryId: createState.parentId,
          sku: null,
          price: null,
          active: true,
        })

        const item = items.value.find((candidate) => candidate.id === itemId)
        if (item) {
          inspectItem(item, { showInspector: false })
        } else {
          activeFolderId.value = createState.parentId
          selectedInspectorKey.value = `item:${itemId}`
        }
      }

      cancelInlineCreate()
    } catch (error) {
      setCreateError(error, `Failed to create ${createState.kind}.`)
      createState.saving = false
    }
  }

  async function saveInlineRename() {
    if (!renameState.key || renameState.saving) return

    const nextValue = renameState.value.trim()
    if (!nextValue) {
      cancelRename()
      return
    }

    renameState.saving = true

    try {
      if (renameState.key.startsWith('category:')) {
        const categoryId = renameState.key.slice('category:'.length)
        const category = categoriesById.value.get(categoryId) ?? null
        if (!category || nextValue === getShopCategoryDisplayName(category)) {
          cancelRename()
          return
        }

        await updateShopCategory(categoryId, {
          name: nextValue,
          parentId: category.parentId,
          active: category.active,
        })
      } else {
        const itemId = renameState.key.slice('item:'.length)
        const item = items.value.find((candidate) => candidate.id === itemId) ?? null
        if (!item || nextValue === getShopCatalogItemDisplayName(item)) {
          cancelRename()
          return
        }

        await updateShopCatalogItem(itemId, {
          description: item.description,
          categoryId: item.categoryId,
          sku: item.sku ?? null,
          price: item.price,
          active: item.active,
        })
      }

      cancelRename()
    } catch (error) {
      setDetailError(error, 'Failed to rename catalog entry.')
      renameState.saving = false
    }
  }

  return {
    beginInlineCreate,
    beginRenameNode,
    openCreateItemMode,
    saveInlineCreate,
    saveInlineRename,
  }
}
