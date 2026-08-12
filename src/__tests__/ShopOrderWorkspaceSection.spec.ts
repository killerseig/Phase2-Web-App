import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ShopOrderWorkspaceSection from '@/components/shopOrders/ShopOrderWorkspaceSection.vue'

describe('ShopOrderWorkspaceSection', () => {
  it('renders the section title, body slot, and action slot', () => {
    const wrapper = mount(ShopOrderWorkspaceSection, {
      props: {
        title: 'Added Items',
      },
      attrs: {
        'data-testid': 'workspace-section',
      },
      slots: {
        actions: '<span data-testid="section-action">2 items</span>',
        default: '<div data-testid="section-body">AHA Book</div>',
      },
    })

    expect(wrapper.get('[data-testid="workspace-section"]').classes()).toContain('shop-order-workspace-section')
    expect(wrapper.text()).toContain('Added Items')
    expect(wrapper.get('[data-testid="section-action"]').text()).toBe('2 items')
    expect(wrapper.get('[data-testid="section-body"]').text()).toBe('AHA Book')
  })

  it('renders without an action slot', () => {
    const wrapper = mount(ShopOrderWorkspaceSection, {
      props: {
        title: 'Order History',
      },
      slots: {
        default: '<div>No shop orders exist for this job yet.</div>',
      },
    })

    expect(wrapper.text()).toContain('Order History')
    expect(wrapper.text()).toContain('No shop orders exist for this job yet.')
  })
})
