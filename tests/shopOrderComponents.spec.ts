import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ShopOrderListCard from '@/components/shopOrders/ShopOrderListCard.vue'
import type { ShopOrder } from '@/services'

const baseOrder = (overrides: Partial<ShopOrder> = {}): ShopOrder => ({
  id: 'order-1',
  jobId: 'job-1',
  uid: 'scope:employee',
  ownerUid: 'user-1',
  orderDate: '2026-03-19',
  status: 'draft',
  items: [],
  ...overrides,
})

describe('shop order components', () => {
  it('renders orders and emits select/delete events', async () => {
    const wrapper = mount(ShopOrderListCard, {
      props: {
        orders: [
          baseOrder({ id: 'order-1', items: [{ description: 'Item A', quantity: 1 }] }),
          baseOrder({ id: 'order-2', status: 'order' }),
        ],
        loading: false,
        selectedId: 'order-1',
        deletingOrderId: null,
        formatDate: (value) => String(value),
      },
    })

    const items = wrapper.findAll('.order-list-item')
    expect(items).toHaveLength(2)

    await items[0]?.trigger('click')
    expect(wrapper.emitted('select')).toEqual([['order-1']])

    await wrapper.get('.order-delete-btn').trigger('click')
    expect(wrapper.emitted('delete')).toEqual([['order-1']])
  })
})
