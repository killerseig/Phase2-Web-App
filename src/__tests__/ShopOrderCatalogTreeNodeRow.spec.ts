import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ShopOrderCatalogTreeNodeRow from '@/components/shopOrders/ShopOrderCatalogTreeNodeRow.vue'
import type { ShopOrderCatalogTreeNode } from '@/features/shopOrders/catalogBrowserHelpers'

const categoryNode: ShopOrderCatalogTreeNode = {
  key: 'category:cat-1',
  kind: 'category',
  id: 'cat-1',
  parentId: null,
  depth: 1,
  label: 'Lighting',
  secondary: '2 folders | 12 items',
  hasChildren: true,
}

const itemNode: ShopOrderCatalogTreeNode = {
  key: 'item:item-1',
  kind: 'item',
  id: 'item-1',
  parentId: 'cat-1',
  depth: 2,
  label: 'Light Bulb - 24 Pack',
  priceLabel: '$12.50',
}

describe('ShopOrderCatalogTreeNodeRow', () => {
  it('renders category rows and emits select, toggle, and context menu events', async () => {
    const wrapper = mount(ShopOrderCatalogTreeNodeRow, {
      props: {
        active: true,
        expanded: true,
        node: categoryNode,
      },
    })

    expect(wrapper.get('[data-testid="shoporder-category-cat-1"]').classes()).toContain(
      'shop-orders-tree-node--active',
    )
    expect(wrapper.text()).toContain('Lighting')
    expect(wrapper.text()).toContain('2 folders | 12 items')
    expect(wrapper.get('button').attributes('data-state')).toBe('expanded')

    await wrapper.get('[data-testid="shoporder-category-cat-1"]').trigger('click')
    await wrapper.get('button').trigger('click')
    await wrapper.get('[data-testid="shoporder-category-cat-1"]').trigger('contextmenu')

    expect(wrapper.emitted('select')).toHaveLength(1)
    expect(wrapper.emitted('toggle')).toHaveLength(1)
    expect(wrapper.emitted('contextMenu')).toHaveLength(1)
  })

  it('renders item rows and emits quantity and add events', async () => {
    const wrapper = mount(ShopOrderCatalogTreeNodeRow, {
      props: {
        active: false,
        node: itemNode,
        quantity: '3',
      },
    })

    const quantity = wrapper.get<HTMLInputElement>('[data-testid="shoporder-quantity-item-1"]')

    expect(wrapper.text()).toContain('Light Bulb - 24 Pack')
    expect(wrapper.text()).toContain('$12.50')
    expect(quantity.element.value).toBe('3')

    await quantity.setValue('7')
    await wrapper.get('[data-testid="shoporder-add-item-1"]').trigger('click')

    expect(wrapper.emitted('updateQuantity')).toEqual([['7']])
    expect(wrapper.emitted('add')).toHaveLength(1)
  })

  it('disables item controls when catalog actions are disabled', () => {
    const wrapper = mount(ShopOrderCatalogTreeNodeRow, {
      props: {
        active: false,
        disabled: true,
        node: itemNode,
      },
    })

    expect(wrapper.get<HTMLInputElement>('[data-testid="shoporder-quantity-item-1"]').element.disabled).toBe(true)
    expect(wrapper.get<HTMLButtonElement>('[data-testid="shoporder-add-item-1"]').element.disabled).toBe(true)
  })
})
