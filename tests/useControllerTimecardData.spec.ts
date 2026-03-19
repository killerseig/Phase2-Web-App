import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useControllerTimecardData } from '@/composables/useControllerTimecardData'
import type { ControllerTimecardFilters } from '@/services/Email'
import type { TimecardModel } from '@/views/timecards/timecardUtils'

const {
  downloadTimecardsForWeekMock,
  listTimecardsForWeekMock,
  listTimecardsByJobAndWeekMock,
} = vi.hoisted(() => ({
  downloadTimecardsForWeekMock: vi.fn(),
  listTimecardsForWeekMock: vi.fn(),
  listTimecardsByJobAndWeekMock: vi.fn(),
}))

vi.mock('@/services/Email', () => ({
  downloadTimecardsForWeek: downloadTimecardsForWeekMock,
  listTimecardsForWeek: listTimecardsForWeekMock,
}))

vi.mock('@/services/Timecards', () => ({
  listTimecardsByJobAndWeek: listTimecardsByJobAndWeekMock,
}))

const filters: ControllerTimecardFilters = {
  startWeek: '2026-03-08',
  endWeek: '2026-03-08',
  jobId: '',
  trade: '',
  firstName: '',
  lastName: '',
  subcontracted: 'all',
  status: 'all',
}

function createTimecard(): TimecardModel {
  return {
    id: 'tc-1',
    jobId: 'job-1',
    weekStartDate: '2026-03-08',
    weekEndingDate: '2026-03-14',
    status: 'draft',
    createdByUid: 'creator-1',
    employeeRosterId: 'roster-1',
    employeeNumber: '100',
    employeeName: 'Casey Stone',
    firstName: 'Casey',
    lastName: 'Stone',
    occupation: 'Carpenter',
    employeeWage: 30,
    subcontractedEmployee: false,
    mileage: 0,
    jobs: [],
    days: [],
    totals: {
      hours: [0, 0, 0, 0, 0, 0, 0],
      production: [0, 0, 0, 0, 0, 0, 0],
      hoursTotal: 0,
      productionTotal: 0,
      lineTotal: 0,
    },
    notes: '',
    archived: false,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('useControllerTimecardData', () => {
  it('loads review rows and hydrates detailed timecards', async () => {
    listTimecardsForWeekMock.mockResolvedValue({
      startWeek: '2026-03-08',
      endWeek: '2026-03-08',
      startWeekEnding: '2026-03-14',
      endWeekEnding: '2026-03-14',
      filters: {
        jobId: '',
        trade: '',
        firstName: '',
        lastName: '',
        subcontracted: 'all',
        status: 'all',
      },
      totalCount: 1,
      submittedCount: 0,
      draftCount: 1,
      totalHours: 0,
      totalProduction: 0,
      totalLine: 0,
      timecards: [{
        id: 'row-1',
        timecardId: 'tc-1',
        jobId: 'job-1',
        jobName: 'Alpha Build',
        jobCode: '100',
        createdByUid: 'creator-1',
        createdByName: 'Pat Foreman',
        employeeNumber: '100',
        employeeName: 'Casey Stone',
        firstName: 'Casey',
        lastName: 'Stone',
        occupation: 'Carpenter',
        status: 'draft',
        weekStart: '2026-03-08',
        weekEnding: '2026-03-14',
        totalHours: 0,
        totalProduction: 0,
        totalLine: 0,
        mileage: 0,
        subcontractedEmployee: false,
        submittedAt: null,
        submittedAtMs: null,
      }],
    })
    listTimecardsByJobAndWeekMock.mockResolvedValue([createTimecard()])

    const appliedFilters = ref<ControllerTimecardFilters | null>(null)
    const loadedPeriod = ref({
      startWeek: '',
      endWeek: '',
      startWeekEnding: '',
      endWeekEnding: '',
    })
    const toast = { show: vi.fn() }

    const data = useControllerTimecardData({
      appliedFilters,
      loadedPeriod,
      buildFilterPayload: () => filters,
      filterValidationError: computed(() => ''),
      pendingFilterChanges: computed(() => false),
      formatSearchRange: (startWeek, endWeek) => `${startWeek} to ${endWeek}`,
      buildTimecardKey: (jobId, timecardId) => `${jobId}::${timecardId}`,
      toast,
    })

    const loaded = await data.loadTimecards(filters)

    expect(loaded).toBe(true)
    expect(data.reviewTimecards.value).toHaveLength(1)
    expect(Object.keys(data.loadedTimecardMap.value)).toEqual(['job-1::tc-1'])
    expect(data.reviewSummary.value.totalCount).toBe(1)
    expect(appliedFilters.value?.startWeek).toBe('2026-03-08')
    expect(loadedPeriod.value.startWeekEnding).toBe('2026-03-14')
  })

  it('queues a reload after filter changes', async () => {
    listTimecardsForWeekMock.mockResolvedValue({
      startWeek: '2026-03-08',
      endWeek: '2026-03-08',
      startWeekEnding: '2026-03-14',
      endWeekEnding: '2026-03-14',
      filters: {
        jobId: '',
        trade: '',
        firstName: '',
        lastName: '',
        subcontracted: 'all',
        status: 'all',
      },
      totalCount: 0,
      submittedCount: 0,
      draftCount: 0,
      totalHours: 0,
      totalProduction: 0,
      totalLine: 0,
      timecards: [],
    })
    listTimecardsByJobAndWeekMock.mockResolvedValue([])

    const data = useControllerTimecardData({
      appliedFilters: ref<ControllerTimecardFilters | null>(null),
      loadedPeriod: ref({
        startWeek: '',
        endWeek: '',
        startWeekEnding: '',
        endWeekEnding: '',
      }),
      buildFilterPayload: () => filters,
      filterValidationError: computed(() => ''),
      pendingFilterChanges: computed(() => true),
      formatSearchRange: (startWeek, endWeek) => `${startWeek} to ${endWeek}`,
      buildTimecardKey: (jobId, timecardId) => `${jobId}::${timecardId}`,
      toast: { show: vi.fn() },
    })

    data.queueAutoReload(300)
    await vi.advanceTimersByTimeAsync(300)

    expect(listTimecardsForWeekMock).toHaveBeenCalledWith(filters)
  })
})
