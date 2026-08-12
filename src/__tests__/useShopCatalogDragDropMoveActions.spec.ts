import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useShopCatalogDragDrop } from '@/features/shopCatalog/useShopCatalogDragDrop'
import { useShopCatalogMoveActions } from '@/features/shopCatalog/useShopCatalogMoveActions'
import type { ShopCatalogDragPayload } from '@/features/shopCatalog/adminViewHelpers'
import type { ShopCatalogTreeNode } from '@/features/shopCatalog/treeTypes'
import { updateShopCatalogItem, updateShopCategory } from '@/services/shopCatalog'
import type { ShopCatalogItemRecord, ShopCategoryRecord } from '@/types/domain'

vi.mock('@/services/shopCatalog', () => ({
  updateShopCatalogItem: vi.fn(),
  updateShopCategory: vi.fn(),
}))

const updateShopCatalogItemMock = vi.mocked(updateShopCatalogItem)
const updateShopCategoryMock = vi.mocked(updateShopCategory)

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
    price: 12.5,
    sku: 'DR-1',
    ...overrides,
  }
}

function makeNode(overrides: Partial<ShopCatalogTreeNode> = {}): ShopCatalogTreeNode {
  const kind = overrides.kind ?? 'category'
  const id = overrides.id ?? (kind === 'category' ? 'cat-tools' : 'item-drill')

  return {
    active: true,
    depth: 1,
    hasChildren: false,
    id,
    key: `${kind}:${id}` as ShopCatalogTreeNode['key'],
    kind,
    label: kind === 'category' ? 'Tools' : 'Cordless Drill',
    parentId: kind === 'category' ? null : 'cat-tools',
    secondary: '',
    ...overrides,
  }
}

function groupCategories(categories: readonly ShopCategoryRecord[]) {
  const grouped = new Map<string | null, ShopCategoryRecord[]>()
  for (const category of categories) {
    const parentId = category.parentId ?? null
    grouped.set(parentId, [...(grouped.get(parentId) ?? []), category])
  }
  return grouped
}

function dragEvent(options: {
  clientY?: number
  currentTarget?: EventTarget | null
  relatedTarget?: EventTarget | null
} = {}) {
  const data = new Map<string, string>()
  const event = {
    clientY: options.clientY ?? 0,
    currentTarget: options.currentTarget ?? null,
    dataTransfer: {
      dropEffect: '',
      effectAllowed: '',
      getData: vi.fn((key: string) => data.get(key) ?? ''),
      setData: vi.fn((key: string, value: string) => {
        data.set(key, value)
      }),
    },
    preventDefault: vi.fn(),
    relatedTarget: options.relatedTarget ?? null,
  }

  return event as unknown as DragEvent
}

function mountDragDrop(options: {
  blockDragStart?: boolean
  categories?: ShopCategoryRecord[]
  creatingKeys?: string[]
  items?: ShopCatalogItemRecord[]
  moveEntry?: (payload: ShopCatalogDragPayload, targetCategoryId: string | null) => Promise<void>
  renamingKeys?: string[]
} = {}) {
  const categories = ref(options.categories ?? [
    makeCategory({ id: 'cat-tools', name: 'Tools' }),
    makeCategory({ id: 'cat-bits', name: 'Bits', parentId: 'cat-tools' }),
    makeCategory({ id: 'cat-small', name: 'Small', parentId: 'cat-bits' }),
    makeCategory({ id: 'cat-other', name: 'Other' }),
  ])
  const items = ref(options.items ?? [
    makeItem({ id: 'item-drill', categoryId: 'cat-tools' }),
    makeItem({ id: 'item-saw', categoryId: 'cat-other', description: 'Saw', sku: null, price: null }),
  ])
  const categoriesById = computed(() => new Map(categories.value.map((category) => [category.id, category])))
  const childCategoriesByParent = computed(() => groupCategories(categories.value))
  const clearPointerType = vi.fn()
  const closeContextMenu = vi.fn()
  const moveEntry = vi.fn(options.moveEntry ?? (() => Promise.resolve()))
  const onMoveError = vi.fn()
  const shouldBlockDragStart = ref(options.blockDragStart ?? false)
  const creatingKeys = new Set(options.creatingKeys ?? [])
  const renamingKeys = new Set(options.renamingKeys ?? [])

  const dragDrop = useShopCatalogDragDrop({
    categoriesById,
    childCategoriesByParent,
    clearPointerType,
    closeContextMenu,
    getScrollContainer: () => null,
    isCreatingNode: (nodeKey) => creatingKeys.has(nodeKey),
    isRenamingNode: (nodeKey) => renamingKeys.has(nodeKey),
    items,
    moveEntry,
    onMoveError,
    shouldBlockDragStart,
  })

  return {
    clearPointerType,
    closeContextMenu,
    dragDrop,
    moveEntry,
    onMoveError,
  }
}

