import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import ShopCatalogTreeNode from '@/components/catalog/ShopCatalogTreeNode.vue'
import { useShopCategoriesStore } from '@/stores/shopCategories'
import { buildCatalogTreeIndex } from '@/utils/catalogTree'

describe('ShopCatalogTreeNode', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders a newly added nested subcategory under an already expanded branch', async () => {
    const categoriesStore = useShopCategoriesStore()
    categoriesStore.categories = [
      { id: 'manufacturer-lists', name: 'Manufacturer lists', parentId: null, active: true },
      { id: 'grabber-brand', name: 'Grabber Brand', parentId: 'manufacturer-lists', active: true },
      { id: 'screws', name: 'Screws', parentId: 'grabber-brand', active: true },
    ]

    const wrapper = mount(ShopCatalogTreeNode, {
      props: {
        nodeId: 'manufacturer-lists',
        expanded: new Set(['manufacturer-lists', 'grabber-brand', 'screws']),
        items: [],
      },
      global: {
        stubs: {
          Transition: false,
        },
      },
    })

    expect(wrapper.text()).toContain('Screws')
    expect(wrapper.text()).not.toContain('Self Tapping')

    categoriesStore.categories = [
      ...categoriesStore.categories,
      { id: 'self-tapping', name: 'Self Tapping', parentId: 'screws', active: true },
    ]

    await nextTick()

    expect(wrapper.text()).toContain('Self Tapping')
  })

  it('renders category and item children from indexed browse maps', () => {
    const index = buildCatalogTreeIndex({
      categories: [
        { id: 'category-a', name: 'Anchors', parentId: null, active: true },
        { id: 'category-b', name: 'Bolts', parentId: 'category-a', active: true },
      ],
      items: [
        { id: 'item-a', description: 'Anchor Kit', categoryId: 'category-a', active: true },
      ],
    })

    const wrapper = mount(ShopCatalogTreeNode, {
      props: {
        nodeId: 'category-a',
        expanded: new Set(['category-a']),
        nodeChildIds: index.childIds,
        itemNodesById: index.itemNodesById,
        categoryNodesById: index.categoryNodesById,
      },
      global: {
        stubs: {
          Transition: false,
        },
      },
    })

    expect(wrapper.text()).toContain('Bolts')
    expect(wrapper.text()).toContain('Anchor Kit')
  })

  it('does not show sku or price metadata for parent category nodes', () => {
    const index = buildCatalogTreeIndex({
      categories: [
        { id: 'category-a', name: 'Anchor Kit', parentId: null, active: true },
        { id: 'category-b', name: 'Bolts', parentId: 'category-a', active: true },
      ],
      items: [],
    })

    const wrapper = mount(ShopCatalogTreeNode, {
      props: {
        nodeId: 'category-a',
        expanded: new Set<string>(),
        nodeChildIds: index.childIds,
        itemNodesById: index.itemNodesById,
        categoryNodesById: index.categoryNodesById,
      },
      global: {
        stubs: {
          Transition: false,
        },
      },
    })

    expect(wrapper.text()).toContain('Anchor Kit')
    expect(wrapper.text()).not.toContain('AK-1')
    expect(wrapper.text()).not.toContain('$12.50')
    expect(wrapper.find('.node-item-icon.bi-folder').exists()).toBe(true)
  })

  it('renders parent category edit with only the name input', () => {
    const index = buildCatalogTreeIndex({
      categories: [
        { id: 'category-a', name: 'Anchor Kit', parentId: null, active: true },
        { id: 'category-b', name: 'Bolts', parentId: 'category-a', active: true },
      ],
      items: [],
    })

    const wrapper = mount(ShopCatalogTreeNode, {
      props: {
        nodeId: 'category-a',
        expanded: new Set<string>(),
        nodeChildIds: index.childIds,
        itemNodesById: index.itemNodesById,
        categoryNodesById: index.categoryNodesById,
        editingCategoryId: 'category-a',
        editCategoryName: 'Anchor Kit',
      },
      global: {
        stubs: {
          Transition: false,
        },
      },
    })

    const inputs = wrapper.findAll('input')
    expect(inputs).toHaveLength(1)
    expect((inputs[0]!.element as HTMLInputElement).value).toBe('Anchor Kit')
  })

  it('does not show sku and price metadata for leaf category nodes', () => {
    const index = buildCatalogTreeIndex({
      categories: [
        { id: 'category-a', name: 'Anchor Kit', parentId: null, active: true },
      ],
      items: [],
    })

    const wrapper = mount(ShopCatalogTreeNode, {
      props: {
        nodeId: 'category-a',
        expanded: new Set<string>(),
        nodeChildIds: index.childIds,
        itemNodesById: index.itemNodesById,
        categoryNodesById: index.categoryNodesById,
      },
      global: {
        stubs: {
          Transition: false,
        },
      },
    })

    expect(wrapper.text()).toContain('Anchor Kit')
    expect(wrapper.text()).not.toContain('AK-1')
    expect(wrapper.text()).not.toContain('$12.50')
  })

  it('renders leaf category edit with only the name input', () => {
    const index = buildCatalogTreeIndex({
      categories: [
        { id: 'category-a', name: 'Anchor Kit', parentId: null, active: true },
      ],
      items: [],
    })

    const wrapper = mount(ShopCatalogTreeNode, {
      props: {
        nodeId: 'category-a',
        expanded: new Set<string>(),
        nodeChildIds: index.childIds,
        itemNodesById: index.itemNodesById,
        categoryNodesById: index.categoryNodesById,
        editingCategoryId: 'category-a',
        editCategoryName: 'Anchor Kit',
      },
      global: {
        stubs: {
          Transition: false,
        },
      },
    })

    const inputs = wrapper.findAll('input')
    expect(inputs).toHaveLength(1)
    expect((inputs[0]!.element as HTMLInputElement).value).toBe('Anchor Kit')
  })

  it('renders item edit inputs when the item is in edit mode', () => {
    const index = buildCatalogTreeIndex({
      categories: [],
      items: [
        { id: 'item-a', description: 'Anchor Kit', sku: 'AK-1', price: 12.5, active: true },
      ],
    })

    const wrapper = mount(ShopCatalogTreeNode, {
      props: {
        nodeId: 'item-item-a',
        expanded: new Set<string>(),
        nodeChildIds: index.childIds,
        itemNodesById: index.itemNodesById,
        categoryNodesById: index.categoryNodesById,
        editingItemId: 'item-a',
      },
      global: {
        stubs: {
          Transition: false,
        },
      },
    })

    const inputs = wrapper.findAll('input')
    expect(inputs).toHaveLength(3)
    expect((inputs[0]!.element as HTMLInputElement).value).toBe('Anchor Kit')
    expect((inputs[1]!.element as HTMLInputElement).value).toBe('AK-1')
    expect((inputs[2]!.element as HTMLInputElement).value).toBe('12.5')
  })

  it('hides sku and price for item nodes that act as parents', () => {
    const index = buildCatalogTreeIndex({
      categories: [
        { id: 'child-category', name: 'Fasteners', parentId: 'anchor-kit', active: true },
      ],
      items: [
        { id: 'anchor-kit', description: 'Anchor Kit', sku: 'AK-1', price: 12.5, active: true },
      ],
    })

    const wrapper = mount(ShopCatalogTreeNode, {
      props: {
        nodeId: 'item-anchor-kit',
        expanded: new Set<string>(),
        nodeChildIds: index.childIds,
        itemNodesById: index.itemNodesById,
        categoryNodesById: index.categoryNodesById,
      },
      global: {
        stubs: {
          Transition: false,
        },
      },
    })

    expect(wrapper.text()).toContain('Anchor Kit')
    expect(wrapper.text()).not.toContain('AK-1')
    expect(wrapper.text()).not.toContain('$12.50')
  })

  it('renders only the name edit input for item nodes that act as parents', () => {
    const index = buildCatalogTreeIndex({
      categories: [
        { id: 'child-category', name: 'Fasteners', parentId: 'anchor-kit', active: true },
      ],
      items: [
        { id: 'anchor-kit', description: 'Anchor Kit', sku: 'AK-1', price: 12.5, active: true },
      ],
    })

    const wrapper = mount(ShopCatalogTreeNode, {
      props: {
        nodeId: 'item-anchor-kit',
        expanded: new Set<string>(),
        nodeChildIds: index.childIds,
        itemNodesById: index.itemNodesById,
        categoryNodesById: index.categoryNodesById,
        editingItemId: 'anchor-kit',
      },
      global: {
        stubs: {
          Transition: false,
        },
      },
    })

    const inputs = wrapper.findAll('input')
    expect(inputs).toHaveLength(1)
    expect((inputs[0]!.element as HTMLInputElement).value).toBe('Anchor Kit')
  })

  it('does not offer add subcategory actions on item rows', async () => {
    const index = buildCatalogTreeIndex({
      categories: [],
      items: [
        { id: 'item-a', description: 'Anchor Kit', sku: 'AK-1', price: 12.5, active: true },
      ],
    })

    const wrapper = mount(ShopCatalogTreeNode, {
      props: {
        nodeId: 'item-item-a',
        expanded: new Set<string>(),
        nodeChildIds: index.childIds,
        itemNodesById: index.itemNodesById,
        categoryNodesById: index.categoryNodesById,
      },
      global: {
        stubs: {
          Transition: false,
        },
      },
    })

    await wrapper.get('button[title="Toggle edit mode"]').trigger('click')

    expect(wrapper.find('button[title="Add subcategory"]').exists()).toBe(false)
    expect(wrapper.find('button[title="Add item"]').exists()).toBe(true)
    expect(wrapper.find('button[title="Edit"]').exists()).toBe(true)
  })

  it('offers add item but not add subcategory on category rows', async () => {
    const index = buildCatalogTreeIndex({
      categories: [
        { id: 'category-a', name: 'Anchors', parentId: null, active: true },
      ],
      items: [],
    })

    const wrapper = mount(ShopCatalogTreeNode, {
      props: {
        nodeId: 'category-a',
        expanded: new Set<string>(),
        nodeChildIds: index.childIds,
        itemNodesById: index.itemNodesById,
        categoryNodesById: index.categoryNodesById,
      },
      global: {
        stubs: {
          Transition: false,
        },
      },
    })

    await wrapper.get('button[title="Toggle edit mode"]').trigger('click')

    expect(wrapper.find('button[title="Add item"]').exists()).toBe(true)
    expect(wrapper.find('button[title="Add subcategory"]').exists()).toBe(false)
  })

  it('keeps delete on category rows that still have children', async () => {
    const index = buildCatalogTreeIndex({
      categories: [
        { id: 'category-a', name: 'Anchors', parentId: null, active: true },
      ],
      items: [
        { id: 'item-a', description: 'Anchor Kit', categoryId: 'category-a', active: true },
      ],
    })

    const wrapper = mount(ShopCatalogTreeNode, {
      props: {
        nodeId: 'category-a',
        expanded: new Set<string>(),
        nodeChildIds: index.childIds,
        itemNodesById: index.itemNodesById,
        categoryNodesById: index.categoryNodesById,
      },
      global: {
        stubs: {
          Transition: false,
        },
      },
    })

    await wrapper.get('button[title="Toggle edit mode"]').trigger('click')

    expect(wrapper.find('button[title="Delete"]').exists()).toBe(true)
  })

  it('keeps delete on leaf category rows', async () => {
    const index = buildCatalogTreeIndex({
      categories: [
        { id: 'category-a', name: 'Anchors', parentId: null, active: true },
      ],
      items: [],
    })

    const wrapper = mount(ShopCatalogTreeNode, {
      props: {
        nodeId: 'category-a',
        expanded: new Set<string>(),
        nodeChildIds: index.childIds,
        itemNodesById: index.itemNodesById,
        categoryNodesById: index.categoryNodesById,
      },
      global: {
        stubs: {
          Transition: false,
        },
      },
    })

    await wrapper.get('button[title="Toggle edit mode"]').trigger('click')

    expect(wrapper.find('button[title="Delete"]').exists()).toBe(true)
  })

  it('keeps delete on item rows that still have children', async () => {
    const index = buildCatalogTreeIndex({
      categories: [
        { id: 'child-category', name: 'Fasteners', parentId: 'item-item-a', active: true },
      ],
      items: [
        { id: 'item-a', description: 'Anchor Kit', sku: 'AK-1', price: 12.5, active: true },
      ],
    })

    const wrapper = mount(ShopCatalogTreeNode, {
      props: {
        nodeId: 'item-item-a',
        expanded: new Set<string>(),
        nodeChildIds: index.childIds,
        itemNodesById: index.itemNodesById,
        categoryNodesById: index.categoryNodesById,
      },
      global: {
        stubs: {
          Transition: false,
        },
      },
    })

    await wrapper.get('button[title="Toggle edit mode"]').trigger('click')

    expect(wrapper.find('button[title="Delete"]').exists()).toBe(true)
  })

  it('forwards nested item edit cancel events to the root tree node', async () => {
    const index = buildCatalogTreeIndex({
      categories: [
        { id: 'category-a', name: 'Anchors', parentId: null, active: true },
      ],
      items: [
        { id: 'item-a', description: 'Anchor Kit', sku: 'AK-1', price: 12.5, categoryId: 'category-a', active: true },
      ],
    })

    const wrapper = mount(ShopCatalogTreeNode, {
      props: {
        nodeId: 'category-a',
        expanded: new Set(['category-a']),
        nodeChildIds: index.childIds,
        itemNodesById: index.itemNodesById,
        categoryNodesById: index.categoryNodesById,
        editingItemId: 'item-a',
      },
      global: {
        stubs: {
          Transition: false,
        },
      },
    })

    await wrapper.get('button[title="Cancel"]').trigger('click')

    expect(wrapper.emitted('cancel-item-edit')).toHaveLength(1)
  })

  it('shows the in-order quantity next to orderable item labels', () => {
    const index = buildCatalogTreeIndex({
      categories: [],
      items: [
        { id: 'item-a', description: 'Outrigger', active: true },
      ],
    })

    const wrapper = mount(ShopCatalogTreeNode, {
      props: {
        nodeId: 'item-item-a',
        expanded: new Set<string>(),
        orderMode: true,
        selectedItemQuantities: { 'item-a': 2 },
        catalogItemQtys: { 'item-a': 1 },
        nodeChildIds: index.childIds,
        itemNodesById: index.itemNodesById,
        categoryNodesById: index.categoryNodesById,
      },
      global: {
        stubs: {
          Transition: false,
        },
      },
    })

    expect(wrapper.text()).toContain('Outrigger x2')
  })
})
