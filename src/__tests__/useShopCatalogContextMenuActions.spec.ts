import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import {
  type ShopCatalogContextAction,
  useShopCatalogContextMenuActions,
} from '@/features/shopCatalog/useShopCatalogContextMenuActions'
import { useShopCatalogContextDeleteActions } from '@/features/shopCatalog/useShopCatalogContextDeleteActions'
import type { ShopCatalogContextMenuTarget } from '@/features/shopCatalog/useShopCatalogContextMenu'
import type { ShopCatalogItemRecord, ShopCategoryRecord } from '@/types/domain'

function makeCategory(overrides: Partial<ShopCategoryRecord> = {}): ShopCategoryRecord {
  return {
    active: true,
    id: 'cat-tools',
    name: 'Tools',
    parentId: null,
    ...overrides,
  }
}

function makeItem(overrides: Partial<ShopCatalogItemRecord> = {}): ShopCatalogItemRecord {
  return {
    active: true,
    categoryId: 'cat-tools',
    description: 'Cordless Drill',
    id: 'item-drill',
    price: null,
    sku: null,
    ...overrides,
  }
}

function getAction(actions: readonly ShopCatalogContextAction[], key: string) {
  const action = actions.find((candidate) => candidate.key === key)
  if (!action) throw new Error(`Missing action: ${key}`)
  return action
}

function mountActions(options: {
  categories?: ShopCategoryRecord[]
  childCategoryCounts?: Record<string, number>
  childItemCounts?: Record<string, number>
  expandedCategoryIds?: string[]
  isSinglePaneLayout?: boolean
  items?: ShopCatalogItemRecord[]
  rootBucketExpanded?: boolean
  target?: ShopCatalogContextMenuTarget
  visibleCategoryIds?: string[]
} = {}) {
  const categories = options.categories ?? [
    makeCategory({ id: 'cat-tools', name: 'Tools' }),
  ]
  const items = options.items ?? [
    makeItem({ id: 'item-drill', description: 'Cordless Drill' }),
  ]
  const expandedCategoryIds = ref<readonly string[]>(options.expandedCategoryIds ?? [])
  const isSinglePaneLayout = ref(options.isSinglePaneLayout ?? false)
  const rootBucketExpanded = ref(options.rootBucketExpanded ?? false)
  const target = ref<ShopCatalogContextMenuTarget>(options.target ?? { kind: 'root' })

  const beginInlineCreate = vi.fn()
  const beginRenameNode = vi.fn()
  const closeContextMenu = vi.fn()
  const collapseAllCategories = vi.fn()
  const deleteCategoryFromContext = vi.fn()
  const deleteItemFromContext = vi.fn()
  const expandAllCategories = vi.fn()
  const handleArchiveCategory = vi.fn()
  const handleArchiveItem = vi.fn()
  const inspectItem = vi.fn()
  const openCreateItemMode = vi.fn()
  const selectFolder = vi.fn()
  const selectRoot = vi.fn()
  const showMobileInspector = vi.fn()

  const result = useShopCatalogContextMenuActions({
    beginInlineCreate,
    beginRenameNode,
    closeContextMenu,
    collapseAllCategories,
    deleteCategoryFromContext,
    deleteItemFromContext,
    expandedCategoryIds,
    expandAllCategories,
    getCategoryById: (categoryId) => categories.find((category) => category.id === categoryId) ?? null,
    getDirectChildCategoryCount: (categoryId) => options.childCategoryCounts?.[categoryId ?? 'root'] ?? 0,
    getDirectChildItemCount: (categoryId) => options.childItemCounts?.[categoryId ?? 'root'] ?? 0,
    getItemById: (itemId) => items.find((item) => item.id === itemId) ?? null,
    getVisibleCategoryIds: () => options.visibleCategoryIds ?? ['cat-tools'],
    handleArchiveCategory,
    handleArchiveItem,
    inspectItem,
    isSinglePaneLayout,
    openCreateItemMode,
    rootBucketExpanded,
    selectFolder,
    selectRoot,
    showMobileInspector,
    target,
  })

  return {
    beginInlineCreate,
    beginRenameNode,
    closeContextMenu,
    collapseAllCategories,
    deleteCategoryFromContext,
    deleteItemFromContext,
    expandedCategoryIds,
    expandAllCategories,
    handleArchiveCategory,
    handleArchiveItem,
    inspectItem,
    isSinglePaneLayout,
    openCreateItemMode,
    result,
    rootBucketExpanded,
    selectFolder,
    selectRoot,
    showMobileInspector,
    target,
  }
}

