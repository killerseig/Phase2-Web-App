import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ShopOrderEditorSection from '@/components/shopOrders/ShopOrderEditorSection.vue'
import ShopOrdersFilterToolbar from '@/components/shopOrders/ShopOrdersFilterToolbar.vue'
import type { ShopOrder } from '@/services'

const baseOrder: ShopOrder = {
  id: 'order-1',
  jobId: 'job-1',
  uid: 'scope:employee',
  ownerUid: 'user-1',
  orderDate: '2026-03-19',
  status: 'draft',
  items: [{ description: 'Item A', quantity: 1, note: 'Note A' }],
}

describe('shop order section components', () => {
  it('emits search and filter updates from the toolbar', async () => {
    const wrapper = mount(ShopOrdersFilterToolbar, {
      props: {
        search: 'gloves',
        statusFilter: 'all',
        statusOptions: [
          { value: 'all', label: 'All Statuses' },
          { value: 'draft', label: 'Draft' },
        ],
      },
    })

    await wrapper.get('input[type="text"]').setValue('scaffold')
    await wrapper.get('select').setValue('draft')

    expect(wrapper.emitted('update:search')).toEqual([['scaffold']])
    expect(wrapper.emitted('update:statusFilter')).toEqual([['draft']])
  })

  it('sanitizes custom item quantity updates in the editor section', async () => {
    const wrapper = mount(ShopOrderEditorSection, {
      props: {
        selected: baseOrder,
        sendingEmail: false,
        formatDate: (value) => String(value),
        catalog: [],
        categories: [],
        catalogItemQtys: {},
        selectedItemQuantities: {},
        newItemDescription: '',
        newItemQty: '',
        newItemNote: '',
      },
    })

    await wrapper.get('input[placeholder="Qty"]').setValue('12abc')

    expect(wrapper.emitted('update:newItemQty')).toEqual([['12']])
  })
})
