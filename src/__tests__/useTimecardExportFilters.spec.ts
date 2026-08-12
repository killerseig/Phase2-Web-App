import { ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { useTimecardExportFilters } from '@/features/timecards/useTimecardExportFilters'
import type { TimecardWeekRecord } from '@/types/domain'

function makeWeek(overrides: Partial<TimecardWeekRecord> = {}): TimecardWeekRecord {
  return {
    id: 'week-1',
    employeeCardCount: 1,
    jobCode: '5229',
    jobId: 'job-1',
    jobName: 'Lucky 3 Ranch',
    ownerForemanName: 'Vince Hintz',
    ownerForemanUserId: 'foreman-1',
    status: 'draft',
    weekEndDate: '2026-06-20',
    weekStartDate: '2026-06-14',
    ...overrides,
  }
}

function mountFilters(options: {
  currentWeekEndDate?: string
  weeks?: TimecardWeekRecord[]
} = {}) {
  const weeks = ref<TimecardWeekRecord[]>(options.weeks ?? [])
  const state = useTimecardExportFilters({
    currentWeekEndDate: options.currentWeekEndDate ?? '2026-06-20',
    weeks,
  })

  return {
    state,
    weeks,
  }
}

describe('useTimecardExportFilters', () => {
  it('defaults to the current week ending date and filters visible week packages', () => {
    const { state } = mountFilters({
      currentWeekEndDate: '2026-06-20',
      weeks: [
        makeWeek({ id: 'current-week', weekEndDate: '2026-06-20' }),
        makeWeek({ id: 'prior-week', weekEndDate: '2026-06-13' }),
      ],
    })

    expect(state.filters).toMatchObject({
      dateMode: 'single',
      singleWeekEndDate: '2026-06-20',
      rangeStartDate: '2026-06-20',
      rangeEndDate: '2026-06-20',
      selectedJobIds: [],
      foreman: 'all',
      status: 'all',
      weekSearch: '',
      cardSearch: '',
    })
    expect(state.activeWeekFilterBounds.value).toEqual({
      startDate: '2026-06-20',
      endDate: '2026-06-20',
    })
    expect(state.filteredWeeks.value.map((week) => week.id)).toEqual(['current-week'])
  })

  it('normalizes toolbar filter updates and snaps date fields to Saturday', () => {
    const { state } = mountFilters({ currentWeekEndDate: '2026-06-20' })

    state.updateToolbarFilter('dateMode', 'range')
    state.updateToolbarFilter('singleWeekEndDate', '2026-06-18')
    state.updateToolbarFilter('rangeStartDate', '2026-06-20')
    state.updateToolbarFilter('rangeEndDate', '2026-06-13')
    state.updateToolbarFilter('status', 'archived')
    state.updateToolbarFilter('selectedJobIds', 'job-1')

    expect(state.filters.dateMode).toBe('range')
    expect(state.filters.singleWeekEndDate).toBe('2026-06-20')
    expect(state.activeWeekFilterBounds.value).toEqual({
      startDate: '2026-06-13',
      endDate: '2026-06-20',
    })
    expect(state.filters.status).toBe('all')
    expect(state.filters.selectedJobIds).toEqual([])

    state.updateToolbarFilter('dateMode', 'nonsense')
    state.updateToolbarFilter('status', 'submitted')
    state.updateToolbarFilter('selectedJobIds', ['job-1', 'job-2'])
    state.updateToolbarFilter('foreman', ['not-valid'])
    state.updateToolbarFilter('weekSearch', 'shop')
    state.updateToolbarFilter('cardSearch', 'vince')

    expect(state.filters.dateMode).toBe('single')
    expect(state.filters.status).toBe('submitted')
    expect(state.filters.selectedJobIds).toEqual(['job-1', 'job-2'])
    expect(state.filters.foreman).toBe('')
    expect(state.filters.weekSearch).toBe('shop')
    expect(state.filters.cardSearch).toBe('vince')
  })

  it('filters weeks by date range, job, foreman, status, and search text', () => {
    const { state } = mountFilters({
      weeks: [
        makeWeek({
          id: 'target',
          jobCode: '736',
          jobId: 'job-shop',
          jobName: 'Shop',
          ownerForemanName: 'CJ Blanchard',
          status: 'submitted',
          weekEndDate: '2026-06-20',
        }),
        makeWeek({
          id: 'wrong-job',
          jobId: 'job-other',
          jobName: 'Shop',
          ownerForemanName: 'CJ Blanchard',
          status: 'submitted',
          weekEndDate: '2026-06-20',
        }),
        makeWeek({
          id: 'wrong-foreman',
          jobId: 'job-shop',
          jobName: 'Shop',
          ownerForemanName: 'Vince Hintz',
          status: 'submitted',
          weekEndDate: '2026-06-20',
        }),
        makeWeek({
          id: 'wrong-status',
          jobId: 'job-shop',
          jobName: 'Shop',
          ownerForemanName: 'CJ Blanchard',
          status: 'draft',
          weekEndDate: '2026-06-20',
        }),
        makeWeek({
          id: 'outside-range',
          jobId: 'job-shop',
          jobName: 'Shop',
          ownerForemanName: 'CJ Blanchard',
          status: 'submitted',
          weekEndDate: '2026-06-06',
        }),
      ],
    })

    state.updateToolbarFilter('dateMode', 'range')
    state.updateToolbarFilter('rangeStartDate', '2026-06-13')
    state.updateToolbarFilter('rangeEndDate', '2026-06-27')
    state.updateToolbarFilter('selectedJobIds', ['job-shop'])
    state.updateToolbarFilter('foreman', 'CJ Blanchard')
    state.updateToolbarFilter('status', 'submitted')
    state.updateToolbarFilter('weekSearch', 'shop')

    expect(state.filteredWeeks.value.map((week) => week.id)).toEqual(['target'])
  })
})
