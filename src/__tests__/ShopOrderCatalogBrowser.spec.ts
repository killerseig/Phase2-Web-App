import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import ShopOrderCatalogBrowser from '@/components/shopOrders/ShopOrderCatalogBrowser.vue'
import type { ShopCatalogItemRecord, ShopCategoryRecord } from '@/types/domain'

const categories: ShopCategoryRecord[] = [
  {
    id: 'cat-lighting',
    name: 'Lighting',
    parentId: null,
    active: true,
  },
  {
    id: 'cat-lifts',
    name: 'Lifts',
    parentId: null,
    active: true,
  },
  {
    id: 'cat-archived',
    name: 'Archived',
    parentId: null,
    active: false,
  },
]

const catalogItems: ShopCatalogItemRecord[] = [
  {
    id: 'item-bulb',
    description: 'Light Bulb - 24 Pack',
    categoryId: 'cat-lighting',
    sku: 'LB-24',
    price: null,
    active: true,
  },
  {
    id: 'item-lift',
    description: 'Scissor Lift',
    categoryId: 'cat-lifts',
    sku: null,
    price: null,
    active: true,
  },
  {
    id: 'item-archived',
    description: 'Archived Item',
    categoryId: null,
    sku: null,
    price: null,
    active: false,
  },
]

function mountBrowser(overrides = {}) {
  return mount(ShopOrderCatalogBrowser, {
    props: {
      addCatalogItem: vi.fn(() => true),
      catalogItems,
      categories,
      disabled: false,
      loading: false,
      ...overrides,
    },
  })
}

function createDeferred<TResult>() {
  let resolve!: (value: TResult) => void
  const promise = new Promise<TResult>((nextResolve) => {
    resolve = nextResolve
  })

  return { promise, resolve }
}

describe('ShopOrderCatalogBrowser', () => {
  it('renders active catalog counts and hides inactive entries', () => {
    const wrapper = mountBrowser()

    expect(wrapper.text()).toContain('2 folders')
    expect(wrapper.text()).toContain('2 items')
    expect(wrapper.text()).toContain('Lighting')
    expect(wrapper.text()).toContain('Light Bulb - 24 Pack')
    expect(wrapper.text()).toContain('Scissor Lift')
    expect(wrapper.text()).not.toContain('Archived')
    expect(wrapper.text()).not.toContain('Archived Item')
  })

  it('lets searched folders collapse and expand without clearing the search', async () => {
    const wrapper = mountBrowser()

    await wrapper.get('[data-testid="shoporder-catalog-search"]').setValue('light')

    expect(wrapper.text()).toContain('Lighting')
    expect(wrapper.text()).toContain('Light Bulb - 24 Pack')
    expect(wrapper.text()).not.toContain('Scissor Lift')

    await wrapper
      .get('[data-testid="shoporder-category-cat-lighting"]')
      .get('.shop-orders-tree-node__twist')
      .trigger('click')

    expect(wrapper.text()).toContain('Lighting')
    expect(wrapper.text()).not.toContain('Light Bulb - 24 Pack')

    await wrapper
      .get('[data-testid="shoporder-category-cat-lighting"]')
      .get('.shop-orders-tree-node__twist')
      .trigger('click')

    expect(wrapper.text()).toContain('Light Bulb - 24 Pack')
  })

  it('adds catalog items with the selected quantity and resets the quantity after success', async () => {
    const addCatalogItem = vi.fn(() => true)
    const wrapper = mountBrowser({
      addCatalogItem,
    })
    const quantity = wrapper.get<HTMLInputElement>('[data-testid="shoporder-quantity-item-bulb"]')

    await quantity.setValue('4')
    await wrapper.get('[data-testid="shoporder-add-item-bulb"]').trigger('click')

    expect(addCatalogItem).toHaveBeenCalledWith(catalogItems[0], 4)
    expect(quantity.element.value).toBe('1')
  })

  it('disables only the item row being added while the add action is pending', async () => {
    const deferred = createDeferred<boolean>()
    const addCatalogItem = vi.fn(() => deferred.promise)
    const wrapper = mountBrowser({
      addCatalogItem,
    })

    await wrapper.get('[data-testid="shoporder-add-item-bulb"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.get<HTMLInputElement>('[data-testid="shoporder-quantity-item-bulb"]').element.disabled).toBe(true)
    expect(wrapper.get<HTMLButtonElement>('[data-testid="shoporder-add-item-bulb"]').element.disabled).toBe(true)
    expect(wrapper.get<HTMLInputElement>('[data-testid="shoporder-quantity-item-lift"]').element.disabled).toBe(false)
    expect(wrapper.get<HTMLButtonElement>('[data-testid="shoporder-add-item-lift"]').element.disabled).toBe(false)

    deferred.resolve(true)
    await flushPromises()

    expect(wrapper.get<HTMLButtonElement>('[data-testid="shoporder-add-item-bulb"]').element.disabled).toBe(false)
  })

  it('keeps item add controls disabled while order actions are unavailable', () => {
    const wrapper = mountBrowser({
      disabled: true,
    })

    expect(wrapper.get<HTMLInputElement>('[data-testid="shoporder-quantity-item-bulb"]').element.disabled).toBe(true)
    expect(wrapper.get<HTMLButtonElement>('[data-testid="shoporder-add-item-bulb"]').element.disabled).toBe(true)
  })
})
