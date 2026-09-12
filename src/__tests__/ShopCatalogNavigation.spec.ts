import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ShopCatalogMobileNav from '@/components/shopCatalog/ShopCatalogMobileNav.vue'
import ShopCatalogTreeFilters from '@/components/shopCatalog/ShopCatalogTreeFilters.vue'
import ShopCatalogTreeHeader from '@/components/shopCatalog/ShopCatalogTreeHeader.vue'

describe('ShopCatalogTreeFilters', () => {
  it('renders search/archive filter state and forwards updates to the route owner', async () => {
    const wrapper = mount(ShopCatalogTreeFilters, {
      props: {
        search: 'adhesive',
        showArchived: false,
      },
    })

    expect(wrapper.get<HTMLInputElement>('[data-testid="shop-catalog-search"]').element.value).toBe('adhesive')
    expect(wrapper.get<HTMLInputElement>('input[type="checkbox"]').element.checked).toBe(false)
    expect(wrapper.text()).toContain('Show Archived')

    await wrapper.get('[data-testid="shop-catalog-search"]').setValue('fuel')
    await wrapper.get('input[type="checkbox"]').setValue(true)

    expect(wrapper.emitted('update:search')).toEqual([['fuel']])
    expect(wrapper.emitted('update:show-archived')).toEqual([[true]])
  })
})

describe('ShopCatalogMobileNav', () => {
  it('marks the active mobile panel and emits tab changes', async () => {
    const wrapper = mount(ShopCatalogMobileNav, {
      props: {
        activePanel: 'catalog',
      },
    })
    const tabs = wrapper.findAll('[role="tab"]')

    expect(wrapper.get('[role="tablist"]').attributes('aria-label')).toBe('Shop catalog panels')
    expect(tabs).toHaveLength(2)
    expect(tabs[0]!.text()).toBe('Catalog')
    expect(tabs[0]!.attributes('aria-selected')).toBe('true')
    expect(tabs[0]!.classes()).toContain('app-mobile-panel-tabs__button--active')
    expect(tabs[1]!.text()).toBe('Inspector')
    expect(tabs[1]!.attributes('aria-selected')).toBe('false')

    await tabs[1]!.trigger('click')
    await tabs[0]!.trigger('click')

    expect(wrapper.emitted('show')).toEqual([['inspector'], ['catalog']])
  })
})

describe('ShopCatalogTreeHeader', () => {
  it('renders the catalog admin heading through the shared pane header', () => {
    const wrapper = mount(ShopCatalogTreeHeader)

    expect(wrapper.text()).toContain('Admin')
    expect(wrapper.get('h1').text()).toBe('Shop Catalog')
    expect(wrapper.get('.shop-catalog-tree-header').classes()).toContain('app-pane-header')
  })
})
