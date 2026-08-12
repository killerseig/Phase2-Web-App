import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ShopCatalogExplorerShell from '@/components/shopCatalog/ShopCatalogExplorerShell.vue'

describe('ShopCatalogExplorerShell', () => {
  it('renders the mobile nav, catalog, inspector, and context menu slots inside the shared explorer shell', () => {
    const wrapper = mount(ShopCatalogExplorerShell, {
      props: { activePanel: 'catalog', testId: 'shop-catalog-page' },
      slots: {
        'mobile-nav': '<nav data-testid="mobile-nav">Mobile nav</nav>',
        catalog: '<section data-testid="catalog-pane">Catalog</section>',
        inspector: '<section data-testid="inspector-pane">Inspector</section>',
        'context-menu': '<div data-testid="context-menu">Menu</div>',
      },
    })

    const page = wrapper.get('[data-testid="shop-catalog-page"]')

    expect(page.classes()).toContain('catalog-explorer')
    expect(page.classes()).toContain('catalog-explorer--mobile-catalog')
    expect(wrapper.findAll('.catalog-explorer__pane')).toHaveLength(2)
    expect(wrapper.get('[data-testid="mobile-nav"]').text()).toBe('Mobile nav')
    expect(wrapper.get('[data-testid="catalog-pane"]').text()).toBe('Catalog')
    expect(wrapper.get('[data-testid="inspector-pane"]').text()).toBe('Inspector')
    expect(wrapper.get('[data-testid="context-menu"]').text()).toBe('Menu')
  })

  it('marks the mobile inspector state on the shell', () => {
    const wrapper = mount(ShopCatalogExplorerShell, {
      props: { activePanel: 'inspector' },
    })

    expect(wrapper.get('.catalog-explorer').classes()).toContain('catalog-explorer--mobile-inspector')
  })
})