function mountMoveActions(options: {
  categories?: ShopCategoryRecord[]
  items?: ShopCatalogItemRecord[]
} = {}) {
  const categories = ref(options.categories ?? [
    makeCategory({ id: 'cat-tools', name: 'Tools' }),
    makeCategory({ id: 'cat-bits', name: 'Bits', parentId: 'cat-tools' }),
  ])
  const items = ref(options.items ?? [makeItem()])
  const categoriesById = computed(() => new Map(categories.value.map((category) => [category.id, category])))
  const ensureExpandedToCategory = vi.fn()
  const inspectItem = vi.fn()
  const resetDetailMessages = vi.fn()
  const selectFolder = vi.fn()
  const detailErrors: Array<{ error: unknown; fallbackMessage: string }> = []
  const detailInfos: string[] = []

  const actions = useShopCatalogMoveActions({
    categoriesById,
    ensureExpandedToCategory,
    inspectItem,
    items,
    resetDetailMessages,
    selectFolder,
    setDetailError: (error, fallbackMessage) => {
      detailErrors.push({ error, fallbackMessage })
    },
    setDetailInfo: (message) => {
      detailInfos.push(message)
    },
  })

  return {
    actions,
    detailErrors,
    detailInfos,
    ensureExpandedToCategory,
    inspectItem,
    resetDetailMessages,
    selectFolder,
  }
}

