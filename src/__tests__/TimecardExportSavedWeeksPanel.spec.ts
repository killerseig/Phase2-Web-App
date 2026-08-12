import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TimecardExportSavedWeeksPanel from '@/components/timecards/TimecardExportSavedWeeksPanel.vue'
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

const formatDate = (value: string) => `formatted ${value}`
const formatSubtitle = (week: TimecardWeekRecord) => `${week.jobCode} / ${week.ownerForemanName}`

function mountPanel(overrides = {}) {
  return mount(TimecardExportSavedWeeksPanel, {
    props: {
      weeks: [
        makeWeek(),
        makeWeek({
          id: 'week-2',
          jobCode: '9411',
          ownerForemanName: 'Vince Hintz',
          weekEndDate: '2026-06-27',
          status: 'submitted',
        }),
      ],
      weeksLoading: false,
      canUseTimecardExport: true,
      actionLoading: false,
      mobileActive: true,
      formatDate,
      formatSubtitle,
      ...overrides,
    },
  })
}

describe('TimecardExportSavedWeeksPanel', () => {
  it('renders saved week rows with formatted dates, subtitles, statuses, and test ids', () => {
    const wrapper = mountPanel()

    expect(wrapper.get('legend').text()).toBe('Saved Weeks')
    expect(wrapper.get('[data-testid="timecard-export-week-week-1"]').text()).toContain(
      'formatted 2026-06-20',
    )
    expect(wrapper.get('[data-testid="timecard-export-week-week-1"]').text()).toContain(
      '736 / CJ Blanchard',
    )
    expect(wrapper.get('[data-testid="timecard-export-week-week-1"]').text()).toContain('Draft')
    expect(wrapper.get('[data-testid="timecard-export-week-week-2"]').text()).toContain(
      'formatted 2026-06-27',
    )
    expect(wrapper.get('[data-testid="timecard-export-week-week-2"]').text()).toContain(
      '9411 / Vince Hintz',
    )
    expect(wrapper.get('[data-testid="timecard-export-week-week-2"]').text()).toContain(
      'Submitted',
    )
  })

  it('shows saved-week actions for editable draft and submitted weeks', async () => {
    const draftWeek = makeWeek({ id: 'draft-week', status: 'draft' })
    const submittedWeek = makeWeek({ id: 'submitted-week', status: 'submitted' })
    const wrapper = mountPanel({ weeks: [draftWeek, submittedWeek] })

    expect(wrapper.find('[data-testid="timecard-export-submit-week-draft-week"]').exists()).toBe(
      true,
    )
    expect(wrapper.find('[data-testid="timecard-export-delete-week-draft-week"]').exists()).toBe(
      true,
    )
    expect(
      wrapper.find('[data-testid="timecard-export-delete-week-submitted-week"]').exists(),
    ).toBe(false)
    expect(
      wrapper.find('[data-testid="timecard-export-reopen-week-submitted-week"]').exists(),
    ).toBe(true)
    expect(
      wrapper.find('[data-testid="timecard-export-submit-week-submitted-week"]').exists(),
    ).toBe(false)

    await wrapper.get('[data-testid="timecard-export-submit-week-draft-week"]').trigger('click')
    await wrapper.get('[data-testid="timecard-export-delete-week-draft-week"]').trigger('click')
    await wrapper.get('[data-testid="timecard-export-reopen-week-submitted-week"]').trigger('click')

    expect(wrapper.emitted('submitWeek')?.[0]).toEqual([draftWeek])
    expect(wrapper.emitted('deleteWeek')?.[0]).toEqual([draftWeek])
    expect(wrapper.emitted('reopenWeek')?.[0]).toEqual([submittedWeek])
  })

  it('hides saved-week actions when the user cannot use Timecard Export', () => {
    const wrapper = mountPanel({
      canUseTimecardExport: false,
      weeks: [
        makeWeek({ id: 'draft-week', status: 'draft' }),
        makeWeek({ id: 'submitted-week', status: 'submitted' }),
      ],
    })

    expect(wrapper.find('[data-testid="timecard-export-delete-week-draft-week"]').exists()).toBe(
      false,
    )
    expect(wrapper.find('[data-testid="timecard-export-submit-week-draft-week"]').exists()).toBe(
      false,
    )
    expect(
      wrapper.find('[data-testid="timecard-export-reopen-week-submitted-week"]').exists(),
    ).toBe(false)
  })

  it('disables saved-week actions while another action is loading', () => {
    const wrapper = mountPanel({
      actionLoading: true,
      weeks: [
        makeWeek({ id: 'draft-week', status: 'draft' }),
        makeWeek({ id: 'submitted-week', status: 'submitted' }),
      ],
    })

    expect(
      wrapper.get<HTMLButtonElement>('[data-testid="timecard-export-delete-week-draft-week"]')
        .element.disabled,
    ).toBe(true)
    expect(
      wrapper.get<HTMLButtonElement>('[data-testid="timecard-export-submit-week-draft-week"]')
        .element.disabled,
    ).toBe(true)
    expect(
      wrapper.get<HTMLButtonElement>('[data-testid="timecard-export-reopen-week-submitted-week"]')
        .element.disabled,
    ).toBe(true)
  })

  it('renders empty copy only after weeks finish loading', () => {
    expect(mountPanel({ weeks: [], weeksLoading: false }).text()).toContain(
      'No saved weeks match the current filters.',
    )
    expect(mountPanel({ weeks: [], weeksLoading: true }).text()).not.toContain(
      'No saved weeks match the current filters.',
    )
  })
})
