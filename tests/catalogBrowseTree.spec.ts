import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import CatalogBrowseTree from '@/components/catalog/CatalogBrowseTree.vue'

describe('CatalogBrowseTree', () => {
  it('renders one root tree node per root id with shared tree props', () => {
    const wrapper = mount(CatalogBrowseTree, {
      props: {
        rootNodeIds: ['category-a', 'item-item-a'],
        expanded: new Set(['category-a']),
        orderMode: true,
        catalogItemQtys: { 'item-a': 2 },
        selectedItemQuantities: { 'item-a': 1 },
      },
      global: {
        stubs: {
          ShopCatalogTreeNode: {
            name: 'ShopCatalogTreeNode',
            props: ['nodeId', 'expanded', 'orderMode', 'catalogItemQtys', 'selectedItemQuantities'],
            template: `
              <div
                class="tree-node-stub"
                :data-node-id="nodeId"
                :data-expanded="expanded.has(nodeId)"
                :data-order-mode="orderMode"
                :data-qty="catalogItemQtys[nodeId.replace('item-', '')] || 0"
                :data-selected="selectedItemQuantities[nodeId.replace('item-', '')] || 0"
              />
            `,
          },
        },
      },
    })

    const nodes = wrapper.findAll('.tree-node-stub')
    expect(nodes).toHaveLength(2)
    expect(nodes[0]?.attributes('data-node-id')).toBe('category-a')
    expect(nodes[0]?.attributes('data-expanded')).toBe('true')
    expect(nodes[1]?.attributes('data-node-id')).toBe('item-item-a')
    expect(nodes[1]?.attributes('data-order-mode')).toBe('true')
    expect(nodes[1]?.attributes('data-qty')).toBe('2')
    expect(nodes[1]?.attributes('data-selected')).toBe('1')
  })

  it('forwards tree node listeners to each root node', async () => {
    const toggleExpand = vi.fn()

    const wrapper = mount(CatalogBrowseTree, {
      props: {
        rootNodeIds: ['category-a'],
        expanded: new Set<string>(),
        treeNodeListeners: {
          'toggle-expand': toggleExpand,
        },
      },
      global: {
        stubs: {
          ShopCatalogTreeNode: {
            name: 'ShopCatalogTreeNode',
            props: ['nodeId'],
            emits: ['toggle-expand'],
            template: `
              <button
                type="button"
                class="tree-node-toggle"
                @click="$emit('toggle-expand', nodeId)"
              >
                Toggle
              </button>
            `,
          },
        },
      },
    })

    await wrapper.get('.tree-node-toggle').trigger('click')

    expect(toggleExpand).toHaveBeenCalledWith('category-a')
  })
})
