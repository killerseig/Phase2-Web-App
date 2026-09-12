import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ShopOrderWorkspaceHeader from '@/components/shopOrders/ShopOrderWorkspaceHeader.vue'
import type { JobRecord } from '@/types/domain'

function makeJob(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    id: 'job-1',
    name: 'Shop',
    code: '736',
    gc: 'Phase 2',
    type: 'general',
    active: true,
    assignedForemanIds: [],
    ...overrides,
  }
}

function mountHeader(overrides: Partial<InstanceType<typeof ShopOrderWorkspaceHeader>['$props']> = {}) {
  return mount(ShopOrderWorkspaceHeader, {
    props: {
      canSubmitOrder: true,
      createOrderLoading: false,
      itemActionLoading: false,
      job: makeJob(),
      orderEstimatedTotal: 37.5,
      ...overrides,
    },
  })
}

describe('ShopOrderWorkspaceHeader', () => {
  it('renders the workspace title and forwards order action events', async () => {
    const wrapper = mountHeader()

    expect(wrapper.text()).toContain('Order Workspace')
    expect(wrapper.text()).toContain('736 - Shop')
    expect(wrapper.get('[data-testid="shoporder-submit-total"]').text()).toContain('Estimated Total')
    expect(wrapper.get('[data-testid="shoporder-submit-total"]').text()).toContain('$37.50')

    await wrapper.get('[data-testid="shoporder-submit"]').trigger('click')

    expect(wrapper.emitted('submitOrder')).toHaveLength(1)
  })

  it('uses fallback title copy and hides submit when the order cannot be submitted', () => {
    const wrapper = mountHeader({
      canSubmitOrder: false,
      job: makeJob({ code: '', name: 'Unnumbered Job' }),
    })

    expect(wrapper.text()).toContain('No Job # - Unnumbered Job')
    expect(wrapper.find('[data-testid="shoporder-submit"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="shoporder-submit-total"]').exists()).toBe(false)
  })

  it('shows a no-priced-items fallback when a draft has no priced catalog items', () => {
    const wrapper = mountHeader({
      orderEstimatedTotal: null,
    })

    expect(wrapper.get('[data-testid="shoporder-submit-total"]').text()).toContain('No priced items')
  })

  it('disables actions for create loading and item action states', () => {
    const loading = mountHeader({
      createOrderLoading: true,
    })

    expect(loading.get<HTMLButtonElement>('[data-testid="shoporder-submit"]').element.disabled).toBe(true)

    const blocked = mountHeader({
      itemActionLoading: true,
    })

    expect(blocked.get<HTMLButtonElement>('[data-testid="shoporder-submit"]').element.disabled).toBe(true)
  })

  it('uses the current-job fallback when no job context is loaded', () => {
    const wrapper = mountHeader({ job: null })

    expect(wrapper.text()).toContain('Current Job')
  })
})
