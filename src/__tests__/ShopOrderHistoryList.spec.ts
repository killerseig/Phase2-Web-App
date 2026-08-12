import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ShopOrderHistoryList from '@/components/shopOrders/ShopOrderHistoryList.vue'
import type { ShopOrderItemRecord, ShopOrderRecord } from '@/types/domain'

function makeItem(overrides: Partial<ShopOrderItemRecord> = {}): ShopOrderItemRecord {
  return {
    id: 'item-1',
    sourceType: 'catalog',
    catalogItemId: 'catalog-item-1',
    description: 'AHA Book',
    quantity: 1,
    price: null,
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
    comments: '',
    foremanUserId: 'user-1',
    foremanName: 'CJ Blanchard',
    items: [makeItem()],
    createdAt: new Date('2026-06-11T14:30:00Z'),
    ...overrides,
  }
}

describe('ShopOrderHistoryList', () => {
  it('renders the empty history state when no orders exist', () => {
    const wrapper = mount(ShopOrderHistoryList, {
      props: {
        orders: [],
        selectedOrderId: null,
      },
    })

    expect(wrapper.text()).toContain('No shop orders exist for this job yet.')
    expect(wrapper.find('.shop-orders-history-row').exists()).toBe(false)
  })

  it('renders order history rows with numbers, dates, counts, status, and active state', () => {
    const draftOrder = makeOrder()
    const submittedOrder = makeOrder({
      id: 'order-2',
      orderNumber: null,
      deliveryDate: null,
      status: 'submitted',
      items: [makeItem(), makeItem({ id: 'item-2', description: 'Foreman Book' })],
      createdAt: new Date('2026-06-12T15:45:00Z'),
      submittedAt: new Date('2026-06-13T16:00:00Z'),
    })

    const wrapper = mount(ShopOrderHistoryList, {
      props: {
        orders: [draftOrder, submittedOrder],
        selectedOrderId: submittedOrder.id,
      },
    })

    expect(wrapper.text()).toContain('Draft / Due 2026-06-18')
    expect(wrapper.text()).toContain('Order #202606110001')
    expect(wrapper.text()).toContain('1 items')
    expect(wrapper.text()).toContain('2026-06-18')
    expect(wrapper.text()).toContain('Submitted / Jun')
    expect(wrapper.text()).toContain('Order #20260612154500')
    expect(wrapper.text()).toContain('2 items')
    expect(wrapper.text()).toContain('No delivery date')
    expect(wrapper.get('.shop-orders-history-row--active').text()).toContain('Submitted')
  })

  it('emits selected order ids from history rows', async () => {
    const wrapper = mount(ShopOrderHistoryList, {
      props: {
        orders: [makeOrder()],
        selectedOrderId: null,
      },
    })

    await wrapper.get('.shop-orders-history-row').trigger('click')

    expect(wrapper.emitted('select')).toEqual([['order-1']])
  })
})
