import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ShopOrderWorkspacePane from '@/components/shopOrders/ShopOrderWorkspacePane.vue'
import type { JobRecord, ShopOrderItemRecord, ShopOrderRecord } from '@/types/domain'

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

function makeItem(overrides: Partial<ShopOrderItemRecord> = {}): ShopOrderItemRecord {
  return {
    id: 'order-item-1',
    sourceType: 'catalog',
    catalogItemId: 'catalog-item-1',
    description: 'AHA Book',
    quantity: 2,
    price: 12.5,
    note: 'Need two copies',
    categoryId: 'category-1',
    sku: null,
    ...overrides,
  }
}

function makeOrder(overrides: Partial<ShopOrderRecord> = {}): ShopOrderRecord {
  const items = overrides.items ?? [makeItem()]

  return {
    id: 'order-1',
    jobId: 'job-1',
    jobCode: '736',
    jobName: 'Shop',
    orderNumber: '202607140001',
    deliveryDate: '2026-07-16',
    status: 'draft',
    comments: 'Deliver to trailer',
    foremanUserId: 'user-1',
    foremanName: 'CJ Blanchard',
    items,
    ...overrides,
  }
}

function mountPane(overrides = {}) {
  const selectedOrder = makeOrder()
  const orders = [
    selectedOrder,
    makeOrder({
      id: 'order-2',
      orderNumber: '202607140002',
      status: 'submitted',
    }),
  ]

  return mount(ShopOrderWorkspacePane, {
    props: {
      canEditSelectedOrder: true,
      comments: selectedOrder.comments,
      createOrderLoading: false,
      deliveryDate: selectedOrder.deliveryDate ?? '',
      draftOrdersCount: 1,
      itemActionLoading: false,
      itemCount: selectedOrder.items.length,
      items: selectedOrder.items,
      job: makeJob(),
      minDeliveryDate: '2026-07-14',
      noteDrafts: {},
      orderEstimatedTotal: 25,
      orders,
      ordersCount: orders.length,
      ordersLoading: false,
      selectedOrder,
      selectedOrderId: selectedOrder.id,
      submittedOrdersCount: 1,
      totalQuantity: 2,
      ...overrides,
    },
  })
}

describe('ShopOrderWorkspacePane', () => {
  it('renders job, selected order summary, item summary, and history summary', () => {
    const wrapper = mountPane()

    expect(wrapper.text()).toContain('Order Workspace')
    expect(wrapper.text()).toContain('736 - Shop')
    expect(wrapper.text()).toContain('Order #202607140001')
    expect(wrapper.text()).toContain('Draft / Due 2026-07-16')
    expect(wrapper.text()).toContain('1 item')
    expect(wrapper.text()).toContain('2 total qty')
    expect(wrapper.get('[data-testid="shoporder-submit-total"]').text()).toContain('$25.00')
    expect(wrapper.text()).toContain('Added Items')
    expect(wrapper.text()).toContain('AHA Book')
    expect(wrapper.text()).toContain('Order History')
    expect(wrapper.text()).toContain('1 draft')
    expect(wrapper.text()).toContain('1 submitted')
  })

  it('emits top-level order action events', async () => {
    const wrapper = mountPane()

    await wrapper.get('[data-testid="shoporder-submit"]').trigger('click')
    await wrapper.get('.shop-orders-draft-delete-button').trigger('click')

    expect(wrapper.emitted('submit-order')).toHaveLength(1)
    expect(wrapper.emitted('delete-selected-order')).toHaveLength(1)
  })

  it('forwards selected order metadata and item editor events', async () => {
    const wrapper = mountPane()

    await wrapper.get('[data-testid="shoporder-delivery-date"]').setValue('2026-07-23')
    await wrapper.get('[data-testid="shoporder-comments"]').setValue('Bring to south gate')
    await wrapper.get('[data-testid="shoporder-shortcut"]').trigger('click')
    await wrapper.get('[data-testid="shoporder-order-item-qty-catalog-item-1"]').setValue('4')
    await wrapper.get('[data-testid="shoporder-order-item-note-catalog-item-1"]').setValue('Box separately')
    await wrapper.get('[data-testid="shoporder-order-item-note-catalog-item-1"]').trigger('blur')
    await wrapper.get('[data-testid="shoporder-order-item-remove-catalog-item-1"]').trigger('click')

    expect(wrapper.emitted('update:delivery-date')).toEqual([['2026-07-23']])
    expect(wrapper.emitted('update:comments')).toEqual([['Bring to south gate']])
    expect(wrapper.emitted('apply-thursday-delivery')).toHaveLength(1)
    expect(wrapper.emitted('update-quantity')).toEqual([['order-item-1', '4']])
    expect(wrapper.emitted('update-note-draft')).toEqual([['order-item-1', 'Box separately']])
    expect(wrapper.emitted('save-note')).toEqual([['order-item-1']])
    expect(wrapper.emitted('remove-item')).toEqual([['order-item-1']])
  })

  it('emits history selection and hides edit controls for submitted orders', async () => {
    const submittedOrder = makeOrder({
      id: 'order-submitted',
      orderNumber: '202607140003',
      status: 'submitted',
    })
    const wrapper = mountPane({
      canEditSelectedOrder: false,
      selectedOrder: submittedOrder,
      selectedOrderId: submittedOrder.id,
      orders: [submittedOrder],
      items: submittedOrder.items,
    })

    await wrapper.get('.shop-orders-history-row').trigger('click')

    expect(wrapper.emitted('select-order')).toEqual([['order-submitted']])
    expect(wrapper.find('[data-testid="shoporder-submit"]').exists()).toBe(false)
    expect(wrapper.find('.shop-orders-draft-delete-button').exists()).toBe(false)
    expect(wrapper.get('[data-testid="shoporder-delivery-date-readonly"]').text()).toContain('2026-07-16')
    expect(wrapper.get('[data-testid="shoporder-order-item-qty-readonly-catalog-item-1"]').text()).toBe('2')
  })

  it('renders the empty workspace state without a selected order', () => {
    const wrapper = mountPane({
      selectedOrder: null,
      selectedOrderId: null,
      items: [],
      itemCount: 0,
      orderEstimatedTotal: null,
      totalQuantity: 0,
      orders: [],
      ordersCount: 0,
      draftOrdersCount: 0,
      submittedOrdersCount: 0,
    })

    expect(wrapper.text()).toContain('Add a catalog item or custom item to start a new order.')
    expect(wrapper.text()).toContain('No shop orders exist for this job yet.')
  })
})
