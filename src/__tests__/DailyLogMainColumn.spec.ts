import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DailyLogMainColumn from '@/components/dailyLogs/DailyLogMainColumn.vue'
import { createEmptyDailyLogPayload } from '@/features/dailyLogs/schema'
import type { DailyLogRecord } from '@/types/domain'

const uploadHandler = async () => undefined

const form = createEmptyDailyLogPayload({
  weeklySchedule: 'Hang grid on level 2.',
  manpowerAssessment: 'Crew is on track.',
  safetyConcerns: 'Review ladders.',
  budgetConcerns: 'No concerns.',
  deliveriesNeeded: 'Ceiling tile.',
  manpowerLines: [
    {
      trade: 'Carpenter',
      count: 3,
      areas: 'Level 2',
      addedByUserId: 'user-1',
    },
  ],
  indoorClimateReadings: [
    {
      area: 'Level 2',
      high: '72',
      low: '68',
      humidity: '30%',
    },
  ],
})

const selectedLog: DailyLogRecord = {
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
  payload: createEmptyDailyLogPayload({
    weeklySchedule: 'Saved schedule notes.',
    safetyConcerns: 'Saved safety notes.',
    budgetConcerns: 'Saved budget notes.',
    deliveriesNeeded: 'Saved delivery notes.',
  }),
}

function mountMainColumn(overrides = {}) {
  return mount(DailyLogMainColumn, {
    props: {
      canEditSelectedLog: true,
      form,
      photoAttachmentBusy: false,
      photoAttachments: [],
      ptpAttachmentBusy: false,
      ptpAttachments: [],
      qcAttachmentBusy: false,
      qcAttachments: [],
      savingDraft: false,
      selectedLog,
      siteInfo: {
        projectName: 'Phase 2 Company Acoustical remodel',
        jobNumber: '1A',
        projectManager: 'Chris Renn',
        foreman: 'Chris Larsen',
        generalContractor: 'Hillside',
        address: '123 Main St',
      },
      submittingLog: false,
      uploadPhotoAttachments: uploadHandler,
      uploadPtpAttachments: uploadHandler,
      uploadQcAttachments: uploadHandler,
      ...overrides,
    },
  })
}

describe('DailyLogMainColumn', () => {
  it('renders the daily-log form composition and saved-value test hooks', () => {
    const wrapper = mountMainColumn()

    expect(wrapper.text()).toContain('Site Info')
    expect(wrapper.text()).toContain('Crew On Site')
    expect(wrapper.text()).toContain('Schedule & Assessment')
    expect(wrapper.get('[data-testid="dailylog-weeklySchedule"]').element).toHaveProperty(
      'value',
      'Hang grid on level 2.',
    )
    expect(wrapper.get('[data-testid="dailylog-saved-weeklySchedule"]').text()).toBe(
      'Saved schedule notes.',
    )
    expect(wrapper.get('[data-testid="dailylog-saved-safetyConcerns"]').text()).toBe(
      'Saved safety notes.',
    )
    expect(wrapper.get('[data-testid="dailylog-saved-budgetConcerns"]').text()).toBe(
      'Saved budget notes.',
    )
    expect(wrapper.get('[data-testid="dailylog-saved-deliveriesNeeded"]').text()).toBe(
      'Saved delivery notes.',
    )
  })

  it('forwards field, repeater, attachment, and submit events to the parent route', async () => {
    const wrapper = mountMainColumn()

    await wrapper.get('[data-testid="dailylog-weeklySchedule"]').setValue('Updated schedule notes.')
    await wrapper.get('[data-testid="dailylog-weeklySchedule"]').trigger('blur')
    await wrapper.get('button.daily-log-manpower-card__add').trigger('click')
    await wrapper.get('button.daily-log-climate-card__add').trigger('click')
    await wrapper.get('button.daily-logs-submit-button').trigger('click')

    expect(wrapper.emitted('updateTextField')).toEqual([
      ['weeklySchedule', 'Updated schedule notes.'],
    ])
    expect(wrapper.emitted('blurTextField')).toEqual([['weeklySchedule']])
    expect(wrapper.emitted('addManpowerLine')).toHaveLength(1)
    expect(wrapper.emitted('addIndoorClimateReading')).toHaveLength(1)
    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('disables edit controls when the selected log cannot be edited', () => {
    const wrapper = mountMainColumn({
      canEditSelectedLog: false,
    })

    expect(
      wrapper.get('[data-testid="dailylog-weeklySchedule"]').attributes('disabled'),
    ).toBeDefined()
    expect(wrapper.get('button.daily-logs-submit-button').attributes('disabled')).toBeDefined()
  })

  it.each(['photoAttachmentBusy', 'ptpAttachmentBusy', 'qcAttachmentBusy'] as const)(
    'disables submit while %s is active',
    (busyProp) => {
      const wrapper = mountMainColumn({ [busyProp]: true })

      expect(wrapper.get('button.daily-logs-submit-button').attributes('disabled')).toBeDefined()
    },
  )
})
