import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ShopCatalogCategoryDetailPanel from '@/components/shopCatalog/ShopCatalogCategoryDetailPanel.vue'
import ShopCatalogCreateCategoryPanel from '@/components/shopCatalog/ShopCatalogCreateCategoryPanel.vue'
import ShopCatalogCreateItemPanel from '@/components/shopCatalog/ShopCatalogCreateItemPanel.vue'
import ShopCatalogInspectorPane from '@/components/shopCatalog/ShopCatalogInspectorPane.vue'
import ShopCatalogItemDetailPanel from '@/components/shopCatalog/ShopCatalogItemDetailPanel.vue'
import ShopCatalogRootInspector from '@/components/shopCatalog/ShopCatalogRootInspector.vue'
import type {
  ShopCatalogCategoryFormState,
  ShopCatalogCategoryOption,
  ShopCatalogItemFormState,
} from '@/features/shopCatalog/adminViewHelpers'
import type { ShopCatalogItemRecord, ShopCategoryRecord } from '@/types/domain'

const categoryOptions: ShopCatalogCategoryOption[] = [
  { value: 'cat-tools', label: 'Tools' },
  { value: 'cat-safety', label: 'Safety' },
]

function makeCategory(overrides: Partial<ShopCategoryRecord> = {}): ShopCategoryRecord {
  return {
    id: 'cat-tools',
    name: 'Tools',
    parentId: null,
    active: true,
    ...overrides,
  }
}

function makeItem(overrides: Partial<ShopCatalogItemRecord> = {}): ShopCatalogItemRecord {
  return {
    id: 'item-aha',
    description: 'AHA Book',
    categoryId: 'cat-safety',
    sku: 'AHA-1',
    price: 12.5,
    active: true,
    ...overrides,
  }
}

function makeCategoryForm(overrides: Partial<ShopCatalogCategoryFormState> = {}): ShopCatalogCategoryFormState {
  return {
    name: 'Tools',
    parentId: null,
    active: true,
    ...overrides,
  }
}

function makeItemForm(overrides: Partial<ShopCatalogItemFormState> = {}): ShopCatalogItemFormState {
  return {
    description: 'AHA Book',
    categoryId: 'cat-safety',
    sku: 'AHA-1',
    price: '$12.50',
    active: true,
    ...overrides,
  }
}

function mountInspector(overrides: Partial<InstanceType<typeof ShopCatalogInspectorPane>['$props']> = {}) {
  return mount(ShopCatalogInspectorPane, {
    props: {
      mobileVisible: true,
      isRootInspector: true,
      isCreateCategoryMode: false,
      isCreateItemMode: false,
      visibleFolderCount: 4,
      visibleItemCount: 25,
      createCategoryForm: makeCategoryForm({ name: 'New Folder' }),
      createItemForm: makeItemForm({ description: 'New Item' }),
      categoryOptions,
      createLoading: false,
      selectedCategory: null,
      detailCategoryForm: makeCategoryForm(),
      detailCategoryParentOptions: categoryOptions,
      selectedCategoryTitle: 'Tools',
      selectedCategoryPathLabel: 'Top Level / Tools',
      selectedCategorySummaryLabel: '2 folders / 12 items',
      selectedCategoryHasChildren: false,
      selectedItem: null,
      detailItemForm: makeItemForm(),
      selectedItemTitle: 'AHA Book',
      selectedItemPathLabel: 'Safety / Books',
      selectedItemSkuLabel: 'SKU AHA-1',
      selectedItemPriceLabel: '$12.50',
      saveLoading: false,
      deleteLoading: false,
      ...overrides,
    },
  })
}

