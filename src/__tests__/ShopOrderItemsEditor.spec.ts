import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ShopOrderItemsEditor from '@/components/shopOrders/ShopOrderItemsEditor.vue'
import type { ShopOrderItemRecord, ShopOrderRecord } from '@/types/domain'

function makeItem(overrides: Partial<ShopOrderItemRecord> = {}): ShopOrderItemRecord {
  return {
    id: 'order-item-1',
    sourceType: 'catalog',
    catalogItemId: 'catalog-item-1',
    description: 'AHA Book',
    quantity: 2,
    price: 12.5,
    note: 'Bring extra copies',
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
    comments: '',
    foremanUserId: 'user-1',
    foremanName: 'CJ Blanchard',
    items,
    ...overrides,
  }
}

function mountEditor(overrides: Partial<InstanceType<typeof ShopOrderItemsEditor>['$props']> = {}) {
  const selectedOrder: ShopOrderRecord | null = Object.prototype.hasOwnProperty.call(overrides, 'selectedOrder')
    ? overrides.selectedOrder ?? null
    : makeOrder(overrides.items ? { items: overrides.items } : {})

  return mount(ShopOrderItemsEditor, {
    props: {
      canEdit: true,
      itemActionLoading: false,
      items: selectedOrder?.items ?? overrides.items ?? [],
      noteDrafts: {},
      ordersCount: 1,
      ordersLoading: false,
      selectedOrder,
      ...overrides,
    },
  })
}

describe('ShopOrderItemsEditor', () => {
  it('renders editable order items and emits item edits with item ids', async () => {
    const wrapper = mountEditor({
      noteDrafts: {
        'order-item-1': 'Draft note',
      },
    })

    expect(wrapper.text()).toContain('Description')
    expect(wrapper.text()).toContain('Price')
    expect(wrapper.text()).toContain('Qty')
    expect(wrapper.text()).toContain('Total')
    expect(wrapper.text()).toContain('Note')
    expect(wrapper.text()).toContain('AHA Book')
    expect(wrapper.get('[data-testid="shoporder-order-item-price-catalog-item-1"]').text()).toBe('$12.50')
    expect(wrapper.get('[data-testid="shoporder-order-item-line-total-catalog-item-1"]').text()).toBe('$25.00')

    const quantity = wrapper.get<HTMLInputElement>('[data-testid="shoporder-order-item-qty-catalog-item-1"]')
    const note = wrapper.get<HTMLInputElement>('[data-testid="shoporder-order-item-note-catalog-item-1"]')

    expect(quantity.element.value).toBe('2')
    expect(note.element.value).toBe('Draft note')

    await quantity.setValue('5')
    await note.setValue('Need by noon')
    await note.trigger('blur')
    await wrapper.get('[data-testid="shoporder-order-item-remove-catalog-item-1"]').trigger('click')

    expect(wrapper.emitted('updateQuantity')).toEqual([['order-item-1', '5']])
    expect(wrapper.emitted('updateNoteDraft')).toEqual([['order-item-1', 'Need by noon']])
    expect(wrapper.emitted('saveNote')).toEqual([['order-item-1']])
    expect(wrapper.emitted('remove')).toEqual([['order-item-1']])
  })

  it('uses custom item ids, metadata, and disabled pending remove controls', () => {
    const customItem = makeItem({
      id: 'custom-item-1',
      sourceType: 'custom',
      catalogItemId: null,
      description: 'Special fire blanket',
      quantity: 1,
      note: '',
      sku: 'FB-12',
    })
    const wrapper = mountEditor({
      itemActionLoading: true,
      items: [customItem],
      selectedOrder: makeOrder({ items: [customItem] }),
    })

    expect(wrapper.text()).toContain('Special fire blanket')
    expect(wrapper.text()).toContain('Custom - SKU FB-12')
    expect(wrapper.find('[data-testid="shoporder-order-item-custom-item-1"]').exists()).toBe(true)
    expect(
      wrapper.get<HTMLButtonElement>('[data-testid="shoporder-order-item-remove-custom-item-1"]').element.disabled,
    ).toBe(true)
  })

  it('renders read-only quantity and note values without edit controls', () => {
    const wrapper = mountEditor({
      canEdit: false,
    })

    expect(wrapper.get('[data-testid="shoporder-order-item-qty-readonly-catalog-item-1"]').text()).toBe('2')
    expect(wrapper.get('[data-testid="shoporder-order-item-price-catalog-item-1"]').text()).toBe('$12.50')
    expect(wrapper.get('[data-testid="shoporder-order-item-line-total-catalog-item-1"]').text()).toBe('$25.00')
    expect(wrapper.get('[data-testid="shoporder-order-item-note-readonly-catalog-item-1"]').text()).toBe(
      'Bring extra copies',
    )
    expect(wrapper.find('[data-testid="shoporder-order-item-qty-catalog-item-1"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="shoporder-order-item-remove-catalog-item-1"]').exists()).toBe(false)
  })

  it('renders the correct empty states for loading, no selected order, and empty orders', () => {
    expect(
      mountEditor({
        ordersLoading: true,
        ordersCount: 0,
        selectedOrder: null,
        items: [],
      }).text(),
    ).toContain('Loading orders...')

    expect(
      mountEditor({
        selectedOrder: null,
        items: [],
      }).text(),
    ).toContain('Add a catalog item or custom item to start a new order.')

    expect(
      mountEditor({
        items: [],
        selectedOrder: makeOrder({ items: [] }),
      }).text(),
    ).toContain('Nothing has been added to this order yet.')
  })
})
