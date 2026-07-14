import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import RecipientEditor from '@/components/RecipientEditor.vue'

function mountRecipientEditor(overrides = {}) {
  return mount(RecipientEditor, {
    props: {
      title: 'Daily Logs',
      recipients: ['first@example.com', 'second@example.com'],
      modelValue: '',
      ...overrides,
    },
  })
}

describe('RecipientEditor', () => {
  it('emits input, add, and remove events from the editable contract', async () => {
    const wrapper = mountRecipientEditor()

    await wrapper.get('input[type="email"]').setValue('new@example.com')
    await wrapper.get('input[type="email"]').trigger('keydown.enter')
    await wrapper.get('button[aria-label="Remove recipient"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['new@example.com']])
    expect(wrapper.emitted('add')).toEqual([[]])
    expect(wrapper.emitted('remove')).toEqual([['first@example.com']])
  })

  it('shows recipient counts, hints, placeholders, and empty labels from props', () => {
    const wrapper = mountRecipientEditor({
      emptyLabel: 'Nobody yet.',
      hint: 'Sent when logs are submitted.',
      placeholder: 'person@example.com',
      recipients: [],
    })

    expect(wrapper.text()).toContain('Daily Logs')
    expect(wrapper.text()).toContain('Sent when logs are submitted.')
    expect(wrapper.text()).toContain('0 recipients')
    expect(wrapper.text()).toContain('Nobody yet.')
    expect(wrapper.get('input[type="email"]').attributes('placeholder')).toBe('person@example.com')
  })

  it('does not emit add or remove actions while disabled', async () => {
    const wrapper = mountRecipientEditor({ disabled: true })

    await wrapper.get('.recipient-editor__add').trigger('click')
    await wrapper.get('button[aria-label="Remove recipient"]').trigger('click')

    expect(wrapper.emitted('add')).toBeUndefined()
    expect(wrapper.emitted('remove')).toBeUndefined()
  })

  it('renders read-only recipients without edit controls', () => {
    const wrapper = mountRecipientEditor({
      readOnly: true,
      rowBadge: 'Default',
    })

    expect(wrapper.find('input[type="email"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="Remove recipient"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Default')
    expect(wrapper.text()).toContain('first@example.com')
  })
})
