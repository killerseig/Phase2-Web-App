import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ShopOrderPageShell from '@/components/shopOrders/ShopOrderPageShell.vue'

const AppShellStub = {
  name: 'AppShell',
  template: '<div data-testid="app-shell"><main><slot /></main></div>',
}

const ShopOrderExplorerShellStub = {
  name: 'ShopOrderExplorerShell',
  inheritAttrs: false,
  props: ['testId'],
  template: `
    <section v-bind="$attrs" :data-testid="testId" data-shell="shop-order-explorer">
      <div data-testid="catalog-slot"><slot name="catalog" /></div>
      <div data-testid="workspace-slot"><slot name="workspace" /></div>
    </section>
  `,
}

describe('ShopOrderPageShell', () => {
  it('composes the app shell, explorer shell, forwarded attrs, named slots, and default slot', () => {
    const wrapper = mount(ShopOrderPageShell, {
      props: {
        testId: 'shop-orders-page',
      },
      attrs: {
        class: 'shop-order-page-test',
      },
      slots: {
        catalog: '<section data-testid="catalog-pane">Catalog</section>',
        workspace: '<section data-testid="workspace-pane">Workspace</section>',
        default: '<div data-testid="shop-order-dialogs">Dialogs</div>',
      },
      global: {
        stubs: {
          AppShell: AppShellStub,
          ShopOrderExplorerShell: ShopOrderExplorerShellStub,
        },
      },
    })

    const explorer = wrapper.get('[data-testid="shop-orders-page"]')

    expect(wrapper.find('[data-testid="app-shell"]').exists()).toBe(true)
    expect(explorer.classes()).toContain('shop-order-page-test')
    expect(explorer.attributes('data-shell')).toBe('shop-order-explorer')
    expect(wrapper.get('[data-testid="catalog-slot"]').text()).toBe('Catalog')
    expect(wrapper.get('[data-testid="workspace-slot"]').text()).toBe('Workspace')
    expect(wrapper.get('[data-testid="shop-order-dialogs"]').text()).toBe('Dialogs')
  })
})
