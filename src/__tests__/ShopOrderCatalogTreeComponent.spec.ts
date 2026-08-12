import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ShopOrderCatalogTree from '@/components/shopOrders/ShopOrderCatalogTree.vue'
import type {
  ShopOrderCatalogRootNode,
  ShopOrderCatalogTreeNode,
} from '@/features/shopOrders/catalogBrowserHelpers'

const rootNode: ShopOrderCatalogRootNode = {
  key: 'root',
  kind: 'root',
  depth: 0,
  label: 'Top Level',
  secondary: '1 folder',
  hasChildren: true,
}

const categoryNode: ShopOrderCatalogTreeNode = {
  key: 'category:cat-lighting',
  kind: 'category',
  id: 'cat-lighting',
  parentId: null,
  depth: 1,
  label: 'Lighting',
  secondary: '2 items',
  hasChildren: true,
}

const itemNode: ShopOrderCatalogTreeNode = {
  key: 'item:item-bulb',
  kind: 'item',
  id: 'item-bulb',
  parentId: 'cat-lighting',
  depth: 2,
  label: 'Light Bulb - 24 Pack',
  priceLabel: '$12.50',
}

const secondItemNode: ShopOrderCatalogTreeNode = {
  key: 'item:item-lift',
  kind: 'item',
  id: 'item-lift',
  parentId: null,
  depth: 1,
  label: 'Scissor Lift',
  priceLabel: 'No price',
}

function mountTree(overrides = {}) {
  return mount(ShopOrderCatalogTree, {
    props: {
      activeFolderId: null,
      disabled: false,
      expandedCategoryIds: ['cat-lighting'],
      listCollapsed: false,
      loading: false,
      nodes: [categoryNode, itemNode],
      pendingItemIds: [],
      quantities: {
        'item-bulb': '3',
      },
      rootExpanded: true,
      rootHasChildren: true,
      rootNode,
      searchActive: false,
      selectedCatalogItemId: null,
      ...overrides,
    },
  })
}

describe('ShopOrderCatalogTree component', () => {
  it('renders root, category, and item rows from props', () => {
    const wrapper = mountTree({
      activeFolderId: 'cat-lighting',
      selectedCatalogItemId: null,
    })

    expect(wrapper.text()).toContain('Top Level')
    expect(wrapper.text()).toContain('Lighting')
    expect(wrapper.text()).toContain('Light Bulb - 24 Pack')
    expect(wrapper.get('[data-testid="shoporder-category-cat-lighting"]').classes()).toContain(
      'shop-orders-tree-node--active',
    )
    expect(wrapper.get<HTMLInputElement>('[data-testid="shoporder-quantity-item-bulb"]').element.value).toBe('3')
  })

  it('emits root, node, item, and quantity events without owning workflow state', async () => {
    const wrapper = mountTree()

    await wrapper.get('[data-testid="shoporder-root-row"]').trigger('click')
    await wrapper.get('[data-testid="shoporder-root-toggle"]').trigger('click')
    await wrapper.get('[data-testid="shoporder-root-row"]').trigger('contextmenu')
    await wrapper.get('[data-testid="shoporder-category-cat-lighting"]').trigger('click')
    await wrapper
      .get('[data-testid="shoporder-category-cat-lighting"]')
      .get('.shop-orders-tree-node__twist')
      .trigger('click')
    await wrapper.get('[data-testid="shoporder-category-cat-lighting"]').trigger('contextmenu')
    await wrapper.get<HTMLInputElement>('[data-testid="shoporder-quantity-item-bulb"]').setValue('7')
    await wrapper.get('[data-testid="shoporder-add-item-bulb"]').trigger('click')

    expect(wrapper.emitted('rootSelect')).toHaveLength(1)
    expect(wrapper.emitted('rootToggle')).toHaveLength(1)
    expect(wrapper.emitted('rootContextMenu')).toHaveLength(1)
    expect(wrapper.emitted('nodeSelect')).toEqual([[categoryNode]])
    expect(wrapper.emitted('nodeToggle')).toEqual([[categoryNode]])
    expect(wrapper.emitted('nodeContextMenu')?.[0]?.[1]).toEqual(categoryNode)
    expect(wrapper.emitted('updateQuantity')).toEqual([['item-bulb', '7']])
    expect(wrapper.emitted('itemAdd')).toEqual([['item-bulb']])
  })

  it('disables only pending item controls unless the whole catalog is disabled', () => {
    const wrapper = mountTree({
      nodes: [itemNode, secondItemNode],
      pendingItemIds: ['item-bulb'],
    })

    expect(wrapper.get<HTMLInputElement>('[data-testid="shoporder-quantity-item-bulb"]').element.disabled).toBe(true)
    expect(wrapper.get<HTMLButtonElement>('[data-testid="shoporder-add-item-bulb"]').element.disabled).toBe(true)
    expect(wrapper.get<HTMLInputElement>('[data-testid="shoporder-quantity-item-lift"]').element.disabled).toBe(false)
    expect(wrapper.get<HTMLButtonElement>('[data-testid="shoporder-add-item-lift"]').element.disabled).toBe(false)
  })

  it('renders loading, empty, and context menu states', async () => {
    const wrapper = mountTree({
      contextMenu: { visible: true, x: 12, y: 24 },
      contextMenuActions: [
        { key: 'expand-all', label: 'Expand All Folders' },
        { key: 'collapse-all', label: 'Collapse All Folders', disabled: true },
      ],
      loading: true,
      nodes: [],
    })

    expect(wrapper.text()).toContain('Loading catalog...')
    expect(wrapper.get('[data-testid="shoporder-context-menu"]').attributes('style')).toContain('left: 12px')

    await wrapper.get('[data-testid="shoporder-context-expand-all"]').trigger('click')
    expect(wrapper.emitted('contextAction')).toEqual([['expand-all']])

    await wrapper.setProps({
      contextMenu: { visible: false, x: 0, y: 0 },
      loading: false,
      rootHasChildren: false,
    })

    expect(wrapper.text()).toContain('No catalog entries match this view.')
  })
})
