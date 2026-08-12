import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AppCheckbox from '@/components/common/AppCheckbox.vue'

describe('AppCheckbox', () => {
  it('renders a checkbox with the current checked state', () => {
    const wrapper = mount(AppCheckbox, {
      props: {
        modelValue: true,
      },
    })
    const checkbox = wrapper.get<HTMLInputElement>('input')

    expect(checkbox.classes()).toContain('app-checkbox')
    expect(checkbox.attributes('type')).toBe('checkbox')
    expect(checkbox.element.checked).toBe(true)
  })

  it('emits boolean model updates and the native change event when toggled', async () => {
    const wrapper = mount(AppCheckbox, {
      props: {
        modelValue: false,
      },
    })
    const checkbox = wrapper.get<HTMLInputElement>('input')

    await checkbox.setValue(true)

    expect(wrapper.emitted('update:modelValue')).toEqual([[true]])
    const changeEvents = wrapper.emitted('change')
    expect(changeEvents).toHaveLength(1)
    expect(changeEvents?.[0]?.[0]).toBeInstanceOf(Event)
  })

  it('passes attrs through and merges custom classes on the underlying checkbox', () => {
    const wrapper = mount(AppCheckbox, {
      props: {
        modelValue: false,
      },
      attrs: {
        class: 'assigned-job-checkbox',
        disabled: true,
        'aria-label': 'Assign job',
        'data-testid': 'assign-job',
      },
    })
    const checkbox = wrapper.get<HTMLInputElement>('[data-testid="assign-job"]')

    expect(checkbox.classes()).toEqual(
      expect.arrayContaining(['app-checkbox', 'assigned-job-checkbox']),
    )
    expect(checkbox.element.disabled).toBe(true)
    expect(checkbox.attributes('aria-label')).toBe('Assign job')
  })
})
