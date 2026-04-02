import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ShopOrderDetailCard from '@/components/shopOrders/ShopOrderDetailCard.vue'
import type { ShopOrder } from '@/services'

const baseOrder = (overrides: Partial<ShopOrder> = {}): ShopOrder => ({
  id: 'order-1',
  jobId: 'job-1',
  uid: 'scope:employee',
  ownerUid: 'user-1',
  orderDate: '2026-03-19',
  status: 'draft',
  items: [{ description: 'Item A', quantity: 1, note: 'Note A' }],
  ...overrides,
})

describe('shop order detail card', () => {
  it('emits updated items when editing fields', async () => {
    const wrapper = mount(ShopOrderDetailCard, {
      props: {
        order: baseOrder(),
        sendingEmail: false,
        formatDate: (value) => String(value),
        isEditable: true,
        canSubmit: false,
        canOrder: false,
        canReceive: false,
      },
    })

    const inputs = wrapper.findAll('input')
    await inputs[0]?.setValue('Updated Item')
    const firstUpdatedItems = wrapper.emitted('updateItems')?.[0]?.[0] as ShopOrder['items'] | undefined
    expect(firstUpdatedItems?.[0]?.description).toBe('Updated Item')

    await inputs[1]?.setValue('3')
    const secondUpdatedItems = wrapper.emitted('updateItems')?.[1]?.[0] as ShopOrder['items'] | undefined
    expect(secondUpdatedItems?.[0]?.quantity).toBe(3)
  })

  it('emits action events for submitted workflow buttons', async () => {
    const wrapper = mount(ShopOrderDetailCard, {
      props: {
        order: baseOrder({ status: 'order' }),
        sendingEmail: false,
        formatDate: (value) => String(value),
        isEditable: false,
        canSubmit: false,
        canOrder: true,
        canReceive: true,
      },
    })

    const buttons = wrapper.findAll('button')
    await buttons[1]?.trigger('click')
    await buttons[2]?.trigger('click')

    expect(wrapper.emitted('placeOrder')).toEqual([[]])
    expect(wrapper.emitted('receive')).toEqual([[]])
  })

  it('emits deleteItem when removing a row', async () => {
    const wrapper = mount(ShopOrderDetailCard, {
      props: {
        order: baseOrder(),
        sendingEmail: false,
        formatDate: (value) => String(value),
        isEditable: true,
        canSubmit: false,
        canOrder: false,
        canReceive: false,
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
        canSubmit: false,
        canOrder: false,
        canReceive: false,
      },
    })

    const inputs = wrapper.findAll('input')
    await inputs[2]?.setValue('Need ')

    const updatedItems = wrapper.emitted('updateItems')?.[0]?.[0] as ShopOrder['items'] | undefined
    expect(updatedItems?.[0]?.note).toBe('Need ')
  })
})
