import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AppField from '@/components/common/AppField.vue'

describe('AppField', () => {
  it('renders label text and default slot content', () => {
    const wrapper = mount(AppField, {
      props: {
        label: 'Job Name',
      },
      slots: {
        default: '<input data-testid="job-name" />',
      },
    })

    expect(wrapper.get('label').classes()).toContain('app-field')
    expect(wrapper.get('.app-field__label').text()).toBe('Job Name')
    expect(wrapper.find('[data-testid="job-name"]').exists()).toBe(true)
  })

  it('omits the label element when no label is provided', () => {
    const wrapper = mount(AppField, {
      slots: {
        default: '<input data-testid="unnamed-field" />',
      },
    })

    expect(wrapper.find('.app-field__label').exists()).toBe(false)
    expect(wrapper.find('[data-testid="unnamed-field"]').exists()).toBe(true)
  })

  it('renders help slot content when provided', () => {
    const wrapper = mount(AppField, {
      props: {
        label: 'Burden',
      },
      slots: {
        default: '<input />',
        help: 'Use decimal format.',
      },
    })

    expect(wrapper.get('.app-field__help').text()).toBe('Use decimal format.')
  })

  it('passes attrs through and merges custom classes on the root label', () => {
    const wrapper = mount(AppField, {
      props: {
        label: 'Email',
      },
      attrs: {
        class: 'users-form__field',
        'data-testid': 'email-field',
        for: 'email-input',
      },
      slots: {
        default: '<input id="email-input" />',
      },
    })
    const field = wrapper.get('[data-testid="email-field"]')

    expect(field.classes()).toEqual(expect.arrayContaining(['app-field', 'users-form__field']))
    expect(field.attributes('for')).toBe('email-input')
  })
})
