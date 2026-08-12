import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useShopCatalogContextMenuTargets } from '@/features/shopCatalog/useShopCatalogContextMenuTargets'
import { useShopCatalogTreeInteractions } from '@/features/shopCatalog/useShopCatalogTreeInteractions'
import type { ShopCatalogContextMenuTarget } from '@/features/shopCatalog/useShopCatalogContextMenu'
import type { ShopCatalogTreeNode } from '@/features/shopCatalog/treeTypes'
import type { ShopCatalogItemRecord } from '@/types/domain'

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

function makeNode(overrides: Partial<ShopCatalogTreeNode> = {}): ShopCatalogTreeNode {
  const kind = overrides.kind ?? 'category'
  const id = overrides.id ?? (kind === 'category' ? 'cat-tools' : 'item-drill')

  return {
    active: true,
    depth: 0,
    hasChildren: false,
    id,
    key: `${kind}:${id}` as ShopCatalogTreeNode['key'],
    kind,
    label: kind === 'category' ? 'Tools' : 'Cordless Drill',
    parentId: null,
    secondary: '',
    ...overrides,
  }
}

function mountInteractions(options: {
  consumeSuppressedClick?: boolean
  items?: ShopCatalogItemRecord[]
} = {}) {
  const clearDragState = vi.fn()
  const closeContextMenu = vi.fn()
  const consumeSuppressedClick = vi.fn(() => options.consumeSuppressedClick ?? false)
  const inspectItem = vi.fn()
  const selectFolder = vi.fn()
  const selectRoot = vi.fn()
  const toggleCategoryExpanded = vi.fn()
  const toggleRootBucketExpanded = vi.fn()

  const interactions = useShopCatalogTreeInteractions({
    clearDragState,
    closeContextMenu,
    consumeSuppressedClick,
    inspectItem,
    items: ref(options.items ?? [makeItem()]),
    selectFolder,
    selectRoot,
    toggleCategoryExpanded,
    toggleRootBucketExpanded,
  })

  return {
    clearDragState,
    closeContextMenu,
    consumeSuppressedClick,
    inspectItem,
    interactions,
    selectFolder,
    selectRoot,
    toggleCategoryExpanded,
    toggleRootBucketExpanded,
  }
}

function mountContextMenuTargets() {
  const beginLongPress = vi.fn()
  const openContextMenu = vi.fn()
  const targets = useShopCatalogContextMenuTargets({
    beginLongPress,
    openContextMenu,
  })

  return {
    beginLongPress,
    openContextMenu,
    targets,
  }
}

function mouseEvent(type = 'click') {
  return new MouseEvent(type, { bubbles: true, cancelable: true })
}

function pointerEvent(type = 'pointerdown') {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    pointerType: 'touch',
  })
}

