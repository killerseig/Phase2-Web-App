import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AppTextInput from '@/components/common/AppTextInput.vue'

describe('AppTextInput', () => {
  it('renders a text input by default with the current value', () => {
    const wrapper = mount(AppTextInput, {
      props: {
        modelValue: 'Lucky 3 Ranch',
      },
    })
    const input = wrapper.get<HTMLInputElement>('input')

    expect(input.classes()).toContain('app-text-input')
    expect(input.attributes('type')).toBe('text')
    expect(input.element.value).toBe('Lucky 3 Ranch')
  })

  it.each(['date', 'email', 'number'] as const)('supports %s input types', (type) => {
    const wrapper = mount(AppTextInput, {
      props: {
        modelValue: type === 'number' ? 12 : '',
        type,
      },
    })

    expect(wrapper.get('input').attributes('type')).toBe(type)
  })

  it('emits model updates and the native input event when typing', async () => {
    const wrapper = mount(AppTextInput, {
      props: {
        modelValue: '',
      },
    })
    const input = wrapper.get<HTMLInputElement>('input')

    await input.setValue('Foreman note')

    expect(wrapper.emitted('update:modelValue')).toEqual([['Foreman note']])
    const inputEvents = wrapper.emitted('input')
    expect(inputEvents).toHaveLength(1)
    expect(inputEvents?.[0]?.[0]).toBeInstanceOf(Event)
  })

  it('passes attrs through and merges custom classes on the underlying input', () => {
    const wrapper = mount(AppTextInput, {
      props: {
        modelValue: 'test',
      },
      attrs: {
        class: 'job-name-input',
        disabled: true,
        placeholder: 'Job name',
        readonly: true,
        'data-testid': 'job-name',
      },
    })
    const input = wrapper.get<HTMLInputElement>('[data-testid="job-name"]')

    expect(input.classes()).toEqual(expect.arrayContaining(['app-text-input', 'job-name-input']))
    expect(input.element.disabled).toBe(true)
    expect(input.element.readOnly).toBe(true)
    expect(input.attributes('placeholder')).toBe('Job name')
  })
})
