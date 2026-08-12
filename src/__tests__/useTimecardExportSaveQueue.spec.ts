import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  type TimecardExportArchiveCardRecord,
} from '@/features/timecards/exportViewHelpers'
import { useTimecardExportSaveQueue } from '@/features/timecards/useTimecardExportSaveQueue'
import { createWorkbookLines } from '@/features/timecards/workbook'
import { updateTimecardCard } from '@/services/timecards'

vi.mock('@/services/timecards', () => ({
  updateTimecardCard: vi.fn(),
}))

const updateTimecardCardMock = vi.mocked(updateTimecardCard)

function makeCard(overrides: Partial<TimecardExportArchiveCardRecord> = {}): TimecardExportArchiveCardRecord {
  return {
    id: 'card-1',
    archiveBurden: 0.33,
    archiveForemanName: 'CJ Blanchard',
    archiveJobCode: '736',
    archiveJobId: 'job-shop',
    archiveJobName: 'Shop',
    archiveWeekEndDate: '2026-06-20',
    archiveWeekId: 'week-1',
    archiveWeekStartDate: '2026-06-14',
    archiveWeekStatus: 'submitted',
    employeeId: 'employee-1',
    employeeNumber: '5133',
    firstName: 'CJ',
    footerAccount: '',
    footerAmount: '',
    footerJobOrGl: '',
    footerOffice: '',
    footerSecondAccount: '',
    footerSecondAmount: '',
    footerSecondJobOrGl: '',
    footerSecondOffice: '',
    fullName: 'Blanchard, CJ',
    isContractor: false,
    lastName: 'Blanchard',
    lines: createWorkbookLines('2026-06-14'),
    notes: '',
    occupation: 'Shop Foreman',
    overtimeHoursOverride: null,
    regularHoursOverride: null,
    sortIndex: 0,
    sourceType: 'employee',
    totals: {
      hoursByDay: [],
      hoursTotal: 0,
      lineTotal: 0,
      productionByDay: [],
      productionTotal: 0,
    },
    wageRate: null,
    ...overrides,
  }
}

function mountSaveQueue(options: {
  canEditWeek?: boolean
  cards?: TimecardExportArchiveCardRecord[]
} = {}) {
  const canEditWeek = ref(options.canEditWeek ?? true)
  const cards = ref<TimecardExportArchiveCardRecord[]>(options.cards ?? [])
  const queue = useTimecardExportSaveQueue({
    canEditWeek: computed(() => canEditWeek.value),
    cards: computed(() => cards.value),
  })

  return {
    canEditWeek,
    cards,
    queue,
  }
}

describe('useTimecardExportSaveQueue', () => {
  beforeEach(() => {
    updateTimecardCardMock.mockReset()
    updateTimecardCardMock.mockResolvedValue()
  })

  it('persists archive card changes through the timecard service with export week context', async () => {
    const card = makeCard({
      id: 'card-export',
      archiveBurden: 0.52,
      archiveWeekId: 'week-export',
      archiveWeekStartDate: '2026-06-21',
    })
    const { queue } = mountSaveQueue({
      cards: [card],
    })

    await queue.persistCard(card)

    expect(updateTimecardCardMock).toHaveBeenCalledWith(
      'week-export',
      'card-export',
      '2026-06-21',
      card,
      0.52,
    )
    expect(queue.lastSavedAt.value).toEqual(expect.any(Number))
    expect(queue.saveError.value).toBe('')
  })

  it('does not persist or schedule saves when the export week is read only', async () => {
    vi.useFakeTimers()
    try {
      const card = makeCard()
      const { queue } = mountSaveQueue({
        canEditWeek: false,
        cards: [card],
      })

      await queue.persistCard(card)
      queue.scheduleCardSave(card)

      expect(queue.pendingSaveCount.value).toBe(0)
      expect(updateTimecardCardMock).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('flushes scheduled export card saves without waiting for the debounce timer', async () => {
    vi.useFakeTimers()
    try {
      const cardA = makeCard({
        id: 'card-a',
        archiveBurden: 0.4,
        archiveWeekId: 'week-a',
        archiveWeekStartDate: '2026-06-14',
      })
      const cardB = makeCard({
        id: 'card-b',
        archiveBurden: 0.5,
        archiveWeekId: 'week-b',
        archiveWeekStartDate: '2026-06-21',
      })
      const { queue } = mountSaveQueue({
        cards: [cardA, cardB],
      })

      queue.scheduleCardSave(cardA)
      queue.scheduleCardSave(cardB)

      expect(queue.pendingSaveCount.value).toBe(2)
      expect(updateTimecardCardMock).not.toHaveBeenCalled()

      await queue.flushPendingSaves()

      expect(updateTimecardCardMock).toHaveBeenNthCalledWith(
        1,
        'week-a',
        'card-a',
        '2026-06-14',
        cardA,
        0.4,
      )
      expect(updateTimecardCardMock).toHaveBeenNthCalledWith(
        2,
        'week-b',
        'card-b',
        '2026-06-21',
        cardB,
        0.5,
      )
      expect(queue.pendingSaveCount.value).toBe(0)
      expect(queue.activeSaveCount.value).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('surfaces service failures through the shared save-error state', async () => {
    updateTimecardCardMock.mockRejectedValueOnce(new Error('Permission denied'))
    const card = makeCard()
    const { queue } = mountSaveQueue({
      cards: [card],
    })

    await expect(queue.persistCard(card)).rejects.toThrow('Permission denied')

    expect(queue.saveError.value).toBe('Permission denied')
    expect(queue.lastSavedAt.value).toBeNull()
  })
})
