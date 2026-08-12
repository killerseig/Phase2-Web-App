import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AppTextarea from '@/components/common/AppTextarea.vue'

describe('AppTextarea', () => {
  it('renders a textarea with the current value', () => {
    const wrapper = mount(AppTextarea, {
      props: {
        modelValue: 'Crew poured level 2 today.',
      },
    })
    const textarea = wrapper.get<HTMLTextAreaElement>('textarea')

    expect(textarea.classes()).toContain('app-textarea')
    expect(textarea.element.value).toBe('Crew poured level 2 today.')
  })

  it('emits model updates and the native input event when typing', async () => {
    const wrapper = mount(AppTextarea, {
      props: {
        modelValue: '',
      },
    })
    const textarea = wrapper.get<HTMLTextAreaElement>('textarea')

    await textarea.setValue('Daily log notes with spaces')

    expect(wrapper.emitted('update:modelValue')).toEqual([['Daily log notes with spaces']])
    const inputEvents = wrapper.emitted('input')
    expect(inputEvents).toHaveLength(1)
    expect(inputEvents?.[0]?.[0]).toBeInstanceOf(Event)
  })

  it('passes attrs through and merges custom classes on the underlying textarea', () => {
    const wrapper = mount(AppTextarea, {
      props: {
        modelValue: 'Locked note',
      },
      attrs: {
        class: 'daily-log-note',
        disabled: true,
        placeholder: 'Add notes',
        readonly: true,
        rows: 5,
        'data-testid': 'daily-log-note',
      },
    })
    const textarea = wrapper.get<HTMLTextAreaElement>('[data-testid="daily-log-note"]')

    expect(textarea.classes()).toEqual(expect.arrayContaining(['app-textarea', 'daily-log-note']))
    expect(textarea.element.disabled).toBe(true)
    expect(textarea.element.readOnly).toBe(true)
    expect(textarea.attributes('placeholder')).toBe('Add notes')
    expect(textarea.attributes('rows')).toBe('5')
  })
})
