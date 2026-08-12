import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ShopOrderMetaForm from '@/components/shopOrders/ShopOrderMetaForm.vue'

function mountForm(overrides: Partial<InstanceType<typeof ShopOrderMetaForm>['$props']> = {}) {
  return mount(ShopOrderMetaForm, {
    props: {
      canEdit: true,
      comments: 'Deliver to trailer',
      deliveryDate: '2026-06-18',
      minDeliveryDate: '2026-06-11',
      readonlyComments: 'Saved comments',
      readonlyDeliveryDate: '2026-06-18',
      ...overrides,
    },
  })
}

describe('ShopOrderMetaForm', () => {
  it('renders editable metadata fields and forwards field events', async () => {
    const wrapper = mountForm()

    expect(wrapper.get('[data-testid="shoporder-delivery-date"]').element).toHaveProperty('value', '2026-06-18')
    expect(wrapper.get('[data-testid="shoporder-delivery-date"]').attributes('min')).toBe('2026-06-11')
    expect(wrapper.get('[data-testid="shoporder-comments"]').element).toHaveProperty('value', 'Deliver to trailer')
    expect(wrapper.get('[data-testid="shoporder-shortcut"]').text()).toBe('Thursday Delivery')

    await wrapper.get('[data-testid="shoporder-delivery-date"]').setValue('2026-06-25')
    await wrapper.get('[data-testid="shoporder-comments"]').setValue('Bring to south gate')
    await wrapper.get('[data-testid="shoporder-shortcut"]').trigger('click')

    expect(wrapper.emitted('update:deliveryDate')).toEqual([['2026-06-25']])
    expect(wrapper.emitted('update:comments')).toEqual([['Bring to south gate']])
    expect(wrapper.emitted('applyThursdayDelivery')).toHaveLength(1)
  })

  it('renders submitted metadata as read-only with Thursday shortcut copy', () => {
    const wrapper = mountForm({
      canEdit: false,
      readonlyComments: 'Saved delivery note',
      readonlyDeliveryDate: '2026-06-18',
    })

    expect(wrapper.find('[data-testid="shoporder-delivery-date"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="shoporder-comments"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="shoporder-shortcut"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="shoporder-delivery-date-readonly"]').text()).toContain('2026-06-18')
    expect(wrapper.get('[data-testid="shoporder-shortcut-readonly"]').text()).toBe('Thursday Delivery')
    expect(wrapper.get('[data-testid="shoporder-comments-readonly"]').text()).toContain('Saved delivery note')
  })

  it('uses read-only fallbacks when saved metadata is empty', () => {
    const wrapper = mountForm({
      canEdit: false,
      readonlyComments: '',
      readonlyDeliveryDate: null,
    })

    expect(wrapper.get('[data-testid="shoporder-delivery-date-readonly"]').text()).toContain('No delivery date')
    expect(wrapper.get('[data-testid="shoporder-shortcut-readonly"]').text()).toBe('-')
    expect(wrapper.get('[data-testid="shoporder-comments-readonly"]').text()).toContain('No comments')
  })
})
