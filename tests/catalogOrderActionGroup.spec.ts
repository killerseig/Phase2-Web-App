import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CatalogOrderActionGroup from '@/components/catalog/CatalogOrderActionGroup.vue'

describe('CatalogOrderActionGroup', () => {
  it('shows the selected quantity badge and emits sanitized qty updates', async () => {
    const wrapper = mount(CatalogOrderActionGroup, {
      props: {
        quantity: 2,
        selectedQuantity: 3,
      },
    })

    expect(wrapper.text()).toContain('x3')

    await wrapper.get('input[aria-label="Quantity"]').setValue('4.8')
    expect(wrapper.emitted('update:qty')).toEqual([[4]])
  })

  it('falls back invalid quantities to one and emits add clicks', async () => {
    const wrapper = mount(CatalogOrderActionGroup, {
      props: {
        quantity: 1,
      },
    })

    await wrapper.get('input[aria-label="Quantity"]').setValue('0')
    await wrapper.get('button[aria-label="Add to order"]').trigger('click')

    expect(wrapper.emitted('update:qty')).toEqual([[1]])
    expect(wrapper.emitted('add')).toHaveLength(1)
  })
})
