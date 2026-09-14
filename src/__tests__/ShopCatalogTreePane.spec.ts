import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import ShopCatalogTreeFilters from '@/components/shopCatalog/ShopCatalogTreeFilters.vue'
import ShopCatalogTreeNodeRow from '@/components/shopCatalog/ShopCatalogTreeNodeRow.vue'
import ShopCatalogTreePane from '@/components/shopCatalog/ShopCatalogTreePane.vue'
import ShopCatalogTreeRootRow from '@/components/shopCatalog/ShopCatalogTreeRootRow.vue'
import type { ShopCatalogTreeNode } from '@/features/shopCatalog/treeTypes'

function makeNode(overrides: Partial<ShopCatalogTreeNode> = {}): ShopCatalogTreeNode {
  return {
    key: 'category:cat-tools',
    kind: 'category',
    id: 'cat-tools',
    parentId: null,
    depth: 1,
    label: 'Tools',
    secondary: '2 folders / 12 items',
    active: true,
    hasChildren: true,
    ...overrides,
  }
}

function mountTree(overrides: Partial<InstanceType<typeof ShopCatalogTreePane>['$props']> = {}) {
  return mount(ShopCatalogTreePane, {
    props: {
      search: 'adhesive',
      showArchived: false,
      catalogLoading: false,
      selectedInspectorKey: 'root',
      rootBucketExpanded: true,
      rootBucketHasChildren: true,
      rootBucketSummary: '3 folders / 7 items',
      treeNodes: [
        makeNode(),
        makeNode({
          key: 'item:item-aha',
          kind: 'item',
          id: 'item-aha',
          parentId: 'cat-tools',
          depth: 2,
          label: 'AHA Book',
          secondary: '',
          hasChildren: false,
        }),
      ],
      dragSourceKey: null,
      dragOverKey: null,
      createKey: null,
      createValue: '',
      renameKey: null,
      renameValue: '',
      expandedCategoryIds: ['cat-tools'],
      setInputRef: vi.fn(),
      setListRef: vi.fn(),
      ...overrides,
    },
  })
}