describe('useShopCatalogDragDrop', () => {
  it('blocks drag start while the context menu is suppressing drags', () => {
    const { closeContextMenu, dragDrop } = mountDragDrop({ blockDragStart: true })
    const event = dragEvent()

    dragDrop.handleTreeDragStart(event, makeNode({ id: 'cat-tools' }))

    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(closeContextMenu).not.toHaveBeenCalled()
    expect(dragDrop.dragState.sourceKey).toBeNull()
  })

  it('ignores draft, create, and rename nodes as drag sources', () => {
    const { closeContextMenu, dragDrop } = mountDragDrop({
      creatingKeys: ['category:cat-create'],
      renamingKeys: ['item:item-rename'],
    })

    dragDrop.handleTreeDragStart(dragEvent(), makeNode({ draft: true, id: 'draft-root', key: 'draft-category:root' }))
    dragDrop.handleTreeDragStart(dragEvent(), makeNode({ id: 'cat-create', key: 'category:cat-create' }))
    dragDrop.handleTreeDragStart(dragEvent(), makeNode({ id: 'item-rename', key: 'item:item-rename', kind: 'item' }))

    expect(closeContextMenu).not.toHaveBeenCalled()
    expect(dragDrop.dragState.sourceKey).toBeNull()
  })

  it('starts valid drags with serialized move payloads', () => {
    const { closeContextMenu, dragDrop } = mountDragDrop()
    const event = dragEvent()

    dragDrop.handleTreeDragStart(event, makeNode({ id: 'cat-tools' }))

    expect(closeContextMenu).toHaveBeenCalledTimes(1)
    expect(dragDrop.dragState.sourceKey).toBe('category:cat-tools')
    expect(event.dataTransfer?.effectAllowed).toBe('move')
    expect(event.dataTransfer?.setData).toHaveBeenCalledWith('text/plain', JSON.stringify({
      kind: 'category',
      id: 'cat-tools',
    }))
  })

  it('derives valid drop targets for categories and items', () => {
    const { dragDrop } = mountDragDrop()

    expect(dragDrop.canDropPayload({ kind: 'category', id: 'cat-tools' }, 'cat-tools')).toBe(false)
    expect(dragDrop.canDropPayload({ kind: 'category', id: 'cat-tools' }, null)).toBe(false)
    expect(dragDrop.canDropPayload({ kind: 'category', id: 'cat-tools' }, 'cat-small')).toBe(false)
    expect(dragDrop.canDropPayload({ kind: 'category', id: 'cat-tools' }, 'cat-other')).toBe(true)
    expect(dragDrop.canDropPayload({ kind: 'item', id: 'item-drill' }, 'cat-tools')).toBe(false)
    expect(dragDrop.canDropPayload({ kind: 'item', id: 'item-drill' }, null)).toBe(true)
  })

  it('marks root and node drop targets only when the move is valid', () => {
    const { dragDrop } = mountDragDrop()
    dragDrop.handleTreeDragStart(dragEvent(), makeNode({ id: 'item-drill', kind: 'item', key: 'item:item-drill' }))

    const rootEvent = dragEvent()
    dragDrop.handleRootDragOver(rootEvent)
    expect(rootEvent.preventDefault).toHaveBeenCalledTimes(1)
    expect(rootEvent.dataTransfer?.dropEffect).toBe('move')
    expect(dragDrop.dragState.overKey).toBe('root')

    const categoryEvent = dragEvent()
    dragDrop.handleNodeDragOver(categoryEvent, makeNode({ id: 'cat-other', key: 'category:cat-other' }))
    expect(categoryEvent.preventDefault).toHaveBeenCalledTimes(1)
    expect(categoryEvent.dataTransfer?.dropEffect).toBe('move')
    expect(dragDrop.dragState.overKey).toBe('category:cat-other')

    const invalidEvent = dragEvent()
    dragDrop.handleNodeDragOver(invalidEvent, makeNode({ id: 'cat-tools', key: 'category:cat-tools' }))
    expect(invalidEvent.preventDefault).not.toHaveBeenCalled()
    expect(dragDrop.dragState.overKey).toBe('category:cat-other')
  })

  it('drops onto target folders, prevents duplicate drops, and clears state', async () => {
    let resolveMove: () => void = () => {}
    const movePromise = new Promise<void>((resolve) => {
      resolveMove = resolve
    })
    const { dragDrop, moveEntry } = mountDragDrop({
      moveEntry: () => movePromise,
    })
    dragDrop.handleTreeDragStart(dragEvent(), makeNode({ id: 'item-drill', kind: 'item', key: 'item:item-drill' }))

    const firstDrop = dragDrop.handleNodeDrop(dragEvent(), makeNode({ id: 'cat-other', key: 'category:cat-other' }))
    await dragDrop.handleNodeDrop(dragEvent(), makeNode({ id: 'cat-bits', key: 'category:cat-bits' }))

    expect(moveEntry).toHaveBeenCalledTimes(1)
    expect(moveEntry).toHaveBeenCalledWith({ kind: 'item', id: 'item-drill' }, 'cat-other')
    expect(dragDrop.dragState.dropping).toBe(true)

    resolveMove()
    await firstDrop

    expect(dragDrop.dragState.sourceKey).toBeNull()
    expect(dragDrop.dragState.overKey).toBeNull()
    expect(dragDrop.dragState.dropping).toBe(false)
  })

  it('reports move errors and still clears drag state', async () => {
    const error = new Error('Move denied')
    const { dragDrop, onMoveError } = mountDragDrop({
      moveEntry: () => Promise.reject(error),
    })
    dragDrop.handleTreeDragStart(dragEvent(), makeNode({ id: 'cat-bits', key: 'category:cat-bits' }))

    await dragDrop.handleRootDrop(dragEvent())

    expect(onMoveError).toHaveBeenCalledWith(error)
    expect(dragDrop.dragState.sourceKey).toBeNull()
    expect(dragDrop.dragState.dropping).toBe(false)
  })

  it('clears hover state only when the drag leaves the current target', () => {
    const { dragDrop } = mountDragDrop()
    const container = document.createElement('div')
    const child = document.createElement('div')
    container.appendChild(child)
    dragDrop.dragState.overKey = 'category:cat-tools'

    dragDrop.handleDragLeave(dragEvent({ currentTarget: container, relatedTarget: child }), 'category:cat-tools')
    expect(dragDrop.dragState.overKey).toBe('category:cat-tools')

    dragDrop.handleDragLeave(dragEvent({ currentTarget: container }), 'category:cat-tools')
    expect(dragDrop.dragState.overKey).toBeNull()
  })

  it('clears pointer type and drag state on drag end', () => {
    const { clearPointerType, dragDrop } = mountDragDrop()
    dragDrop.handleTreeDragStart(dragEvent(), makeNode({ id: 'cat-bits', key: 'category:cat-bits' }))
    dragDrop.dragState.overKey = 'root'

    dragDrop.handleTreeDragEnd()

    expect(clearPointerType).toHaveBeenCalledTimes(1)
    expect(dragDrop.dragState.sourceKey).toBeNull()
    expect(dragDrop.dragState.overKey).toBeNull()
  })
})

