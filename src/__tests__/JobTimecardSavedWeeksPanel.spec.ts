import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import JobTimecardSavedWeeksPanel from '@/components/timecards/JobTimecardSavedWeeksPanel.vue'
import type { TimecardWeekRecord } from '@/types/domain'

function makeWeek(overrides: Partial<TimecardWeekRecord> = {}): TimecardWeekRecord {
  return {
    id: 'week-1',
    jobId: 'job-1',
    jobCode: '736',
    jobName: 'Shop',
    ownerForemanUserId: 'user-1',
    ownerForemanName: 'CJ Blanchard',
    weekStartDate: '2026-06-14',
    weekEndDate: '2026-06-20',
    status: 'draft',
    employeeCardCount: 2,
    ...overrides,
  }
}

function mountPanel(overrides = {}) {
  return mount(JobTimecardSavedWeeksPanel, {
    props: {
      recentWeeks: [
        makeWeek(),
        makeWeek({
          id: 'week-2',
          weekStartDate: '2026-06-21',
          weekEndDate: '2026-06-27',
          status: 'submitted',
        }),
      ],
      activeWeekId: 'week-2',
      weeksLoading: false,
      mobileActive: true,
      ...overrides,
    },
  })
}

describe('JobTimecardSavedWeeksPanel', () => {
  it('renders saved week rows with formatted dates, statuses, active state, and test ids', () => {
    const wrapper = mountPanel()

    expect(wrapper.get('legend').text()).toBe('Saved Weeks')
    expect(wrapper.get('[data-testid="timecards-history-week-1"]').text()).toContain('6/20/2026')
    expect(wrapper.get('[data-testid="timecards-history-week-1"]').text()).toContain('Draft')
    expect(wrapper.get('[data-testid="timecards-history-week-2"]').text()).toContain('6/27/2026')
    expect(wrapper.get('[data-testid="timecards-history-week-2"]').text()).toContain('Submitted')
    expect(wrapper.get('[data-testid="timecards-history-week-2"]').classes()).toContain('job-timecard-saved-weeks__row--active')
  })

  it('emits the selected week record when a row is clicked', async () => {
    const week = makeWeek({ id: 'selected-week' })
    const wrapper = mountPanel({
      recentWeeks: [week],
      activeWeekId: null,
    })

    await wrapper.get('[data-testid="timecards-history-selected-week"]').trigger('click')

    expect(wrapper.emitted('selectWeek')?.[0]).toEqual([week])
  })

  it('renders empty copy only after weeks finish loading', () => {
    expect(mountPanel({ recentWeeks: [], weeksLoading: false }).text()).toContain('No saved weeks yet.')
    expect(mountPanel({ recentWeeks: [], weeksLoading: true }).text()).not.toContain('No saved weeks yet.')
  })

  it('falls back to the raw week date when the value is not parseable', () => {
    const wrapper = mountPanel({
      recentWeeks: [makeWeek({ id: 'raw-date', weekEndDate: 'not-a-date' })],
    })

    expect(wrapper.get('[data-testid="timecards-history-raw-date"]').text()).toContain('not-a-date')
  })
})
