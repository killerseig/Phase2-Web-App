import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  type TimecardExportArchiveCardRecord,
} from '@/features/timecards/exportViewHelpers'
import { useTimecardExportArchiveCards } from '@/features/timecards/useTimecardExportArchiveCards'
import { createWorkbookLines } from '@/features/timecards/workbook'
import { subscribeTimecardCards } from '@/services/timecards'
import type { JobRecord, TimecardCardRecord, TimecardWeekRecord } from '@/types/domain'

vi.mock('@/services/timecards', () => ({
  subscribeTimecardCards: vi.fn(),
}))

const subscribeTimecardCardsMock = vi.mocked(subscribeTimecardCards)

type CardsUpdateHandler = (cards: TimecardCardRecord[]) => void
type CardsErrorHandler = (error: unknown) => void

function makeJob(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    id: 'job-shop',
    active: true,
    assignedForemanIds: ['foreman-cj'],
    code: '736',
    gc: 'Phase 2',
    name: 'Shop',
    productionBurden: 0.45,
    type: 'General',
    ...overrides,
  }
}

function makeWeek(overrides: Partial<TimecardWeekRecord> = {}): TimecardWeekRecord {
  return {
    id: 'week-1',
    employeeCardCount: 1,
    jobCode: '736',
    jobId: 'job-shop',
    jobName: 'Shop',
    ownerForemanName: 'CJ Blanchard',
    ownerForemanUserId: 'foreman-cj',
    status: 'submitted',
    weekEndDate: '2026-06-20',
    weekStartDate: '2026-06-14',
    ...overrides,
  }
}

function makeCard(overrides: Partial<TimecardCardRecord> = {}): TimecardCardRecord {
  const lines = createWorkbookLines('2026-06-14')
  lines[0]!.jobNumber = '736'
  lines[0]!.days[1]!.hours = 8
  lines[0]!.days[1]!.production = 2

  return {
    id: 'card-1',
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
    lines,
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
    wageRate: 42.5,
    ...overrides,
  }
}

function mountArchiveCards(options: {
  defaultBurden?: number
  filteredWeeks?: TimecardWeekRecord[]
  jobs?: JobRecord[]
  pendingStateMaps?: Array<Record<string, boolean>>
} = {}) {
  const filteredWeeks = ref<TimecardWeekRecord[]>(options.filteredWeeks ?? [makeWeek()])
  const jobs = ref<JobRecord[]>(options.jobs ?? [makeJob()])
  const pendingStateMaps = ref<Array<Record<string, boolean>>>(options.pendingStateMaps ?? [])
  const onCardsChanged = vi.fn()
  const onError = vi.fn()
  const stopByWeekId = new Map<string, ReturnType<typeof vi.fn>>()
  const updateByWeekId = new Map<string, CardsUpdateHandler>()
  const errorByWeekId = new Map<string, CardsErrorHandler>()

  subscribeTimecardCardsMock.mockImplementation((weekId, _weekStartDate, _burden, onUpdate, onSubscribeError) => {
    const stop = vi.fn()
    stopByWeekId.set(weekId, stop)
    updateByWeekId.set(weekId, onUpdate)
    if (onSubscribeError) {
      errorByWeekId.set(weekId, onSubscribeError)
    }
    return stop
  })

  const state = useTimecardExportArchiveCards({
    defaultBurden: options.defaultBurden ?? 0.33,
    filteredWeeks,
    getJobs: () => jobs.value,
    getPendingStateMaps: () => pendingStateMaps.value,
    onCardsChanged,
    onError,
  })

  return {
    errorByWeekId,
    filteredWeeks,
    jobs,
    onCardsChanged,
    onError,
    pendingStateMaps,
    state,
    stopByWeekId,
    updateByWeekId,
  }
}

