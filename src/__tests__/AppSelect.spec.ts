import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AppSelect from '@/components/common/AppSelect.vue'

describe('AppSelect', () => {
  it('renders slot options with the current selected value', () => {
    const wrapper = mount(AppSelect, {
      props: {
        modelValue: 'active',
      },
      slots: {
        default: `
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        `,
      },
    })
    const select = wrapper.get<HTMLSelectElement>('select')

    expect(select.classes()).toContain('app-select')
    expect(select.element.value).toBe('active')
    expect(wrapper.findAll('option').map((option) => option.text())).toEqual(['Active', 'Inactive'])
  })

  it('supports numeric model values through the native select value', () => {
    const wrapper = mount(AppSelect, {
      props: {
        modelValue: 2,
      },
      slots: {
        default: `
          <option value="1">One</option>
          <option value="2">Two</option>
        `,
      },
    })

    expect(wrapper.get<HTMLSelectElement>('select').element.value).toBe('2')
  })

  it('emits model updates from native change events', async () => {
    const wrapper = mount(AppSelect, {
      props: {
        modelValue: 'active',
      },
      slots: {
        default: `
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        `,
      },
    })

    await wrapper.get('select').setValue('inactive')

    expect(wrapper.emitted('update:modelValue')).toEqual([['inactive']])
  })

  it('passes attrs through and merges custom classes on the underlying select', () => {
    const wrapper = mount(AppSelect, {
      props: {
        modelValue: 'general',
      },
      attrs: {
        class: 'job-type-select',
        disabled: true,
        'aria-label': 'Job type',
        'data-testid': 'job-type',
      },
      slots: {
        default: '<option value="general">General</option>',
      },
    })
    const select = wrapper.get<HTMLSelectElement>('[data-testid="job-type"]')

    expect(select.classes()).toEqual(expect.arrayContaining(['app-select', 'job-type-select']))
    expect(select.element.disabled).toBe(true)
    expect(select.attributes('aria-label')).toBe('Job type')
  })
})
