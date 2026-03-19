import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import type { ControllerGroupedTimecard } from '@/components/controller/controllerTypes'
import { useControllerTimecardEditing } from '@/composables/useControllerTimecardEditing'
import type { ControllerTimecardWeekItem } from '@/services/Email'
import type { TimecardModel } from '@/views/timecards/timecardUtils'

const { deleteTimecardMock, updateTimecardMock } = vi.hoisted(() => ({
  deleteTimecardMock: vi.fn(),
  updateTimecardMock: vi.fn(),
}))

vi.mock('@/services/Timecards', () => ({
  deleteTimecard: deleteTimecardMock,
  updateTimecard: updateTimecardMock,
}))

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

function createRow(): ControllerTimecardWeekItem {
  return {
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
  }
}

function createEntry(timecard: TimecardModel): ControllerGroupedTimecard {
  return {
    key: 'job-1::tc-1',
    row: createRow(),
    timecard,
  }
}

afterEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('useControllerTimecardEditing', () => {
  it('autosaves mileage updates and refreshes the review row', async () => {
    vi.useFakeTimers()
    updateTimecardMock.mockResolvedValue(undefined)

    const timecard = createTimecard()
    const reviewTimecards = ref<ControllerTimecardWeekItem[]>([createRow()])
    const loadedTimecardMap = ref<Record<string, TimecardModel>>({
      'job-1::tc-1': timecard,
    })
    const queueAutoReload = vi.fn()
    const recalculateReviewSummary = vi.fn()
    const toast = { show: vi.fn() }

    const editing = useControllerTimecardEditing({
      authRole: () => 'controller',
      isAdmin: computed(() => false),
      reviewTimecards,
      loadedTimecardMap,
      buildTimecardKey: (jobId, timecardId) => `${jobId}::${timecardId}`,
      queueAutoReload,
      recalculateReviewSummary,
      confirm: vi.fn(),
      toast,
    })

    editing.updateMileage(timecard, '12.5')
    await vi.advanceTimersByTimeAsync(500)

    expect(updateTimecardMock).toHaveBeenCalledWith('job-1', 'tc-1', expect.objectContaining({
      mileage: 12.5,
    }))
    expect(reviewTimecards.value[0]?.mileage).toBe(12.5)
    expect(queueAutoReload).toHaveBeenCalledWith(700)
  })

  it('deletes a confirmed timecard from local state', async () => {
    deleteTimecardMock.mockResolvedValue(undefined)

    const timecard = createTimecard()
    const entry = createEntry(timecard)
    const reviewTimecards = ref<ControllerTimecardWeekItem[]>([entry.row])
    const loadedTimecardMap = ref<Record<string, TimecardModel>>({
      [entry.key]: timecard,
    })
    const queueAutoReload = vi.fn()
    const recalculateReviewSummary = vi.fn()
    const toast = { show: vi.fn() }
    const confirm = vi.fn().mockResolvedValue(true)

    const editing = useControllerTimecardEditing({
      authRole: () => 'controller',
      isAdmin: computed(() => true),
      reviewTimecards,
      loadedTimecardMap,
      buildTimecardKey: (jobId, timecardId) => `${jobId}::${timecardId}`,
      queueAutoReload,
      recalculateReviewSummary,
      confirm,
      toast,
    })

    await editing.handleDeleteTimecard(entry)

    expect(deleteTimecardMock).toHaveBeenCalledWith('job-1', 'tc-1')
    expect(reviewTimecards.value).toEqual([])
    expect(loadedTimecardMap.value).toEqual({})
    expect(queueAutoReload).toHaveBeenCalledWith(250)
    expect(toast.show).toHaveBeenCalledWith('Deleted timecard for Casey Stone', 'success')
  })
})