describe('ShopCatalogTreePane', () => {
  it('renders heading, filters, loading state, drop-target state, and forwards filter events', async () => {
    const setListRef = vi.fn()
    const wrapper = mountTree({
      catalogLoading: true,
      dragOverKey: 'root',
      setListRef,
      treeNodes: [],
    })

    expect(wrapper.text()).toContain('Catalog folders & items')
    expect(wrapper.get<HTMLInputElement>('[data-testid="shop-catalog-search"]').element.value).toBe(
      'adhesive',
    )
    expect(wrapper.get<HTMLInputElement>('input[type="checkbox"]').element.checked).toBe(false)
    expect(wrapper.get('.catalog-tree-pane__list').classes()).toContain(
      'catalog-tree-pane__list--drop-target',
    )
    expect(wrapper.text()).toContain('Loading catalog...')
    expect(wrapper.findComponent(ShopCatalogTreeRootRow).exists()).toBe(false)
    expect(setListRef).toHaveBeenCalled()

    await wrapper.get('[data-testid="shop-catalog-search"]').setValue('fuel')
    await wrapper.get('input[type="checkbox"]').setValue(true)

    expect(wrapper.emitted('updateSearch')).toEqual([['fuel']])
    expect(wrapper.emitted('updateShowArchived')).toEqual([[true]])
  })

  it('renders root and node rows with derived active, drag, drop, expanded, create, rename, and draggable state', () => {
    const setInputRef = vi.fn()
    const categoryNode = makeNode()
    const itemNode = makeNode({
      key: 'item:item-aha',
      kind: 'item',
      id: 'item-aha',
      parentId: 'cat-tools',
      depth: 2,
      label: 'AHA Book',
      secondary: '',
      hasChildren: false,
    })
    const wrapper = mountTree({
      selectedInspectorKey: categoryNode.key,
      rootBucketExpanded: false,
      dragSourceKey: categoryNode.key,
      dragOverKey: itemNode.key,
      createKey: itemNode.key,
      createValue: 'New Item',
      renameKey: categoryNode.key,
      renameValue: 'Renamed Tools',
      setInputRef,
      treeNodes: [categoryNode, itemNode],
    })
    const rootRow = wrapper.getComponent(ShopCatalogTreeRootRow)
    const nodeRows = wrapper.findAllComponents(ShopCatalogTreeNodeRow)

    expect(rootRow.props()).toMatchObject({
      active: false,
      dropTarget: false,
      expanded: false,
      hasChildren: true,
      summary: '3 folders / 7 items',
    })
    expect(nodeRows).toHaveLength(2)
    expect(nodeRows[0]!.props()).toMatchObject({
      node: categoryNode,
      active: true,
      dragging: true,
      dropTarget: false,
      draggable: false,
      expanded: true,
      creating: false,
      renaming: true,
      renameValue: 'Renamed Tools',
    })
    expect(nodeRows[1]!.props()).toMatchObject({
      node: itemNode,
      active: true,
      dragging: false,
      dropTarget: true,
      draggable: false,
      expanded: false,
      creating: true,
      createValue: 'New Item',
    })
    expect(nodeRows[0]!.props('setInputRef')).toBe(setInputRef)
    expect(nodeRows[1]!.props('setInputRef')).toBe(setInputRef)
  })

  it('shows the empty search state when no nodes are visible', () => {
    const wrapper = mountTree({
      treeNodes: [],
    })

    expect(wrapper.findComponent(ShopCatalogTreeRootRow).exists()).toBe(true)
    expect(wrapper.text()).toContain('No folders or items match your search.')
  })

  it('forwards root surface/list events and root bucket row events', async () => {
    const wrapper = mountTree()
    const list = wrapper.get('.catalog-tree-pane__list')
    const rootRow = wrapper.getComponent(ShopCatalogTreeRootRow)
    const rootClick = new MouseEvent('click')
    const rootPointer = new PointerEvent('pointerdown')
    const dragEvent = new Event('dragover') as DragEvent

    await list.trigger('click')
    await list.trigger('contextmenu')
    await list.trigger('pointerdown')
    await list.trigger('dragover')
    await list.trigger('dragleave')
    await list.trigger('drop')
    rootRow.vm.$emit('click', rootClick)
    rootRow.vm.$emit('pointerdown', rootPointer)
    rootRow.vm.$emit('dragover', dragEvent)
    rootRow.vm.$emit('toggleExpanded')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('rootSurfaceClick')).toHaveLength(1)
    expect(wrapper.emitted('rootContextMenu')).toHaveLength(1)
    expect(wrapper.emitted('rootPointerDown')).toHaveLength(2)
    expect(wrapper.emitted('treeListDragOver')).toHaveLength(1)
    expect(wrapper.emitted('treeListDragLeave')).toHaveLength(1)
    expect(wrapper.emitted('rootDragOver')).toHaveLength(2)
    expect(wrapper.emitted('rootDragLeave')).toHaveLength(1)
    expect(wrapper.emitted('rootDrop')).toHaveLength(1)
    expect(wrapper.emitted('rootBucketClick')).toEqual([[rootClick]])
    expect(wrapper.emitted('rootToggleExpanded')).toHaveLength(1)
  })

  it('forwards node row events with the owning node payload', async () => {
    const node = makeNode()
    const wrapper = mountTree({
      treeNodes: [node],
    })
    const nodeRow = wrapper.getComponent(ShopCatalogTreeNodeRow)
    const clickEvent = new MouseEvent('click')
    const pointerEvent = new PointerEvent('pointerdown')
    const dragEvent = new Event('dragstart') as DragEvent

    nodeRow.vm.$emit('click', clickEvent)
    nodeRow.vm.$emit('contextmenu', clickEvent)
    nodeRow.vm.$emit('pointerdown', pointerEvent)
    nodeRow.vm.$emit('pointermove', pointerEvent)
    nodeRow.vm.$emit('pointerup', pointerEvent)
    nodeRow.vm.$emit('pointercancel', pointerEvent)
    nodeRow.vm.$emit('dragstart', dragEvent)
    nodeRow.vm.$emit('dragend', dragEvent)
    nodeRow.vm.$emit('dragover', dragEvent)
    nodeRow.vm.$emit('dragleave', dragEvent)
    nodeRow.vm.$emit('drop', dragEvent)
    nodeRow.vm.$emit('toggleExpanded')
    nodeRow.vm.$emit('updateCreateValue', 'New Folder')
    nodeRow.vm.$emit('updateRenameValue', 'Renamed Folder')
    nodeRow.vm.$emit('saveInlineCreate')
    nodeRow.vm.$emit('cancelInlineCreate')
    nodeRow.vm.$emit('saveInlineRename')
    nodeRow.vm.$emit('cancelRename')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('nodeClick')).toEqual([[clickEvent, node]])
    expect(wrapper.emitted('nodeContextMenu')).toEqual([[clickEvent, node]])
    expect(wrapper.emitted('nodePointerDown')).toEqual([[pointerEvent, node]])
    expect(wrapper.emitted('nodePointerMove')).toEqual([[pointerEvent]])
    expect(wrapper.emitted('nodePointerUp')).toEqual([[pointerEvent]])
    expect(wrapper.emitted('nodePointerCancel')).toEqual([[pointerEvent]])
    expect(wrapper.emitted('nodeDragStart')).toEqual([[dragEvent, node]])
    expect(wrapper.emitted('nodeDragEnd')).toEqual([[dragEvent]])
    expect(wrapper.emitted('nodeDragOver')).toEqual([[dragEvent, node]])
    expect(wrapper.emitted('nodeDragLeave')).toEqual([[dragEvent, node.key]])
    expect(wrapper.emitted('nodeDrop')).toEqual([[dragEvent, node]])
    expect(wrapper.emitted('toggleCategoryExpanded')).toEqual([[node.id]])
    expect(wrapper.emitted('updateCreateValue')).toEqual([['New Folder']])
    expect(wrapper.emitted('updateRenameValue')).toEqual([['Renamed Folder']])
    expect(wrapper.emitted('saveInlineCreate')).toHaveLength(1)
    expect(wrapper.emitted('cancelInlineCreate')).toHaveLength(1)
    expect(wrapper.emitted('saveInlineRename')).toHaveLength(1)
    expect(wrapper.emitted('cancelRename')).toHaveLength(1)
  })
})
