import { shallowMount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DailyLogRecipientsCard from '@/components/dailyLogs/DailyLogRecipientsCard.vue'

function mountRecipientsCard(overrides: Partial<InstanceType<typeof DailyLogRecipientsCard>['$props']> = {}) {
  return shallowMount(DailyLogRecipientsCard, {
    props: {
      adminRecipients: ['admin@example.com'],
      additionalRecipients: ['extra@example.com'],
      canEdit: true,
      modelValue: 'new@example.com',
      saving: false,
      ...overrides,
    },
    global: {
      stubs: {
        AppCard: {
          props: ['as'],
          template: '<article><slot /></article>',
        },
        AppSectionHeader: {
          props: ['eyebrow', 'title', 'titleTag'],
          template: '<header><span>{{ eyebrow }}</span><component :is="titleTag || `h2`">{{ title }}</component></header>',
        },
        RecipientEditor: {
          props: [
            'additionalRecipients',
            'disabled',
            'emptyLabel',
            'hint',
            'modelValue',
            'readOnly',
            'recipients',
            'rowBadge',
            'title',
          ],
          emits: ['add', 'remove', 'update:modelValue'],
          template: `
            <section data-testid="recipient-editor">
              <strong data-testid="recipient-title">{{ title }}</strong>
              <span data-testid="recipient-hint">{{ hint }}</span>
              <span data-testid="recipient-count">{{ recipients.length }}</span>
              <span data-testid="recipient-readonly">{{ String(readOnly !== false && readOnly !== undefined && readOnly !== null) }}</span>
              <span data-testid="recipient-disabled">{{ String(disabled !== false && disabled !== undefined && disabled !== null) }}</span>
              <span data-testid="recipient-badge">{{ rowBadge || '' }}</span>
              <span data-testid="recipient-empty">{{ emptyLabel }}</span>
              <span data-testid="recipient-model">{{ modelValue || '' }}</span>
              <button
                v-if="title === 'Additional Recipients'"
                data-testid="recipient-add"
                type="button"
                @click="$emit('add')"
              >Add</button>
              <button
                v-if="title === 'Additional Recipients'"
                data-testid="recipient-remove"
                type="button"
                @click="$emit('remove', 'extra@example.com')"
              >Remove</button>
              <input
                v-if="title === 'Additional Recipients'"
                data-testid="recipient-input"
                :value="modelValue"
                @input="$emit('update:modelValue', $event.target.value)"
              />
            </section>
          `,
        },
      },
    },
  })
}

describe('DailyLogRecipientsCard', () => {
  it('renders admin defaults as read-only and additional recipients as editable', () => {
    const wrapper = mountRecipientsCard()
    const editors = wrapper.findAll('[data-testid="recipient-editor"]')
    const adminEditor = editors[0]!
    const additionalEditor = editors[1]!

    expect(wrapper.text()).toContain('Email List')
    expect(adminEditor.text()).toContain('Admin Defaults')
    expect(adminEditor.text()).toContain('Read only')
    expect(adminEditor.find('[data-testid="recipient-count"]').text()).toBe('1')
    expect(adminEditor.find('[data-testid="recipient-readonly"]').text()).toBe('true')
    expect(adminEditor.find('[data-testid="recipient-badge"]').text()).toBe('Default')
    expect(adminEditor.find('[data-testid="recipient-empty"]').text()).toBe('No default recipients yet.')

    expect(additionalEditor.text()).toContain('Additional Recipients')
    expect(additionalEditor.text()).toContain('Added for this log only')
    expect(additionalEditor.find('[data-testid="recipient-count"]').text()).toBe('1')
    expect(additionalEditor.find('[data-testid="recipient-readonly"]').text()).toBe('false')
    expect(additionalEditor.find('[data-testid="recipient-disabled"]').text()).toBe('false')
    expect(additionalEditor.find('[data-testid="recipient-empty"]').text()).toBe('No extra recipients yet.')
    expect(additionalEditor.find('[data-testid="recipient-model"]').text()).toBe('new@example.com')
  })

  it('disables the additional-recipient editor when the log cannot be edited or is saving', () => {
    const readOnlyWrapper = mountRecipientsCard({
      canEdit: false,
    })
    const savingWrapper = mountRecipientsCard({
      saving: true,
    })

    expect(readOnlyWrapper.findAll('[data-testid="recipient-disabled"]')[1]!.text()).toBe('true')
    expect(savingWrapper.findAll('[data-testid="recipient-disabled"]')[1]!.text()).toBe('true')
  })

  it('forwards additional-recipient input and action events', async () => {
    const wrapper = mountRecipientsCard()

    await wrapper.get('[data-testid="recipient-input"]').setValue('other@example.com')
    await wrapper.get('[data-testid="recipient-add"]').trigger('click')
    await wrapper.get('[data-testid="recipient-remove"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['other@example.com']])
    expect(wrapper.emitted('add')).toHaveLength(1)
    expect(wrapper.emitted('remove')).toEqual([['extra@example.com']])
  })
})