describe('useShopCatalogContextMenuActions', () => {
  it('builds root actions and wires create item/folder plus expand/collapse commands', () => {
    const {
      beginInlineCreate,
      closeContextMenu,
      collapseAllCategories,
      expandAllCategories,
      openCreateItemMode,
      result,
    } = mountActions()

    expect(result.contextMenuActions.value.map((action) => action.key)).toEqual([
      'new-folder-root',
      'new-item-root',
      'expand-all-folders-root',
      'collapse-all-folders-root',
    ])
    expect(getAction(result.contextMenuActions.value, 'expand-all-folders-root').disabled).toBe(false)
    expect(getAction(result.contextMenuActions.value, 'collapse-all-folders-root').disabled).toBe(true)

    getAction(result.contextMenuActions.value, 'new-folder-root').run()
    getAction(result.contextMenuActions.value, 'new-item-root').run()
    getAction(result.contextMenuActions.value, 'expand-all-folders-root').run()
    getAction(result.contextMenuActions.value, 'collapse-all-folders-root').run()

    expect(beginInlineCreate).toHaveBeenCalledWith('category', null)
    expect(openCreateItemMode).toHaveBeenCalledWith(null)
    expect(closeContextMenu).toHaveBeenCalledTimes(1)
    expect(expandAllCategories).toHaveBeenCalledTimes(1)
    expect(collapseAllCategories).toHaveBeenCalledTimes(1)
  })

  it('adds root inspect action on single-pane layouts', () => {
    const { closeContextMenu, result, selectRoot, showMobileInspector } = mountActions({
      isSinglePaneLayout: true,
    })

    getAction(result.contextMenuActions.value, 'inspect-root').run()

    expect(selectRoot).toHaveBeenCalledTimes(1)
    expect(showMobileInspector).toHaveBeenCalledTimes(1)
    expect(closeContextMenu).toHaveBeenCalledTimes(1)
  })

  it('builds category actions with child-aware delete disabling and archive labels', () => {
    const {
      beginInlineCreate,
      beginRenameNode,
      closeContextMenu,
      deleteCategoryFromContext,
      handleArchiveCategory,
      openCreateItemMode,
      result,
      selectFolder,
    } = mountActions({
      childCategoryCounts: { 'cat-tools': 1 },
      isSinglePaneLayout: true,
      target: { kind: 'category', id: 'cat-tools' },
    })

    expect(result.contextMenuActions.value.map((action) => action.key)).toEqual([
      'inspect-folder',
      'new-folder-inside',
      'new-item-inside',
      'rename-folder',
      'expand-all-folders-category',
      'collapse-all-folders-category',
      'archive-folder',
      'delete-folder',
    ])
    expect(getAction(result.contextMenuActions.value, 'archive-folder').label).toBe('Archive Folder')
    expect(getAction(result.contextMenuActions.value, 'delete-folder')).toMatchObject({
      danger: true,
      disabled: true,
    })

    getAction(result.contextMenuActions.value, 'inspect-folder').run()
    getAction(result.contextMenuActions.value, 'new-folder-inside').run()
    getAction(result.contextMenuActions.value, 'new-item-inside').run()
    getAction(result.contextMenuActions.value, 'rename-folder').run()
    getAction(result.contextMenuActions.value, 'archive-folder').run()
    getAction(result.contextMenuActions.value, 'delete-folder').run()

    expect(selectFolder).toHaveBeenCalledWith('cat-tools', { showInspector: true })
    expect(beginInlineCreate).toHaveBeenCalledWith('category', 'cat-tools')
    expect(openCreateItemMode).toHaveBeenCalledWith('cat-tools')
    expect(beginRenameNode).toHaveBeenCalledWith({ kind: 'category', id: 'cat-tools' })
    expect(handleArchiveCategory).toHaveBeenCalledWith(false, 'cat-tools', { showInspector: false })
    expect(deleteCategoryFromContext).toHaveBeenCalledWith('cat-tools')
    expect(closeContextMenu).toHaveBeenCalledTimes(3)
  })

  it('uses restore labels for archived folders and enables empty-folder deletion', () => {
    const { result } = mountActions({
      categories: [makeCategory({ active: false, id: 'cat-tools' })],
      target: { kind: 'category', id: 'cat-tools' },
    })

    expect(getAction(result.contextMenuActions.value, 'archive-folder').label).toBe('Restore Folder')
    expect(getAction(result.contextMenuActions.value, 'delete-folder').disabled).toBe(false)
  })

  it('builds item actions with inspect, rename, restore/archive, and delete behavior', () => {
    const item = makeItem({ active: false, id: 'item-drill' })
    const {
      beginRenameNode,
      closeContextMenu,
      deleteItemFromContext,
      handleArchiveItem,
      inspectItem,
      result,
    } = mountActions({
      isSinglePaneLayout: true,
      items: [item],
      target: { kind: 'item', id: 'item-drill' },
    })

    expect(result.contextMenuActions.value.map((action) => action.key)).toEqual([
      'inspect-item',
      'rename-item',
      'expand-all-folders-item',
      'collapse-all-folders-item',
      'archive-item',
      'delete-item',
    ])
    expect(getAction(result.contextMenuActions.value, 'archive-item').label).toBe('Restore Item')
    expect(getAction(result.contextMenuActions.value, 'delete-item').danger).toBe(true)

    getAction(result.contextMenuActions.value, 'inspect-item').run()
    getAction(result.contextMenuActions.value, 'rename-item').run()
    getAction(result.contextMenuActions.value, 'archive-item').run()
    getAction(result.contextMenuActions.value, 'delete-item').run()

    expect(inspectItem).toHaveBeenCalledWith(item, { showInspector: true })
    expect(beginRenameNode).toHaveBeenCalledWith({ kind: 'item', id: 'item-drill' })
    expect(handleArchiveItem).toHaveBeenCalledWith(true, 'item-drill', { showInspector: false })
    expect(deleteItemFromContext).toHaveBeenCalledWith('item-drill')
    expect(closeContextMenu).toHaveBeenCalledTimes(2)
  })

  it('updates expand/collapse disabled states from root and visible category expansion', () => {
    const { expandedCategoryIds, result, rootBucketExpanded } = mountActions({
      expandedCategoryIds: ['cat-tools'],
      rootBucketExpanded: true,
      target: { kind: 'root' },
      visibleCategoryIds: ['cat-tools'],
    })

    expect(getAction(result.contextMenuActions.value, 'expand-all-folders-root').disabled).toBe(true)
    expect(getAction(result.contextMenuActions.value, 'collapse-all-folders-root').disabled).toBe(false)

    rootBucketExpanded.value = false
    expandedCategoryIds.value = []

    expect(getAction(result.contextMenuActions.value, 'expand-all-folders-root').disabled).toBe(false)
    expect(getAction(result.contextMenuActions.value, 'collapse-all-folders-root').disabled).toBe(true)
  })
})

