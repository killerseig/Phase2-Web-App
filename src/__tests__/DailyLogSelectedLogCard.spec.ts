import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DailyLogSelectedLogCard from '@/components/dailyLogs/DailyLogSelectedLogCard.vue'
import { createEmptyDailyLogPayload } from '@/features/dailyLogs/schema'
import type { DailyLogRecord } from '@/types/domain'

function createLog(overrides: Partial<DailyLogRecord> = {}): DailyLogRecord {
  return {
    id: 'log-1',
    jobId: 'job-1',
    jobCode: '1A',
    jobName: 'Phase 2 Company Acoustical remodel',
    logDate: '2026-06-11',
    sequenceNumber: 2,
    status: 'submitted',
    foremanUserId: 'user-1',
    foremanName: 'CJ Blanchard',
    additionalRecipients: [],
    payload: createEmptyDailyLogPayload(),
    submittedAt: new Date('2026-06-11T18:15:00Z'),
    ...overrides,
  }
}

function mountSelectedLogCard(overrides: Partial<InstanceType<typeof DailyLogSelectedLogCard>['$props']> = {}) {
  return mount(DailyLogSelectedLogCard, {
    props: {
      canDelete: true,
      deleting: false,
      selectedLog: createLog(),
      ...overrides,
    },
  })
}

describe('DailyLogSelectedLogCard', () => {
  it('renders selected daily-log metadata and delete action for editable drafts', async () => {
    const wrapper = mountSelectedLogCard({
      selectedLog: createLog({
        status: 'draft',
        sequenceNumber: 4,
      }),
    })

    expect(wrapper.text()).toContain('Draft #4')
    expect(wrapper.text()).toContain('Status: Draft')
    expect(wrapper.text()).toContain('Sequence: #4')
    expect(wrapper.text()).toContain('Owner: CJ Blanchard')
    expect(wrapper.text()).toContain('Jun 11, 2026')

    await wrapper.get('button.app-button--danger').trigger('click')

    expect(wrapper.emitted('delete')).toHaveLength(1)
  })

  it('hides the delete action when the selected log cannot be deleted', () => {
    const wrapper = mountSelectedLogCard({
      canDelete: false,
    })

    expect(wrapper.text()).toContain('Submitted #2')
    expect(wrapper.find('button.app-button--danger').exists()).toBe(false)
  })

  it('shows loading copy and locks the delete action while deleting', () => {
    const wrapper = mountSelectedLogCard({
      deleting: true,
      selectedLog: createLog({
        status: 'draft',
      }),
    })

    const button = wrapper.get('button.app-button--danger')

    expect(button.text()).toBe('Deleting...')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.attributes('aria-busy')).toBe('true')
  })

  it('renders an empty state when no daily log is selected', () => {
    const wrapper = mountSelectedLogCard({
      selectedLog: null,
    })

    expect(wrapper.text()).toContain('No log selected')
    expect(wrapper.text()).toContain('No daily log is selected for this date.')
  })

  it('falls back when the selected log has no foreman name or timestamp', () => {
    const wrapper = mountSelectedLogCard({
      selectedLog: createLog({
        foremanName: null,
        submittedAt: undefined,
      }),
    })

    expect(wrapper.text()).toContain('Owner: Unknown foreman')
    expect(wrapper.text()).toContain('Unknown time')
  })
})
