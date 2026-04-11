import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ShopOrderDetailCard from '@/components/shopOrders/ShopOrderDetailCard.vue'
import type { ShopOrder } from '@/services'

const baseOrder = (overrides: Partial<ShopOrder> = {}): ShopOrder => ({
  id: 'order-1',
  jobId: 'job-1',
  uid: 'scope:employee',
  ownerUid: 'user-1',
  orderNumber: '24001',
  orderDate: '2026-03-19',
  status: 'draft',
  requestedDeliveryDate: '',
  items: [{ description: 'Item A', quantity: 1, note: 'Note A' }],
  ...overrides,
})

describe('shop order detail card', () => {
  it('renders the stored order number in the header', () => {
    const wrapper = mount(ShopOrderDetailCard, {
      props: {
        order: baseOrder({ orderNumber: '51234' }),
        sendingEmail: false,
        formatDate: (value) => String(value),
        isEditable: true,
        canManageReceipt: false,
        canSendEmail: true,
        requestedDeliveryDate: '',
      },
    })

    expect(wrapper.text()).toContain('Order #51234')
  })

  it('emits updated items when editing draft fields', async () => {
    const wrapper = mount(ShopOrderDetailCard, {
      props: {
        order: baseOrder(),
        sendingEmail: false,
        formatDate: (value) => String(value),
        isEditable: true,
        canManageReceipt: false,
        canSendEmail: true,
        requestedDeliveryDate: '',
      },
    })

    const inputs = wrapper.findAll('input')
    await inputs[1]?.setValue('Updated Item')
    const firstUpdatedItems = wrapper.emitted('updateItems')?.[0]?.[0] as ShopOrder['items'] | undefined
    expect(firstUpdatedItems?.[0]?.description).toBe('Updated Item')

    await inputs[2]?.setValue('3')
    const secondUpdatedItems = wrapper.emitted('updateItems')?.[1]?.[0] as ShopOrder['items'] | undefined
    expect(secondUpdatedItems?.[0]?.quantity).toBe(3)
  })

  it('emits requested delivery date updates', async () => {
    const wrapper = mount(ShopOrderDetailCard, {
      props: {
        order: baseOrder(),
        sendingEmail: false,
        formatDate: (value) => String(value),
        isEditable: true,
        canManageReceipt: false,
        canSendEmail: true,
        requestedDeliveryDate: '',
      },
    })

    await wrapper.find('input[type="date"]').setValue('2026-04-18')

    expect(wrapper.emitted('update:requestedDeliveryDate')).toEqual([['2026-04-18']])
  })

  it('emits updated receipt quantities for submitted orders', async () => {
    const wrapper = mount(ShopOrderDetailCard, {
      props: {
        order: baseOrder({
          status: 'submitted',
          items: [{ description: 'Item A', quantity: 3, note: 'Note A' }],
        }),
        sendingEmail: false,
        formatDate: (value) => String(value),
        isEditable: false,
        canManageReceipt: true,
        canSendEmail: true,
        requestedDeliveryDate: '2026-04-18',
      },
    })

    const inputs = wrapper.findAll('input')
    await inputs[0]?.setValue('1')
    const updatedItems = wrapper.emitted('updateItems')?.[0]?.[0] as ShopOrder['items'] | undefined
    expect(updatedItems?.[0]?.receivedQuantity).toBe(1)
  })

  it('emits deleteItem when removing a row', async () => {
    const wrapper = mount(ShopOrderDetailCard, {
      props: {
        order: baseOrder(),
        sendingEmail: false,
        formatDate: (value) => String(value),
        isEditable: true,
        canManageReceipt: false,
        canSendEmail: true,
        requestedDeliveryDate: '',
      },
    })

    const deleteButton = wrapper.find('button[title="Delete row"]')
    await deleteButton.trigger('click')

    expect(wrapper.emitted('deleteItem')).toEqual([[0]])
  })

  it('preserves trailing spaces while typing in the note field', async () => {
    const wrapper = mount(ShopOrderDetailCard, {
      props: {
        order: baseOrder(),
        sendingEmail: false,
        formatDate: (value) => String(value),
        isEditable: true,
        canManageReceipt: false,
        canSendEmail: true,
        requestedDeliveryDate: '',
      },
    })

    const inputs = wrapper.findAll('input')
    await inputs[3]?.setValue('Need ')

    const updatedItems = wrapper.emitted('updateItems')?.[0]?.[0] as ShopOrder['items'] | undefined
    expect(updatedItems?.[0]?.note).toBe('Need ')
  })
})
