import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DailyLogHistoryList from '@/components/dailyLogs/DailyLogHistoryList.vue'
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

function mountHistoryList(overrides: Partial<InstanceType<typeof DailyLogHistoryList>['$props']> = {}) {
  return mount(DailyLogHistoryList, {
    props: {
      loading: false,
      logs: [],
      selectedDate: '2026-06-11',
      selectedDateIsToday: false,
      selectedLogId: null,
      ...overrides,
    },
  })
}

describe('DailyLogHistoryList', () => {
  it('renders loading and empty states without daily-log rows', () => {
    const loadingWrapper = mountHistoryList({ loading: true })

    expect(loadingWrapper.text()).toContain('Loading daily logs...')
    expect(loadingWrapper.find('.daily-log-history-row').exists()).toBe(false)

    const emptyWrapper = mountHistoryList()

    expect(emptyWrapper.text()).toContain('No daily logs exist for this date yet.')
    expect(emptyWrapper.find('.daily-log-history-row').exists()).toBe(false)
  })

  it('renders submitted and draft logs with active selection details', () => {
    const wrapper = mountHistoryList({
      logs: [
        createLog({
          id: 'submitted-log',
          sequenceNumber: 2,
          status: 'submitted',
          foremanName: 'CJ Blanchard',
          submittedAt: new Date('2026-06-11T18:15:00Z'),
        }),
        createLog({
          id: 'draft-log',
          sequenceNumber: 3,
          foremanName: null,
        }),
      ],
      selectedLogId: 'submitted-log',
    })

    expect(wrapper.text()).toContain('Logs for 2026-06-11')
    expect(wrapper.text()).toContain('Submitted #2')
    expect(wrapper.text()).toContain('CJ Blanchard')
    expect(wrapper.text()).toContain('Draft #3')
    expect(wrapper.text()).toContain('Unknown foreman')
    expect(wrapper.text()).toContain('Jun 11, 2026')
    expect(wrapper.get('[data-testid="dailylog-history-submitted-log"]').attributes('aria-pressed')).toBe('true')
  })

  it('emits date navigation and selected-log events', async () => {
    const wrapper = mountHistoryList({
      logs: [
        createLog({
          id: 'draft-log',
          sequenceNumber: 3,
        }),
      ],
    })

    await wrapper.get('[data-testid="dailylog-date-search"]').setValue('2026-06-12')
    await wrapper.get('button.app-button').trigger('click')
    await wrapper.get('[data-testid="dailylog-history-draft-log"]').trigger('click')

    expect(wrapper.emitted('update:selectedDate')).toEqual([['2026-06-12']])
    expect(wrapper.emitted('today')).toHaveLength(1)
    expect(wrapper.emitted('select')).toEqual([['draft-log']])
  })

  it('disables the Today action when the selected date is already today', () => {
    const wrapper = mountHistoryList({
      selectedDateIsToday: true,
    })

    expect(wrapper.get('button.app-button').attributes('disabled')).toBeDefined()
  })
})
