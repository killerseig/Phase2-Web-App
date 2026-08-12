import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AppReadonlyField from '@/components/common/AppReadonlyField.vue'

describe('AppReadonlyField', () => {
  it('renders readonly content in a field shell', () => {
    const wrapper = mount(AppReadonlyField, {
      slots: {
        default: '2026-07-16',
      },
    })

    expect(wrapper.classes()).toContain('app-readonly-field')
    expect(wrapper.text()).toBe('2026-07-16')
  })

  it('supports multiline presentation', () => {
    const wrapper = mount(AppReadonlyField, {
      props: {
        multiline: true,
      },
      slots: {
        default: 'Deliver to trailer\nCall first',
      },
    })

    expect(wrapper.classes()).toContain('app-readonly-field--multiline')
    expect(wrapper.text()).toContain('Deliver to trailer')
    expect(wrapper.text()).toContain('Call first')
  })

  it('passes attrs and custom classes through to the root field', () => {
    const wrapper = mount(AppReadonlyField, {
      attrs: {
        class: 'shop-order-selected-panel__readonly',
        'data-testid': 'readonly-delivery-date',
        title: 'Delivery date',
      },
      slots: {
        default: 'No delivery date',
      },
    })

    expect(wrapper.classes()).toEqual(expect.arrayContaining([
      'app-readonly-field',
      'shop-order-selected-panel__readonly',
    ]))
    expect(wrapper.attributes('data-testid')).toBe('readonly-delivery-date')
    expect(wrapper.attributes('title')).toBe('Delivery date')
  })
})