describe('useShopCatalogMoveActions', () => {
  beforeEach(() => {
    updateShopCatalogItemMock.mockReset()
    updateShopCategoryMock.mockReset()
    updateShopCatalogItemMock.mockResolvedValue(undefined)
    updateShopCategoryMock.mockResolvedValue(undefined)
  })

  it('moves folders with preserved fields and reselects the moved folder', async () => {
    const { actions, detailInfos, ensureExpandedToCategory, resetDetailMessages, selectFolder } = mountMoveActions()

    await actions.moveDraggedEntry({ kind: 'category', id: 'cat-tools' }, 'cat-bits')

    expect(resetDetailMessages).toHaveBeenCalledTimes(1)
    expect(updateShopCategoryMock).toHaveBeenCalledWith('cat-tools', {
      active: true,
      name: 'Tools',
      parentId: 'cat-bits',
    })
    expect(ensureExpandedToCategory).toHaveBeenCalledWith('cat-bits')
    expect(selectFolder).toHaveBeenCalledWith('cat-tools', { showInspector: false })
    expect(detailInfos).toEqual(['Folder moved.'])
  })

  it('moves folders to top level with top-level success copy', async () => {
    const { actions, detailInfos, ensureExpandedToCategory } = mountMoveActions()

    await actions.moveDraggedEntry({ kind: 'category', id: 'cat-bits' }, null)

    expect(updateShopCategoryMock).toHaveBeenCalledWith('cat-bits', expect.objectContaining({ parentId: null }))
    expect(ensureExpandedToCategory).toHaveBeenCalledWith(null)
    expect(detailInfos).toEqual(['Folder moved to top level.'])
  })

  it('moves items with preserved fields and reopens the moved item in place', async () => {
    const { actions, detailInfos, ensureExpandedToCategory, inspectItem } = mountMoveActions()

    await actions.moveDraggedEntry({ kind: 'item', id: 'item-drill' }, 'cat-bits')

    expect(updateShopCatalogItemMock).toHaveBeenCalledWith('item-drill', {
      active: true,
      categoryId: 'cat-bits',
      description: 'Cordless Drill',
      price: 12.5,
      sku: 'DR-1',
    })
    expect(ensureExpandedToCategory).toHaveBeenCalledWith('cat-bits')
    expect(inspectItem).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: 'cat-bits',
        id: 'item-drill',
      }),
      { showInspector: false },
    )
    expect(detailInfos).toEqual(['Item moved.'])
  })

  it('moves items to top level with top-level success copy', async () => {
    const { actions, detailInfos, ensureExpandedToCategory } = mountMoveActions()

    await actions.moveDraggedEntry({ kind: 'item', id: 'item-drill' }, null)

    expect(updateShopCatalogItemMock).toHaveBeenCalledWith('item-drill', expect.objectContaining({ categoryId: null }))
    expect(ensureExpandedToCategory).toHaveBeenCalledWith(null)
    expect(detailInfos).toEqual(['Item moved to top level.'])
  })

  it('ignores missing move targets after clearing stale messages', async () => {
    const { actions, detailInfos, resetDetailMessages } = mountMoveActions()

    await actions.moveDraggedEntry({ kind: 'category', id: 'missing-category' }, null)
    await actions.moveDraggedEntry({ kind: 'item', id: 'missing-item' }, null)

    expect(resetDetailMessages).toHaveBeenCalledTimes(2)
    expect(updateShopCategoryMock).not.toHaveBeenCalled()
    expect(updateShopCatalogItemMock).not.toHaveBeenCalled()
    expect(detailInfos).toEqual([])
  })

  it('normalizes drag move errors through page-message state', () => {
    const error = new Error('No permission')
    const { actions, detailErrors } = mountMoveActions()

    actions.handleDragMoveError(error)

    expect(detailErrors).toEqual([{ error, fallbackMessage: 'Failed to move catalog entry.' }])
  })
})
