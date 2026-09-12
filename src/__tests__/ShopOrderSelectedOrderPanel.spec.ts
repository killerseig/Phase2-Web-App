import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ShopOrderSelectedOrderPanel from '@/components/shopOrders/ShopOrderSelectedOrderPanel.vue'
import type { ShopOrderItemRecord, ShopOrderRecord } from '@/types/domain'

function makeItem(overrides: Partial<ShopOrderItemRecord> = {}): ShopOrderItemRecord {
  return {
    id: 'item-1',
    sourceType: 'catalog',
    catalogItemId: 'catalog-item-1',
    description: 'AHA Book',
    quantity: 1,
    price: 12.5,
    note: '',
    categoryId: 'category-1',
    sku: null,
    ...overrides,
  }
}

function makeOrder(overrides: Partial<ShopOrderRecord> = {}): ShopOrderRecord {
  return {
    id: 'order-1',
    jobId: 'job-1',
    jobCode: '736',
    jobName: 'Shop',
    orderNumber: '202606110001',
    deliveryDate: '2026-06-18',
    status: 'draft',
    comments: 'Deliver to trailer',
    foremanUserId: 'user-1',
    foremanName: 'CJ Blanchard',
    items: [makeItem()],
    createdAt: new Date('2026-06-11T14:30:00Z'),
    ...overrides,
  }
}

function mountPanel(overrides: Partial<InstanceType<typeof ShopOrderSelectedOrderPanel>['$props']> = {}) {
  const order = makeOrder()

  return mount(ShopOrderSelectedOrderPanel, {
    props: {
      canEdit: true,
      comments: order.comments,
      deliveryDate: order.deliveryDate ?? '',
      itemCount: 1,
      minDeliveryDate: '2026-06-11',
      order,
      orderEstimatedTotal: 12.5,
      totalQuantity: 1,
      ...overrides,
    },
  })
}

describe('ShopOrderSelectedOrderPanel', () => {
  it('renders editable order metadata, badges, and parent-owned input values', async () => {
    const wrapper = mountPanel()

    expect(wrapper.text()).toContain('Order #202606110001')
    expect(wrapper.text()).toContain('Draft / Due 2026-06-18')
    expect(wrapper.text()).toContain('Draft')
    expect(wrapper.text()).toContain('1 item')
    expect(wrapper.text()).toContain('1 total qty')
    expect(wrapper.text()).toContain('CJ Blanchard')
    expect(wrapper.text()).toContain('Created Jun')
    expect(wrapper.get('[data-testid="shoporder-delivery-date"]').element).toHaveProperty('value', '2026-06-18')
    expect(wrapper.get('[data-testid="shoporder-delivery-date"]').attributes('min')).toBe('2026-06-11')
    expect(wrapper.get('[data-testid="shoporder-comments"]').element).toHaveProperty('value', 'Deliver to trailer')

    await wrapper.get('[data-testid="shoporder-delivery-date"]').setValue('2026-06-25')
    await wrapper.get('[data-testid="shoporder-comments"]').setValue('Bring to south gate')
    await wrapper.get('[data-testid="shoporder-shortcut"]').trigger('click')

    expect(wrapper.emitted('update:deliveryDate')).toEqual([['2026-06-25']])
    expect(wrapper.emitted('update:comments')).toEqual([['Bring to south gate']])
    expect(wrapper.emitted('applyThursdayDelivery')).toHaveLength(1)
  })

  it('renders submitted orders as read-only with submitted metadata and Thursday shortcut copy', () => {
    const order = makeOrder({
      status: 'submitted',
      submittedAt: new Date('2026-06-12T18:00:00Z'),
    })

    const wrapper = mountPanel({
      canEdit: false,
      itemCount: 2,
      order,
      totalQuantity: 4,
    })

    expect(wrapper.text()).toContain('Submitted / Due 2026-06-18')
    expect(wrapper.text()).toContain('Submitted')
    expect(wrapper.text()).toContain('2 items')
    expect(wrapper.text()).toContain('4 total qty')
    expect(wrapper.text()).toContain('Thursday Delivery')
    expect(wrapper.text()).toContain('Submitted Jun')
    expect(wrapper.find('[data-testid="shoporder-delivery-date"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="shoporder-comments"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="shoporder-shortcut"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="shoporder-delivery-date-readonly"]').text()).toContain('2026-06-18')
    expect(wrapper.get('[data-testid="shoporder-comments-readonly"]').text()).toContain('Deliver to trailer')
  })

  it('uses read-only fallbacks for missing delivery date, comments, shortcut, and owner', () => {
    const order = makeOrder({
      comments: '',
      deliveryDate: null,
      foremanName: null,
      status: 'submitted',
    })

    const wrapper = mountPanel({
      canEdit: false,
      order,
    })

    expect(wrapper.text()).toContain('Unknown owner')
    expect(wrapper.get('[data-testid="shoporder-delivery-date-readonly"]').text()).toContain('No delivery date')
    expect(wrapper.get('[data-testid="shoporder-shortcut-readonly"]').text()).toBe('-')
    expect(wrapper.get('[data-testid="shoporder-comments-readonly"]').text()).toContain('No comments')
  })
})
