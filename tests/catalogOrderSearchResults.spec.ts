import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CatalogSearchResultsList from '@/components/catalog/CatalogSearchResultsList.vue'
import type { CatalogSearchResult } from '@/composables/useCatalogSearchResults'
import type { ShopCatalogItem } from '@/services'
import type { ShopCategory } from '@/stores/shopCategories'

const itemFixture: ShopCatalogItem = {
  id: 'item-anchor',
  description: 'Lag Anchor',
  sku: 'AN-100',
  price: 12.5,
  active: true,
}

const categoryFixture: ShopCategory = {
  id: 'cat-fasteners',
  name: 'Fasteners',
  parentId: null,
  active: true,
}

const itemResult: CatalogSearchResult = {
  id: itemFixture.id,
  nodeId: `item-${itemFixture.id}`,
  kind: 'item',
  label: itemFixture.description,
  pathLabel: 'Top level',
  breadcrumbLabel: '',
  sku: itemFixture.sku,
  price: itemFixture.price,
  active: true,
  hasChildren: false,
  ancestorNodeIds: [],
  matchStrength: 'primary',
  item: itemFixture,
}

const categoryResult: CatalogSearchResult = {
  id: categoryFixture.id,
  nodeId: categoryFixture.id,
  kind: 'category',
  label: categoryFixture.name,
  pathLabel: 'Top level',
  breadcrumbLabel: '',
  active: true,
  hasChildren: true,
  ancestorNodeIds: [],
  matchStrength: 'primary',
  category: categoryFixture,
}

describe('CatalogSearchResultsList in order mode', () => {
  it('shows qty and add controls for orderable results', async () => {
    const wrapper = mount(CatalogSearchResultsList, {
      props: {
        results: [itemResult],
        totalResultCount: 1,
        hasMoreResults: false,
        mode: 'order',
        catalogItemQtys: { [itemFixture.id]: 2 },
        selectedItemQuantities: { [itemFixture.id]: 3 },
        orderableNodeIds: new Set([itemResult.nodeId]),
      },
    })

    const qtyInput = wrapper.get('input[aria-label="Quantity"]')
    expect((qtyInput.element as HTMLInputElement).value).toBe('2')
    expect(wrapper.text()).toContain('x3')

    await qtyInput.setValue('4')
    expect(wrapper.emitted('update:catalogItemQty')).toEqual([
      [{ id: itemFixture.id, qty: 4 }],
    ])

    await wrapper.setProps({
      catalogItemQtys: { [itemFixture.id]: 4 },
    })

    await wrapper.get('button[aria-label="Add to order"]').trigger('click')
    expect(wrapper.emitted('select-for-order')).toEqual([
      [{ id: itemFixture.id, description: itemFixture.description, quantity: 4 }],
    ])
  })

  it('keeps reveal actions for branch results', async () => {
    const wrapper = mount(CatalogSearchResultsList, {
      props: {
        results: [categoryResult],
        totalResultCount: 1,
        hasMoreResults: false,
        mode: 'order',
        catalogItemQtys: {},
        selectedItemQuantities: {},
        orderableNodeIds: new Set<string>(),
      },
    })

    expect(wrapper.find('input[aria-label="Quantity"]').exists()).toBe(false)

    await wrapper.get('button[aria-label="Reveal in tree"]').trigger('click')
    expect(wrapper.emitted('reveal')).toEqual([[categoryResult]])
  })

  it('shows order controls when a visible leaf is still marked as having children in search metadata', () => {
    const wrapper = mount(CatalogSearchResultsList, {
      props: {
        results: [{ ...itemResult, hasChildren: true }],
        totalResultCount: 1,
        hasMoreResults: false,
        mode: 'order',
        catalogItemQtys: { [itemFixture.id]: 1 },
        selectedItemQuantities: { [itemFixture.id]: 1 },
        orderableNodeIds: new Set([itemResult.nodeId]),
      },
    })

    expect(wrapper.find('input[aria-label="Quantity"]').exists()).toBe(true)
    expect(wrapper.find('button[aria-label="Add to order"]').exists()).toBe(true)
    expect(wrapper.find('button[aria-label="Reveal in tree"]').exists()).toBe(false)
  })
})
