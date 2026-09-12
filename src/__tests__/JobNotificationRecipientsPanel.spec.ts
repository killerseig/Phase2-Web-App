import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import JobNotificationRecipientsPanel from '@/components/jobs/JobNotificationRecipientsPanel.vue'
import type { NotificationModuleKey, NotificationRecipients } from '@/types/domain'

const modules: Array<{ key: NotificationModuleKey; label: string }> = [
  { key: 'dailyLogs', label: 'Daily Logs' },
  { key: 'timecards', label: 'Timecards' },
  { key: 'shopOrders', label: 'Shop Orders' },
]

function makeRecipients(overrides: Partial<NotificationRecipients> = {}): NotificationRecipients {
  return {
    dailyLogs: ['daily@example.com'],
    timecards: [],
    shopOrders: ['shop@example.com', 'orders@example.com'],
    ...overrides,
  }
}

function mountPanel(overrides = {}) {
  return mount(JobNotificationRecipientsPanel, {
    props: {
      description: 'Added on top of All Jobs defaults for this job only',
      modules,
      recipients: makeRecipients(),
      inputs: {
        dailyLogs: '',
        timecards: 'payroll@example.com',
        shopOrders: '',
      },
      disabled: false,
      ...overrides,
    },
  })
}

describe('JobNotificationRecipientsPanel', () => {
  it('renders module recipient sections with counts, recipients, and empty labels', () => {
    const wrapper = mountPanel()

    expect(wrapper.text()).toContain('Email Recipients')
    expect(wrapper.text()).toContain('Added on top of All Jobs defaults for this job only')
    expect(wrapper.text()).toContain('Daily Logs')
    expect(wrapper.text()).toContain('1 recipient')
    expect(wrapper.text()).toContain('daily@example.com')
    expect(wrapper.text()).toContain('Timecards')
    expect(wrapper.text()).toContain('No recipients yet.')
    expect(wrapper.text()).toContain('Shop Orders')
    expect(wrapper.text()).toContain('2 recipients')
    expect(wrapper.text()).toContain('shop@example.com')
    expect(wrapper.text()).toContain('orders@example.com')
  })

  it('forwards input, add, and remove events with the matching module key', async () => {
    const wrapper = mountPanel()
    const sections = wrapper.findAll('.jobs-recipient-section')
    const timecardsSection = sections[1]
    const dailyLogsSection = sections[0]

    if (!dailyLogsSection || !timecardsSection) {
      throw new Error('Expected daily log and timecard recipient sections to render.')
    }

    await timecardsSection.get('input[type="email"]').setValue('new-payroll@example.com')
    await timecardsSection.get('.recipient-editor__add').trigger('click')
    await dailyLogsSection.get('button[aria-label="Remove recipient"]').trigger('click')

    expect(wrapper.emitted('updateInput')).toEqual([['timecards', 'new-payroll@example.com']])
    expect(wrapper.emitted('addRecipient')).toEqual([['timecards']])
    expect(wrapper.emitted('removeRecipient')).toEqual([['dailyLogs', 'daily@example.com']])
  })

  it('passes disabled state through to every recipient editor', async () => {
    const wrapper = mountPanel({
      disabled: true,
    })
    const inputs = wrapper.findAll<HTMLInputElement>('input[type="email"]')
    const addButtons = wrapper.findAll<HTMLButtonElement>('.recipient-editor__add')
    const removeButtons = wrapper.findAll<HTMLButtonElement>('button[aria-label="Remove recipient"]')

    expect(inputs.every((input) => input.element.disabled)).toBe(true)
    expect(addButtons.every((button) => button.element.disabled)).toBe(true)
    expect(removeButtons.every((button) => button.element.disabled)).toBe(true)

    await wrapper.get('.recipient-editor__add').trigger('click')
    await wrapper.get('button[aria-label="Remove recipient"]').trigger('click')

    expect(wrapper.emitted('addRecipient')).toBeUndefined()
    expect(wrapper.emitted('removeRecipient')).toBeUndefined()
  })
})
