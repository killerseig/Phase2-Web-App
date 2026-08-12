import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ShopOrderCustomItemForm from '@/components/shopOrders/ShopOrderCustomItemForm.vue'

function mountForm(overrides: Partial<InstanceType<typeof ShopOrderCustomItemForm>['$props']> = {}) {
  return mount(ShopOrderCustomItemForm, {
    props: {
      description: 'Special blanket',
      disabled: false,
      note: 'Pack separately',
      quantity: '2',
      ...overrides,
    },
  })
}

describe('ShopOrderCustomItemForm', () => {
  it('renders current custom item values and emits field updates plus submit', async () => {
    const wrapper = mountForm()
    const descriptionInput = wrapper.get<HTMLInputElement>('input[placeholder="Describe the item to order"]')
    const quantityInput = wrapper.get<HTMLInputElement>('input[type="number"]')
    const noteInput = wrapper.get<HTMLInputElement>('input[placeholder="Optional note"]')

    expect(descriptionInput.element.value).toBe('Special blanket')
    expect(quantityInput.element.value).toBe('2')
    expect(noteInput.element.value).toBe('Pack separately')

    await descriptionInput.setValue('Safety glasses')
    await quantityInput.setValue('4')
    await noteInput.setValue('Need case')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('update:description')).toEqual([['Safety glasses']])
    expect(wrapper.emitted('update:quantity')).toEqual([['4']])
    expect(wrapper.emitted('update:note')).toEqual([['Need case']])
    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('can keep fields editable while only the add button is pending-disabled', () => {
    const wrapper = mountForm({ submitDisabled: true })
    const inputs = wrapper.findAll<HTMLInputElement>('input')

    expect(inputs.every((input) => input.element.disabled === false)).toBe(true)
    expect(wrapper.get<HTMLButtonElement>('button[type="submit"]').element.disabled).toBe(true)
  })

  it('disables fields and submit when the entire form is unavailable', () => {
    const wrapper = mountForm({ disabled: true })
    const inputs = wrapper.findAll<HTMLInputElement>('input')

    expect(inputs.every((input) => input.element.disabled)).toBe(true)
    expect(wrapper.get<HTMLButtonElement>('button[type="submit"]').element.disabled).toBe(true)
  })
})
