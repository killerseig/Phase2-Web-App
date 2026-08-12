import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import AppInlineInput from '@/components/common/AppInlineInput.vue'

describe('AppInlineInput', () => {
  it('renders a text input with the current value by default', () => {
    const wrapper = mount(AppInlineInput, {
      props: {
        modelValue: 'Safety Gear',
      },
    })
    const input = wrapper.get<HTMLInputElement>('input')

    expect(input.classes()).toContain('app-inline-input')
    expect(input.attributes('type')).toBe('text')
    expect(input.element.value).toBe('Safety Gear')
  })

  it('emits model updates and the native input event when typing', async () => {
    const wrapper = mount(AppInlineInput, {
      props: {
        modelValue: '',
      },
    })
    const input = wrapper.get<HTMLInputElement>('input')

    await input.setValue('Hard Hat')

    expect(wrapper.emitted('update:modelValue')).toEqual([['Hard Hat']])
    const inputEvents = wrapper.emitted('input')
    expect(inputEvents).toHaveLength(1)
    expect(inputEvents?.[0]?.[0]).toBeInstanceOf(Event)
  })

  it('emits commit on blur and Enter, and cancel on Escape', async () => {
    const wrapper = mount(AppInlineInput, {
      props: {
        modelValue: 'Field Safety',
      },
    })
    const input = wrapper.get<HTMLInputElement>('input')

    await input.trigger('blur')
    await input.trigger('keydown', { key: 'Enter' })
    await input.trigger('keydown', { key: 'Escape' })

    expect(wrapper.emitted('commit')).toHaveLength(2)
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('passes attrs through, merges custom classes, and forwards the input ref', () => {
    const inputRef = vi.fn()

    const wrapper = mount(AppInlineInput, {
      props: {
        inputRef,
        modelValue: 'Inline',
      },
      attrs: {
        class: 'catalog-tree-node__rename',
        disabled: true,
        'data-testid': 'inline-input',
      },
    })
    const input = wrapper.get<HTMLInputElement>('[data-testid="inline-input"]')

    expect(input.classes()).toEqual(expect.arrayContaining(['app-inline-input', 'catalog-tree-node__rename']))
    expect(input.element.disabled).toBe(true)
    expect(inputRef).toHaveBeenCalledWith(input.element)
  })
})