describe('useShopCatalogTreeInteractions', () => {
  it('opens category nodes by selecting the folder and toggling only folders with children', () => {
    const { interactions, selectFolder, toggleCategoryExpanded } = mountInteractions()

    interactions.openTreeNode(makeNode({ hasChildren: true, id: 'cat-tools' }))
    interactions.openTreeNode(makeNode({ hasChildren: false, id: 'cat-empty' }))

    expect(selectFolder).toHaveBeenNthCalledWith(1, 'cat-tools', {
      showInspector: false,
      ensureExpanded: false,
    })
    expect(selectFolder).toHaveBeenNthCalledWith(2, 'cat-empty', {
      showInspector: false,
      ensureExpanded: false,
    })
    expect(toggleCategoryExpanded).toHaveBeenCalledTimes(1)
    expect(toggleCategoryExpanded).toHaveBeenCalledWith('cat-tools')
  })

  it('opens item nodes through the inspector and ignores missing or draft nodes', () => {
    const item = makeItem({ id: 'item-drill' })
    const { inspectItem, interactions, selectFolder, toggleCategoryExpanded } = mountInteractions({
      items: [item],
    })

    interactions.openTreeNode(makeNode({ kind: 'item', id: 'item-drill', key: 'item:item-drill' }))
    interactions.openTreeNode(makeNode({ kind: 'item', id: 'item-missing', key: 'item:item-missing' }))
    interactions.openTreeNode(makeNode({ draft: true, id: 'draft-root', key: 'draft-category:root' }))

    expect(inspectItem).toHaveBeenCalledTimes(1)
    expect(inspectItem).toHaveBeenCalledWith(item, { showInspector: false })
    expect(selectFolder).not.toHaveBeenCalled()
    expect(toggleCategoryExpanded).not.toHaveBeenCalled()
  })

  it('handles root and root-bucket clicks unless a suppressed long-press click is consumed', () => {
    const allowed = mountInteractions()
    const suppressed = mountInteractions({ consumeSuppressedClick: true })
    const event = mouseEvent()

    allowed.interactions.handleRootSurfaceClick(event)
    allowed.interactions.handleRootBucketClick(event)
    suppressed.interactions.handleRootSurfaceClick(event)
    suppressed.interactions.handleRootBucketClick(event)

    expect(allowed.selectRoot).toHaveBeenCalledTimes(2)
    expect(allowed.toggleRootBucketExpanded).toHaveBeenCalledTimes(1)
    expect(suppressed.selectRoot).not.toHaveBeenCalled()
    expect(suppressed.toggleRootBucketExpanded).not.toHaveBeenCalled()
  })

  it('handles tree-node clicks through open-node behavior unless suppressed', () => {
    const allowed = mountInteractions()
    const suppressed = mountInteractions({ consumeSuppressedClick: true })
    const node = makeNode({ hasChildren: true })
    const event = mouseEvent()

    allowed.interactions.handleTreeNodeClick(event, node)
    suppressed.interactions.handleTreeNodeClick(event, node)

    expect(allowed.selectFolder).toHaveBeenCalledWith('cat-tools', {
      showInspector: false,
      ensureExpanded: false,
    })
    expect(allowed.toggleCategoryExpanded).toHaveBeenCalledWith('cat-tools')
    expect(suppressed.selectFolder).not.toHaveBeenCalled()
    expect(suppressed.toggleCategoryExpanded).not.toHaveBeenCalled()
  })

  it('closes menus on global pointerdown and clears drag state only on Escape', () => {
    const { clearDragState, closeContextMenu, interactions } = mountInteractions()

    interactions.handleGlobalPointerDown()
    interactions.handleGlobalKeydown(new KeyboardEvent('keydown', { key: 'Tab' }))
    interactions.handleGlobalKeydown(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(closeContextMenu).toHaveBeenCalledTimes(2)
    expect(clearDragState).toHaveBeenCalledTimes(1)
  })
})

describe('useShopCatalogContextMenuTargets', () => {
  it('opens context menus for root, category, and item targets', () => {
    const { openContextMenu, targets } = mountContextMenuTargets()
    const rootEvent = mouseEvent('contextmenu')
    const categoryEvent = mouseEvent('contextmenu')
    const itemEvent = mouseEvent('contextmenu')

    targets.openRootContextMenu(rootEvent)
    targets.openNodeContextMenu(categoryEvent, makeNode({ kind: 'category', id: 'cat-tools' }))
    targets.openNodeContextMenu(itemEvent, makeNode({ kind: 'item', id: 'item-drill', key: 'item:item-drill' }))

    expect(openContextMenu).toHaveBeenNthCalledWith(1, rootEvent, { kind: 'root' })
    expect(openContextMenu).toHaveBeenNthCalledWith(2, categoryEvent, {
      kind: 'category',
      id: 'cat-tools',
    } satisfies ShopCatalogContextMenuTarget)
    expect(openContextMenu).toHaveBeenNthCalledWith(3, itemEvent, {
      kind: 'item',
      id: 'item-drill',
    } satisfies ShopCatalogContextMenuTarget)
  })

  it('prevents draft context menus without opening a target', () => {
    const { openContextMenu, targets } = mountContextMenuTargets()
    const event = mouseEvent('contextmenu')
    const preventDefault = vi.spyOn(event, 'preventDefault')

    targets.openNodeContextMenu(event, makeNode({
      draft: true,
      id: 'root',
      key: 'draft-category:root',
    }))

    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(openContextMenu).not.toHaveBeenCalled()
  })

  it('begins long-press context menus for root, category, and item targets', () => {
    const { beginLongPress, targets } = mountContextMenuTargets()
    const rootEvent = pointerEvent()
    const categoryEvent = pointerEvent()
    const itemEvent = pointerEvent()

    targets.beginRootLongPress(rootEvent)
    targets.beginNodeLongPress(categoryEvent, makeNode({ kind: 'category', id: 'cat-tools' }))
    targets.beginNodeLongPress(itemEvent, makeNode({ kind: 'item', id: 'item-drill', key: 'item:item-drill' }))

    expect(beginLongPress).toHaveBeenNthCalledWith(1, rootEvent, { kind: 'root' })
    expect(beginLongPress).toHaveBeenNthCalledWith(2, categoryEvent, {
      kind: 'category',
      id: 'cat-tools',
    } satisfies ShopCatalogContextMenuTarget)
    expect(beginLongPress).toHaveBeenNthCalledWith(3, itemEvent, {
      kind: 'item',
      id: 'item-drill',
    } satisfies ShopCatalogContextMenuTarget)
  })

  it('ignores draft nodes when starting long-press context menus', () => {
    const { beginLongPress, targets } = mountContextMenuTargets()

    targets.beginNodeLongPress(pointerEvent(), makeNode({
      draft: true,
      id: 'root',
      key: 'draft-item:root',
    }))

    expect(beginLongPress).not.toHaveBeenCalled()
  })
})