describe('ShopCatalogInspectorPane', () => {
  it('renders the root inspector and applies the mobile-hidden pane state', () => {
    const wrapper = mountInspector({
      mobileVisible: false,
    })
    const rootInspector = wrapper.getComponent(ShopCatalogRootInspector)

    expect(wrapper.get('#catalog-inspector-pane').classes()).toContain('catalog-inspector-pane--mobile-hidden')
    expect(rootInspector.props('visibleFolderCount')).toBe(4)
    expect(rootInspector.props('visibleItemCount')).toBe(25)
    expect(wrapper.findComponent(ShopCatalogCreateCategoryPanel).exists()).toBe(false)
  })

  it('renders create-folder mode and forwards create-category events', async () => {
    const wrapper = mountInspector({
      isRootInspector: false,
      isCreateCategoryMode: true,
    })
    const createPanel = wrapper.getComponent(ShopCatalogCreateCategoryPanel)

    expect(createPanel.props('form')).toEqual(makeCategoryForm({ name: 'New Folder' }))
    expect(createPanel.props('categoryOptions')).toEqual(categoryOptions)
    expect(createPanel.props('createLoading')).toBe(false)

    createPanel.vm.$emit('submit')
    createPanel.vm.$emit('update:name', 'Adhesive')
    createPanel.vm.$emit('update:parent-id', 'cat-tools')
    createPanel.vm.$emit('update:active', false)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('submit-create-category')).toHaveLength(1)
    expect(wrapper.emitted('update-create-category-name')).toEqual([['Adhesive']])
    expect(wrapper.emitted('update-create-category-parent-id')).toEqual([['cat-tools']])
    expect(wrapper.emitted('update-create-category-active')).toEqual([[false]])
  })

  it('renders create-item mode and forwards create-item and price events', async () => {
    const wrapper = mountInspector({
      isRootInspector: false,
      isCreateItemMode: true,
      createLoading: true,
    })
    const createPanel = wrapper.getComponent(ShopCatalogCreateItemPanel)
    const inputEvent = new Event('input')

    expect(createPanel.props('form')).toEqual(makeItemForm({ description: 'New Item' }))
    expect(createPanel.props('categoryOptions')).toEqual(categoryOptions)
    expect(createPanel.props('createLoading')).toBe(true)

    createPanel.vm.$emit('submit')
    createPanel.vm.$emit('update:description', 'Foreman Book')
    createPanel.vm.$emit('update:category-id', null)
    createPanel.vm.$emit('update:sku', 'FB-1')
    createPanel.vm.$emit('update:active', false)
    createPanel.vm.$emit('price-input', inputEvent)
    createPanel.vm.$emit('price-focus')
    createPanel.vm.$emit('price-blur')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('submit-create-item')).toHaveLength(1)
    expect(wrapper.emitted('update-create-item-description')).toEqual([['Foreman Book']])
    expect(wrapper.emitted('update-create-item-category-id')).toEqual([[null]])
    expect(wrapper.emitted('update-create-item-sku')).toEqual([['FB-1']])
    expect(wrapper.emitted('update-create-item-active')).toEqual([[false]])
    expect(wrapper.emitted('create-item-price-input')).toEqual([[inputEvent]])
    expect(wrapper.emitted('create-item-price-focus')).toHaveLength(1)
    expect(wrapper.emitted('create-item-price-blur')).toHaveLength(1)
  })

  it('renders selected-category detail mode and forwards category detail events', async () => {
    const wrapper = mountInspector({
      isRootInspector: false,
      selectedCategory: makeCategory({ active: false }),
      selectedCategoryHasChildren: true,
      saveLoading: true,
    })
    const detailPanel = wrapper.getComponent(ShopCatalogCategoryDetailPanel)

    expect(detailPanel.props('form')).toEqual(makeCategoryForm())
    expect(detailPanel.props('parentOptions')).toEqual(categoryOptions)
    expect(detailPanel.props('title')).toBe('Tools')
    expect(detailPanel.props('active')).toBe(false)
    expect(detailPanel.props('pathLabel')).toBe('Top Level / Tools')
    expect(detailPanel.props('summaryLabel')).toBe('2 folders / 12 items')
    expect(detailPanel.props('deleteDisabled')).toBe(true)
    expect(detailPanel.props('saveLoading')).toBe(true)

    detailPanel.vm.$emit('submit')
    detailPanel.vm.$emit('update:name', 'Hardware')
    detailPanel.vm.$emit('update:parent-id', null)
    detailPanel.vm.$emit('update:active', true)
    detailPanel.vm.$emit('archive')
    detailPanel.vm.$emit('delete')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('submit-category')).toHaveLength(1)
    expect(wrapper.emitted('update-category-name')).toEqual([['Hardware']])
    expect(wrapper.emitted('update-category-parent-id')).toEqual([[null]])
    expect(wrapper.emitted('update-category-active')).toEqual([[true]])
    expect(wrapper.emitted('archive-category')).toHaveLength(1)
    expect(wrapper.emitted('delete-category')).toHaveLength(1)
  })

  it('renders selected-item detail mode and forwards item detail events', async () => {
    const wrapper = mountInspector({
      isRootInspector: false,
      selectedItem: makeItem({ active: false }),
      deleteLoading: true,
    })
    const detailPanel = wrapper.getComponent(ShopCatalogItemDetailPanel)
    const inputEvent = new Event('input')

    expect(detailPanel.props('form')).toEqual(makeItemForm())
    expect(detailPanel.props('title')).toBe('AHA Book')
    expect(detailPanel.props('active')).toBe(false)
    expect(detailPanel.props('pathLabel')).toBe('Safety / Books')
    expect(detailPanel.props('skuLabel')).toBe('SKU AHA-1')
    expect(detailPanel.props('priceLabel')).toBe('$12.50')
    expect(detailPanel.props('deleteLoading')).toBe(true)

    detailPanel.vm.$emit('submit')
    detailPanel.vm.$emit('update:description', 'Foreman Book')
    detailPanel.vm.$emit('update:sku', 'FB-1')
    detailPanel.vm.$emit('update:active', true)
    detailPanel.vm.$emit('price-input', inputEvent)
    detailPanel.vm.$emit('price-focus')
    detailPanel.vm.$emit('price-blur')
    detailPanel.vm.$emit('archive')
    detailPanel.vm.$emit('delete')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('submit-item')).toHaveLength(1)
    expect(wrapper.emitted('update-item-description')).toEqual([['Foreman Book']])
    expect(wrapper.emitted('update-item-sku')).toEqual([['FB-1']])
    expect(wrapper.emitted('update-item-active')).toEqual([[true]])
    expect(wrapper.emitted('detail-item-price-input')).toEqual([[inputEvent]])
    expect(wrapper.emitted('detail-item-price-focus')).toHaveLength(1)
    expect(wrapper.emitted('detail-item-price-blur')).toHaveLength(1)
    expect(wrapper.emitted('archive-item')).toHaveLength(1)
    expect(wrapper.emitted('delete-item')).toHaveLength(1)
  })
})
