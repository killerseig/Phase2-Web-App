import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import AppDateInput from '@/components/common/AppDateInput.vue'

describe('AppDateInput', () => {
  it('renders a date input with the current value', () => {
    const wrapper = mount(AppDateInput, {
      props: {
        modelValue: '2026-06-18',
      },
    })
    const input = wrapper.get<HTMLInputElement>('input')

    expect(input.classes()).toContain('app-text-input')
    expect(input.attributes('type')).toBe('date')
    expect(input.element.value).toBe('2026-06-18')
  })

  it('emits model updates and the native input event when changed', async () => {
    const wrapper = mount(AppDateInput, {
      props: {
        modelValue: '',
      },
    })
    const input = wrapper.get<HTMLInputElement>('input')

    await input.setValue('2026-06-20')

    expect(wrapper.emitted('update:modelValue')).toEqual([['2026-06-20']])
    const inputEvents = wrapper.emitted('input')
    expect(inputEvents).toHaveLength(1)
    expect(inputEvents?.[0]?.[0]).toBeInstanceOf(Event)
  })

  it('passes attrs and native listeners through to the underlying input', async () => {
    const onChange = vi.fn()
    const onClick = vi.fn()
    const wrapper = mount(AppDateInput, {
      props: {
        modelValue: '2026-06-18',
      },
      attrs: {
        class: 'job-start-date',
        min: '2026-06-01',
        max: '2026-06-30',
        'data-testid': 'job-start-date',
        onChange,
        onClick,
      },
    })
    const input = wrapper.get<HTMLInputElement>('[data-testid="job-start-date"]')

    expect(input.classes()).toEqual(expect.arrayContaining(['app-text-input', 'job-start-date']))
    expect(input.attributes('min')).toBe('2026-06-01')
    expect(input.attributes('max')).toBe('2026-06-30')

    await input.trigger('click')
    await input.trigger('change')

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
