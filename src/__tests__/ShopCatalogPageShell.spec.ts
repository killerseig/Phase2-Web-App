import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ShopCatalogPageShell from '@/components/shopCatalog/ShopCatalogPageShell.vue'

const AppShellStub = {
  name: 'AppShell',
  template: '<div data-testid="app-shell"><main><slot /></main></div>',
}

const ShopCatalogExplorerShellStub = {
  name: 'ShopCatalogExplorerShell',
  inheritAttrs: false,
  props: ['activePanel', 'testId'],
  template: `
    <section
      v-bind="$attrs"
      :data-testid="testId"
      data-shell="shop-catalog-explorer"
      :data-active-panel="activePanel"
    >
      <div data-testid="mobile-nav-slot"><slot name="mobile-nav" /></div>
      <div data-testid="catalog-slot"><slot name="catalog" /></div>
      <div data-testid="inspector-slot"><slot name="inspector" /></div>
      <div data-testid="context-menu-slot"><slot name="context-menu" /></div>
    </section>
  `,
}

describe('ShopCatalogPageShell', () => {
  it('composes the app shell, explorer shell, forwarded attrs, feature slots, and dialog slot', () => {
    const wrapper = mount(ShopCatalogPageShell, {
      props: {
        activePanel: 'inspector',
        testId: 'shop-catalog-page',
      },
      attrs: {
        class: 'shop-catalog-page-test',
      },
      slots: {
        'mobile-nav': '<nav data-testid="mobile-nav">Mobile nav</nav>',
        catalog: '<section data-testid="catalog-pane">Catalog</section>',
        inspector: '<section data-testid="inspector-pane">Inspector</section>',
        'context-menu': '<div data-testid="context-menu">Menu</div>',
        default: '<div data-testid="catalog-dialogs">Dialogs</div>',
      },
      global: {
        stubs: {
          AppShell: AppShellStub,
          ShopCatalogExplorerShell: ShopCatalogExplorerShellStub,
        },
      },
    })

    const explorer = wrapper.get('[data-testid="shop-catalog-page"]')

    expect(wrapper.find('[data-testid="app-shell"]').exists()).toBe(true)
    expect(explorer.classes()).toContain('shop-catalog-page-test')
    expect(explorer.attributes('data-shell')).toBe('shop-catalog-explorer')
    expect(explorer.attributes('data-active-panel')).toBe('inspector')
    expect(wrapper.get('[data-testid="mobile-nav-slot"]').text()).toBe('Mobile nav')
    expect(wrapper.get('[data-testid="catalog-slot"]').text()).toBe('Catalog')
    expect(wrapper.get('[data-testid="inspector-slot"]').text()).toBe('Inspector')
    expect(wrapper.get('[data-testid="context-menu-slot"]').text()).toBe('Menu')
    expect(wrapper.get('[data-testid="catalog-dialogs"]').text()).toBe('Dialogs')
  })
})
