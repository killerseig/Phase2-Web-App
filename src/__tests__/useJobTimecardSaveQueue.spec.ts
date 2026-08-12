import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useJobTimecardSaveQueue } from '@/features/timecards/useJobTimecardSaveQueue'
import { updateTimecardCard } from '@/services/timecards'
import type { TimecardCardRecord, TimecardWeekRecord } from '@/types/domain'

vi.mock('@/services/timecards', () => ({
  updateTimecardCard: vi.fn(),
}))

const updateTimecardCardMock = vi.mocked(updateTimecardCard)

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

function makeCard(overrides: Partial<TimecardCardRecord> = {}): TimecardCardRecord {
  return {
    id: 'card-1',
    employeeId: 'employee-1',
    employeeNumber: '5133',
    firstName: 'Vince',
    footerAccount: '',
    footerAmount: '',
    footerJobOrGl: '',
    footerOffice: '',
    footerSecondAccount: '',
    footerSecondAmount: '',
    footerSecondJobOrGl: '',
    footerSecondOffice: '',
    fullName: 'Vince Hintz',
    isContractor: false,
    lastName: 'Hintz',
    lines: [],
    notes: '',
    occupation: 'Foreman',
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
  burdenValue?: number
  canEditWeek?: boolean
  cards?: TimecardCardRecord[]
  selectedWeek?: TimecardWeekRecord | null
  selectedWeekStartDate?: string
} = {}) {
  const burdenValue = ref(options.burdenValue ?? 0.33)
  const canEditWeek = ref(options.canEditWeek ?? true)
  const cards = ref<TimecardCardRecord[]>(options.cards ?? [])
  const selectedWeek = ref<TimecardWeekRecord | null>(
    options.selectedWeek === undefined ? makeWeek() : options.selectedWeek,
  )
  const selectedWeekStartDate = ref(options.selectedWeekStartDate ?? '2026-06-14')

  const queue = useJobTimecardSaveQueue({
    burdenValue: computed(() => burdenValue.value),
    canEditWeek: computed(() => canEditWeek.value),
    cards: computed(() => cards.value),
    selectedWeek: computed(() => selectedWeek.value),
    selectedWeekStartDate: computed(() => selectedWeekStartDate.value),
  })

  return {
    burdenValue,
    canEditWeek,
    cards,
    queue,
    selectedWeek,
    selectedWeekStartDate,
  }
}

describe('useJobTimecardSaveQueue', () => {
  beforeEach(() => {
    updateTimecardCardMock.mockReset()
    updateTimecardCardMock.mockResolvedValue()
  })

  it('persists card changes through the timecard service with the selected week context', async () => {
    const card = makeCard({ id: 'card-vince' })
    const {
      queue,
    } = mountSaveQueue({
      burdenValue: 0.42,
      cards: [card],
      selectedWeek: makeWeek({ id: 'week-5229' }),
      selectedWeekStartDate: '2026-06-21',
    })

    await queue.persistCard(card)

    expect(updateTimecardCardMock).toHaveBeenCalledWith(
      'week-5229',
      'card-vince',
      '2026-06-21',
      card,
      0.42,
    )
    expect(queue.lastSavedAt.value).toEqual(expect.any(Number))
    expect(queue.saveError.value).toBe('')
  })

  it('does not persist when there is no selected week or the week is read only', async () => {
    const card = makeCard({ id: 'card-vince' })
    const noWeek = mountSaveQueue({
      cards: [card],
      selectedWeek: null,
    })

    await noWeek.queue.persistCard(card)

    const readOnly = mountSaveQueue({
      canEditWeek: false,
      cards: [card],
    })

    await readOnly.queue.persistCard(card)

    expect(updateTimecardCardMock).not.toHaveBeenCalled()
    expect(noWeek.queue.lastSavedAt.value).toBeNull()
    expect(readOnly.queue.lastSavedAt.value).toBeNull()
  })

  it('does not schedule saves unless the current week can be edited', () => {
    vi.useFakeTimers()
    try {
      const card = makeCard({ id: 'card-vince' })
      const noWeek = mountSaveQueue({
        cards: [card],
        selectedWeek: null,
      })
      const readOnly = mountSaveQueue({
        canEditWeek: false,
        cards: [card],
      })

      noWeek.queue.scheduleCardSave(card)
      readOnly.queue.scheduleCardSave(card)

      expect(noWeek.queue.pendingSaveCount.value).toBe(0)
      expect(readOnly.queue.pendingSaveCount.value).toBe(0)
      expect(updateTimecardCardMock).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('flushes scheduled saves for the current cards without waiting for the debounce timer', async () => {
    vi.useFakeTimers()
    try {
      const cardA = makeCard({ id: 'card-a' })
      const cardB = makeCard({ id: 'card-b' })
      const {
        queue,
      } = mountSaveQueue({
        burdenValue: 0.5,
        cards: [cardA, cardB],
        selectedWeek: makeWeek({ id: 'week-flush' }),
        selectedWeekStartDate: '2026-06-28',
      })

      queue.scheduleCardSave(cardA)
      queue.scheduleCardSave(cardB)

      expect(queue.pendingSaveCount.value).toBe(2)
      expect(updateTimecardCardMock).not.toHaveBeenCalled()

      await queue.flushPendingSaves()

      expect(updateTimecardCardMock).toHaveBeenNthCalledWith(
        1,
        'week-flush',
        'card-a',
        '2026-06-28',
        cardA,
        0.5,
      )
      expect(updateTimecardCardMock).toHaveBeenNthCalledWith(
        2,
        'week-flush',
        'card-b',
        '2026-06-28',
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
    const card = makeCard({ id: 'card-vince' })
    const {
      queue,
    } = mountSaveQueue({ cards: [card] })

    await expect(queue.persistCard(card)).rejects.toThrow('Permission denied')

    expect(queue.saveError.value).toBe('Permission denied')
    expect(queue.savingIds['card-vince']).toBeUndefined()
  })
})
