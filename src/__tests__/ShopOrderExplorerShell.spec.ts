import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ShopOrderExplorerShell from '@/components/shopOrders/ShopOrderExplorerShell.vue'

describe('ShopOrderExplorerShell', () => {
  it('renders the shared shop order explorer chrome around catalog and workspace panes', () => {
    const wrapper = mount(ShopOrderExplorerShell, {
      props: {
        testId: 'shop-orders-page',
      },
      slots: {
        catalog: '<section data-testid="catalog-pane">Catalog</section>',
        workspace: '<section data-testid="workspace-pane">Workspace</section>',
      },
    })

    const page = wrapper.get('[data-testid="shop-orders-page"]')
    const panes = wrapper.findAll('.shop-orders-explorer__pane')

    expect(page.classes()).toContain('shop-orders-explorer')
    expect(panes).toHaveLength(2)
    expect(wrapper.get('[data-testid="catalog-pane"]').text()).toBe('Catalog')
    expect(wrapper.get('[data-testid="workspace-pane"]').text()).toBe('Workspace')
  })
})