describe('useTimecardExportArchiveCards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    subscribeTimecardCardsMock.mockReset()
  })

  it('subscribes to filtered weeks with job burden and decorates loaded archive cards', () => {
    const {
      onCardsChanged,
      state,
      updateByWeekId,
    } = mountArchiveCards()

    state.syncCardsForFilteredWeeks()

    expect(subscribeTimecardCardsMock).toHaveBeenCalledWith(
      'week-1',
      '2026-06-14',
      0.45,
      expect.any(Function),
      expect.any(Function),
    )
    expect(state.cardsLoading.value).toBe(true)
    expect(onCardsChanged).toHaveBeenLastCalledWith([])

    updateByWeekId.get('week-1')?.([makeCard()])

    expect(state.cardsLoading.value).toBe(false)
    expect(state.cards.value).toHaveLength(1)
    expect(state.cards.value[0]).toEqual(expect.objectContaining({
      archiveBurden: 0.45,
      archiveForemanName: 'CJ Blanchard',
      archiveJobCode: '736',
      archiveJobId: 'job-shop',
      archiveJobName: 'Shop',
      archiveWeekEndDate: '2026-06-20',
      archiveWeekId: 'week-1',
      archiveWeekStartDate: '2026-06-14',
      archiveWeekStatus: 'submitted',
      id: 'card-1',
    }))
    expect(state.cards.value[0]?.totals.hoursTotal).toBe(8)
    expect(state.cards.value[0]?.totals.productionTotal).toBe(2)
    expect(onCardsChanged).toHaveBeenLastCalledWith(state.cards.value)
  })

  it('allows card-change handlers to be registered after archive-card state is created', () => {
    const filteredWeeks = ref<TimecardWeekRecord[]>([makeWeek()])
    const lateCardsChanged = vi.fn()
    const updateByWeekId = new Map<string, CardsUpdateHandler>()
    subscribeTimecardCardsMock.mockImplementation((weekId, _weekStartDate, _burden, onUpdate) => {
      updateByWeekId.set(weekId, onUpdate)
      return vi.fn()
    })
    const state = useTimecardExportArchiveCards({
      defaultBurden: 0.33,
      filteredWeeks,
      getJobs: () => [makeJob()],
      getPendingStateMaps: () => [],
      onError: vi.fn(),
    })

    state.setCardsChangedHandler(lateCardsChanged)
    state.syncCardsForFilteredWeeks()
    updateByWeekId.get('week-1')?.([makeCard({ id: 'card-after-handler' })])

    expect(lateCardsChanged).toHaveBeenLastCalledWith(state.cards.value)
    expect(state.cards.value.map((card) => card.id)).toEqual(['card-after-handler'])
  })

  it('stops stale week subscriptions and clears cards when no weeks remain', () => {
    const firstWeek = makeWeek({ id: 'week-1' })
    const secondWeek = makeWeek({
      id: 'week-2',
      jobId: 'job-lucky',
      jobCode: '5229',
      jobName: 'Lucky 3 Ranch',
      weekEndDate: '2026-06-27',
      weekStartDate: '2026-06-21',
    })
    const {
      filteredWeeks,
      onCardsChanged,
      state,
      stopByWeekId,
      updateByWeekId,
    } = mountArchiveCards({
      filteredWeeks: [firstWeek, secondWeek],
      jobs: [
        makeJob(),
        makeJob({ id: 'job-lucky', code: '5229', name: 'Lucky 3 Ranch', productionBurden: null }),
      ],
    })

    state.syncCardsForFilteredWeeks()
    updateByWeekId.get('week-1')?.([makeCard({ id: 'card-week-1' })])
    updateByWeekId.get('week-2')?.([makeCard({ id: 'card-week-2' })])

    filteredWeeks.value = [secondWeek]
    state.syncCardsForFilteredWeeks()

    expect(stopByWeekId.get('week-1')).toHaveBeenCalledTimes(1)
    expect(stopByWeekId.get('week-2')).not.toHaveBeenCalled()
    expect(subscribeTimecardCardsMock).toHaveBeenCalledTimes(2)
    expect(state.cards.value.map((card) => card.id)).toEqual(['card-week-2'])

    filteredWeeks.value = []
    state.syncCardsForFilteredWeeks()

    expect(stopByWeekId.get('week-2')).toHaveBeenCalledTimes(1)
    expect(state.cards.value).toEqual([])
    expect(state.cardsLoading.value).toBe(false)
    expect(onCardsChanged).toHaveBeenLastCalledWith([])
  })

  it('preserves locally pending cards when remote snapshots echo stale data', () => {
    const {
      pendingStateMaps,
      state,
      updateByWeekId,
    } = mountArchiveCards()

    state.syncCardsForFilteredWeeks()
    updateByWeekId.get('week-1')?.([makeCard({ notes: 'Local note before save' })])
    pendingStateMaps.value = [{ 'card-1': true }]
    updateByWeekId.get('week-1')?.([makeCard({ notes: 'Remote echo without local edit' })])

    expect(state.cards.value[0]?.notes).toBe('Local note before save')

    pendingStateMaps.value = []
    updateByWeekId.get('week-1')?.([makeCard({ notes: 'Remote accepted after save' })])

    expect(state.cards.value[0]?.notes).toBe('Remote accepted after save')
  })

  it('redecorates cached cards when job burden changes without resubscribing', () => {
    const {
      jobs,
      state,
      updateByWeekId,
    } = mountArchiveCards()

    state.syncCardsForFilteredWeeks()
    updateByWeekId.get('week-1')?.([makeCard()])

    expect(state.cards.value[0]?.archiveBurden).toBe(0.45)

    jobs.value = [makeJob({ productionBurden: 0.6 })]
    state.redecorateLoadedCards()

    expect(subscribeTimecardCardsMock).toHaveBeenCalledTimes(1)
    expect(state.cards.value[0]?.archiveBurden).toBe(0.6)
  })

  it('clears pending loading and forwards week-specific errors', () => {
    const {
      errorByWeekId,
      onError,
      state,
    } = mountArchiveCards()
    const error = new Error('cards failed')

    state.syncCardsForFilteredWeeks()
    expect(state.cardsLoading.value).toBe(true)

    errorByWeekId.get('week-1')?.(error)

    expect(state.cardsLoading.value).toBe(false)
    expect(onError).toHaveBeenCalledWith(error, makeWeek())
  })

  it('deletes cached week cards and derives the next sort index for a week', () => {
    const {
      onCardsChanged,
      state,
      updateByWeekId,
    } = mountArchiveCards()

    state.syncCardsForFilteredWeeks()
    updateByWeekId.get('week-1')?.([
      makeCard({ id: 'card-low', sortIndex: 4 }),
      makeCard({ id: 'card-high', sortIndex: 9 }),
    ])

    expect(state.getNextSortIndexForWeek('week-1')).toBe(10)
    expect(state.getNextSortIndexForWeek('missing-week')).toBe(0)

    state.deleteWeekCache('week-1')

    expect(state.cardsByWeekId['week-1']).toBeUndefined()
    expect(state.cards.value).toEqual([])
    expect(state.cardsLoading.value).toBe(false)
    expect(onCardsChanged).toHaveBeenLastCalledWith([])
  })

  it('stops every active card subscription and clears internal caches', () => {
    const firstWeek = makeWeek({ id: 'week-1' })
    const secondWeek = makeWeek({ id: 'week-2' })
    const {
      state,
      stopByWeekId,
      updateByWeekId,
    } = mountArchiveCards({
      filteredWeeks: [firstWeek, secondWeek],
    })

    state.syncCardsForFilteredWeeks()
    updateByWeekId.get('week-1')?.([makeCard({ id: 'card-week-1' })])
    updateByWeekId.get('week-2')?.([makeCard({ id: 'card-week-2' })])

    state.stopCardsSubscription()

    expect(stopByWeekId.get('week-1')).toHaveBeenCalledTimes(1)
    expect(stopByWeekId.get('week-2')).toHaveBeenCalledTimes(1)
    expect(Object.keys(state.cardsByWeekId)).toEqual([])
  })
})