describe('useShopCatalogContextDeleteActions', () => {
  it('selects folders, closes the menu, and starts folder deletion from context actions', () => {
    const closeContextMenu = vi.fn()
    const handleDeleteCategory = vi.fn()
    const selectFolder = vi.fn()
    const deleteActions = useShopCatalogContextDeleteActions({
      closeContextMenu,
      handleDeleteCategory,
      handleDeleteItem: vi.fn(),
      inspectItem: vi.fn(),
      items: ref<ShopCatalogItemRecord[]>([]),
      selectFolder,
    })

    deleteActions.deleteCategoryFromContext('cat-tools')

    expect(selectFolder).toHaveBeenCalledWith('cat-tools', { showInspector: false })
    expect(closeContextMenu).toHaveBeenCalledTimes(1)
    expect(handleDeleteCategory).toHaveBeenCalledTimes(1)
  })

  it('inspects existing items before closing the menu and starting item deletion', () => {
    const item = makeItem({ id: 'item-drill' })
    const closeContextMenu = vi.fn()
    const handleDeleteItem = vi.fn()
    const inspectItem = vi.fn()
    const deleteActions = useShopCatalogContextDeleteActions({
      closeContextMenu,
      handleDeleteCategory: vi.fn(),
      handleDeleteItem,
      inspectItem,
      items: ref([item]),
      selectFolder: vi.fn(),
    })

    deleteActions.deleteItemFromContext('item-drill')

    expect(inspectItem).toHaveBeenCalledWith(item, { showInspector: false })
    expect(closeContextMenu).toHaveBeenCalledTimes(1)
    expect(handleDeleteItem).toHaveBeenCalledTimes(1)
  })

  it('still closes the menu and starts item deletion when the item is already missing', () => {
    const closeContextMenu = vi.fn()
    const handleDeleteItem = vi.fn()
    const inspectItem = vi.fn()
    const deleteActions = useShopCatalogContextDeleteActions({
      closeContextMenu,
      handleDeleteCategory: vi.fn(),
      handleDeleteItem,
      inspectItem,
      items: ref<ShopCatalogItemRecord[]>([]),
      selectFolder: vi.fn(),
    })

    deleteActions.deleteItemFromContext('item-missing')

    expect(inspectItem).not.toHaveBeenCalled()
    expect(closeContextMenu).toHaveBeenCalledTimes(1)
    expect(handleDeleteItem).toHaveBeenCalledTimes(1)
  })
})
