import { shallowMount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DailyLogSidebar from '@/components/dailyLogs/DailyLogSidebar.vue'
import { createEmptyDailyLogPayload } from '@/features/dailyLogs/schema'
import type { DailyLogRecord } from '@/types/domain'

function createLog(overrides: Partial<DailyLogRecord> = {}): DailyLogRecord {
  return {
    id: 'log-1',
    jobId: 'job-1',
    jobCode: '1A',
    jobName: 'Phase 2 Company Acoustical remodel',
    logDate: '2026-06-11',
    sequenceNumber: 1,
    status: 'draft',
    foremanUserId: 'user-1',
    foremanName: 'Chris Larsen',
    additionalRecipients: [],
    payload: createEmptyDailyLogPayload(),
    createdAt: new Date('2026-06-11T14:30:00Z'),
    ...overrides,
  }
}

const selectedLog = createLog()

function mountSidebar(overrides: Partial<InstanceType<typeof DailyLogSidebar>['$props']> = {}) {
  return shallowMount(DailyLogSidebar, {
    props: {
      additionalRecipients: ['extra@example.com'],
      adminRecipients: ['admin@example.com'],
      canDeleteSelectedLog: true,
      canEditSelectedLog: true,
      deletingDraft: false,
      logs: [selectedLog],
      logsLoading: false,
      recipientInput: 'draft@example.com',
      recipientSaving: false,
      selectedDate: '2026-06-11',
      selectedDateIsToday: false,
      selectedLog,
      selectedLogId: selectedLog.id,
      ...overrides,
    },
    global: {
      stubs: {
        DailyLogSelectedLogCard: {
          props: ['canDelete', 'deleting', 'selectedLog'],
          emits: ['delete'],
          template: `
            <section data-testid="selected-card">
              <span data-testid="selected-card-id">{{ selectedLog?.id || 'none' }}</span>
              <span data-testid="selected-card-can-delete">{{ String(canDelete) }}</span>
              <span data-testid="selected-card-deleting">{{ String(deleting) }}</span>
              <button data-testid="selected-card-delete" type="button" @click="$emit('delete')">Delete</button>
            </section>
          `,
        },
        DailyLogRecipientsCard: {
          props: ['modelValue', 'adminRecipients', 'additionalRecipients', 'canEdit', 'saving'],
          emits: ['add', 'remove', 'update:modelValue'],
          template: `
            <section data-testid="recipients-card">
              <span data-testid="recipient-model">{{ modelValue }}</span>
              <span data-testid="recipient-admin-count">{{ adminRecipients.length }}</span>
              <span data-testid="recipient-extra-count">{{ additionalRecipients.length }}</span>
              <span data-testid="recipient-can-edit">{{ String(canEdit) }}</span>
              <span data-testid="recipient-saving">{{ String(saving) }}</span>
              <button data-testid="recipient-add" type="button" @click="$emit('add')">Add</button>
              <button data-testid="recipient-remove" type="button" @click="$emit('remove', 'extra@example.com')">Remove</button>
              <input data-testid="recipient-input" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />
            </section>
          `,
        },
        DailyLogHistoryList: {
          props: ['selectedDate', 'loading', 'logs', 'selectedDateIsToday', 'selectedLogId'],
          emits: ['select', 'today', 'update:selectedDate'],
          template: `
            <section data-testid="history-list">
              <span data-testid="history-date">{{ selectedDate }}</span>
              <span data-testid="history-loading">{{ String(loading) }}</span>
              <span data-testid="history-count">{{ logs.length }}</span>
              <span data-testid="history-selected-id">{{ selectedLogId }}</span>
              <span data-testid="history-is-today">{{ String(selectedDateIsToday) }}</span>
              <button data-testid="history-select" type="button" @click="$emit('select', 'log-2')">Select</button>
              <button data-testid="history-today" type="button" @click="$emit('today')">Today</button>
              <input data-testid="history-date-input" :value="selectedDate" @input="$emit('update:selectedDate', $event.target.value)" />
            </section>
          `,
        },
      },
    },
  })
}

describe('DailyLogSidebar', () => {
  it('composes selected-log, recipient, and history cards with parent-owned state', () => {
    const wrapper = mountSidebar({
      deletingDraft: true,
      logsLoading: true,
      selectedDateIsToday: true,
    })

    expect(wrapper.get('[data-testid="selected-card-id"]').text()).toBe('log-1')
    expect(wrapper.get('[data-testid="selected-card-can-delete"]').text()).toBe('true')
    expect(wrapper.get('[data-testid="selected-card-deleting"]').text()).toBe('true')
    expect(wrapper.get('[data-testid="recipient-model"]').text()).toBe('draft@example.com')
    expect(wrapper.get('[data-testid="recipient-admin-count"]').text()).toBe('1')
    expect(wrapper.get('[data-testid="recipient-extra-count"]').text()).toBe('1')
    expect(wrapper.get('[data-testid="recipient-can-edit"]').text()).toBe('true')
    expect(wrapper.get('[data-testid="history-date"]').text()).toBe('2026-06-11')
    expect(wrapper.get('[data-testid="history-loading"]').text()).toBe('true')
    expect(wrapper.get('[data-testid="history-count"]').text()).toBe('1')
    expect(wrapper.get('[data-testid="history-selected-id"]').text()).toBe('log-1')
    expect(wrapper.get('[data-testid="history-is-today"]').text()).toBe('true')
  })

  it('hides log-specific recipients when no daily log is selected', () => {
    const wrapper = mountSidebar({
      selectedLog: null,
      selectedLogId: null,
    })

    expect(wrapper.get('[data-testid="selected-card-id"]').text()).toBe('none')
    expect(wrapper.find('[data-testid="recipients-card"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="history-list"]').exists()).toBe(true)
  })

  it('forwards child events to the route-level owner', async () => {
    const wrapper = mountSidebar()

    await wrapper.get('[data-testid="selected-card-delete"]').trigger('click')
    await wrapper.get('[data-testid="recipient-add"]').trigger('click')
    await wrapper.get('[data-testid="recipient-remove"]').trigger('click')
    await wrapper.get('[data-testid="recipient-input"]').setValue('new@example.com')
    await wrapper.get('[data-testid="history-select"]').trigger('click')
    await wrapper.get('[data-testid="history-today"]').trigger('click')
    await wrapper.get('[data-testid="history-date-input"]').setValue('2026-06-12')

    expect(wrapper.emitted('deleteSelectedLog')).toHaveLength(1)
    expect(wrapper.emitted('addRecipient')).toHaveLength(1)
    expect(wrapper.emitted('removeRecipient')).toEqual([['extra@example.com']])
    expect(wrapper.emitted('update:recipientInput')).toEqual([['new@example.com']])
    expect(wrapper.emitted('selectLog')).toEqual([['log-2']])
    expect(wrapper.emitted('today')).toHaveLength(1)
    expect(wrapper.emitted('update:selectedDate')).toEqual([['2026-06-12']])
  })
})
