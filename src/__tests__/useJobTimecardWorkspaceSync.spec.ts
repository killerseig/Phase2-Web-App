import { computed, effectScope, nextTick, ref, type EffectScope } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useJobTimecardWorkspaceSync } from '@/features/timecards/useJobTimecardWorkspaceSync'
import type { JobRecord, TimecardCardRecord, TimecardWeekRecord } from '@/types/domain'

function makeJob(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    id: 'job-1',
    active: true,
    assignedForemanIds: ['foreman-1'],
    code: '5229',
    gc: 'Lucky 3',
    name: 'Lucky 3 Ranch',
    type: 'general',
    ...overrides,
  }
}

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

let activeScope: EffectScope | null = null

function mountWorkspaceSync(options: {
  burdenValue?: number
  cards?: TimecardCardRecord[]
  filteredCards?: TimecardCardRecord[]
  job?: JobRecord | null
  jobId?: string | null
  selectedWeek?: TimecardWeekRecord | null
  selectedWeekEndDate?: string
  selectedWeekId?: string | null
  weekSubscriptionKey?: string
  weeks?: TimecardWeekRecord[]
} = {}) {
  activeScope?.stop()
  activeScope = effectScope()

  const burdenValue = ref(options.burdenValue ?? 0.33)
  const cards = ref<TimecardCardRecord[]>(options.cards ?? [makeCard()])
  const filteredCards = ref<TimecardCardRecord[]>(
    options.filteredCards ?? [makeCard({ id: 'card-visible' })],
  )
  const job = ref<JobRecord | null>(options.job === undefined ? makeJob() : options.job)
  const jobId = ref<string | null>(options.jobId === undefined ? 'job-1' : options.jobId)
  const selectedWeek = ref<TimecardWeekRecord | null>(
    options.selectedWeek === undefined ? makeWeek() : options.selectedWeek,
  )
  const selectedWeekEndDate = ref(options.selectedWeekEndDate ?? '2026-06-20')
  const selectedWeekId = ref<string | null>(
    options.selectedWeekId === undefined ? 'week-1' : options.selectedWeekId,
  )
  const weekSubscriptionKey = ref(options.weekSubscriptionKey ?? 'job-1|current-user|foreman-1')
  const weeks = ref<TimecardWeekRecord[]>(options.weeks ?? [makeWeek()])
  const calls: string[] = []
  const maybeBackfillSelectedDraftWeek = vi.fn(() => {
    calls.push('backfill')
  })
  const resetCardWorkspaceState = vi.fn(() => {
    calls.push('reset-card-workspace')
  })
  const resetPageAndSaveMessages = vi.fn(() => {
    calls.push('reset-page')
  })
  const subscribeCardsForWeek = vi.fn(() => {
    calls.push('subscribe-cards')
  })
  const subscribeJob = vi.fn(() => {
    calls.push('subscribe-job')
  })
  const subscribeWeeksForJob = vi.fn(() => {
    calls.push('subscribe-weeks')
  })
  const syncSelectedCardFromVisibleCards = vi.fn((nextCards: TimecardCardRecord[]) => {
    calls.push(`sync-visible:${nextCards.map((card) => card.id).join(',')}`)
  })

  activeScope.run(() => {
    useJobTimecardWorkspaceSync({
      burdenValue: computed(() => burdenValue.value),
      cards,
      filteredCards: computed(() => filteredCards.value),
      job: computed(() => job.value),
      jobId: computed(() => jobId.value),
      maybeBackfillSelectedDraftWeek,
      resetCardWorkspaceState,
      resetPageAndSaveMessages,
      selectedWeek: computed(() => selectedWeek.value),
      selectedWeekEndDate,
      selectedWeekId,
      subscribeCardsForWeek,
      subscribeJob,
      subscribeWeeksForJob,
      syncSelectedCardFromVisibleCards,
      weekSubscriptionKey: computed(() => weekSubscriptionKey.value),
      weeks,
    })
  })

  return {
    burdenValue,
    calls,
    cards,
    filteredCards,
    job,
    jobId,
    maybeBackfillSelectedDraftWeek,
    resetCardWorkspaceState,
    resetPageAndSaveMessages,
    selectedWeek,
    selectedWeekEndDate,
    selectedWeekId,
    subscribeCardsForWeek,
    subscribeJob,
    subscribeWeeksForJob,
    syncSelectedCardFromVisibleCards,
    weekSubscriptionKey,
    weeks,
  }
}

afterEach(() => {
  activeScope?.stop()
  activeScope = null
})

describe('useJobTimecardWorkspaceSync', () => {
  it('resets card workspace state and resubscribes cards when the selected week changes', async () => {
    const {
      calls,
      cards,
      resetCardWorkspaceState,
      selectedWeek,
      subscribeCardsForWeek,
    } = mountWorkspaceSync({
      cards: [makeCard({ id: 'card-a' })],
      selectedWeek: makeWeek({ id: 'week-1' }),
    })

    selectedWeek.value = makeWeek({ id: 'week-2' })
    await nextTick()

    expect(resetCardWorkspaceState).toHaveBeenCalledTimes(1)
    expect(cards.value).toEqual([])
    expect(subscribeCardsForWeek).toHaveBeenCalledTimes(1)
    expect(calls).toEqual(['reset-card-workspace', 'subscribe-cards'])
  })

  it('resets card workspace state and attempts draft backfill when the selected week ending date changes', async () => {
    const {
      calls,
      cards,
      maybeBackfillSelectedDraftWeek,
      resetCardWorkspaceState,
      selectedWeekEndDate,
      subscribeCardsForWeek,
    } = mountWorkspaceSync({
      cards: [makeCard({ id: 'card-a' })],
      selectedWeekEndDate: '2026-06-20',
    })

    selectedWeekEndDate.value = '2026-06-27'
    await nextTick()

    expect(resetCardWorkspaceState).toHaveBeenCalledTimes(1)
    expect(cards.value).toEqual([])
    expect(maybeBackfillSelectedDraftWeek).toHaveBeenCalledTimes(1)
    expect(subscribeCardsForWeek).not.toHaveBeenCalled()
    expect(calls).toEqual(['reset-card-workspace', 'backfill'])
  })

  it('clears job-scoped state and restarts job/week subscriptions when the route job changes', async () => {
    const {
      calls,
      cards,
      jobId,
      resetCardWorkspaceState,
      resetPageAndSaveMessages,
      selectedWeekId,
      subscribeJob,
      subscribeWeeksForJob,
      weeks,
    } = mountWorkspaceSync({
      cards: [makeCard({ id: 'card-a' })],
      selectedWeekId: 'week-1',
      weeks: [makeWeek({ id: 'week-1' })],
    })

    jobId.value = 'job-2'
    await nextTick()

    expect(resetPageAndSaveMessages).toHaveBeenCalledTimes(1)
    expect(resetCardWorkspaceState).toHaveBeenCalledTimes(1)
    expect(selectedWeekId.value).toBeNull()
    expect(weeks.value).toEqual([])
    expect(cards.value).toEqual([])
    expect(subscribeJob).toHaveBeenCalledTimes(1)
    expect(subscribeWeeksForJob).toHaveBeenCalledTimes(1)
    expect(calls).toEqual([
      'reset-page',
      'reset-card-workspace',
      'subscribe-job',
      'subscribe-weeks',
    ])
  })

  it('clears stale errors and restarts week subscription when auth-scoped week access changes', async () => {
    const {
      calls,
      cards,
      resetPageAndSaveMessages,
      subscribeWeeksForJob,
      weekSubscriptionKey,
      weeks,
    } = mountWorkspaceSync({
      cards: [makeCard({ id: 'card-a' })],
      weekSubscriptionKey: 'job-1|current-user|',
      weeks: [makeWeek({ id: 'week-1' })],
    })

    weekSubscriptionKey.value = 'job-1|current-user|foreman-1'
    await nextTick()

    expect(resetPageAndSaveMessages).toHaveBeenCalledTimes(1)
    expect(weeks.value).toEqual([])
    expect(cards.value).toEqual([])
    expect(subscribeWeeksForJob).toHaveBeenCalledTimes(1)
    expect(calls).toEqual([
      'reset-page',
      'subscribe-weeks',
    ])
  })

  it('selects the first visible week when weeks load and no date has been chosen yet', async () => {
    const {
      selectedWeekEndDate,
      selectedWeekId,
      weeks,
    } = mountWorkspaceSync({
      selectedWeek: null,
      selectedWeekEndDate: '',
      selectedWeekId: null,
      weeks: [],
    })

    weeks.value = [
      makeWeek({
        id: 'week-submitted',
        status: 'submitted',
        weekEndDate: '2026-06-06',
      }),
    ]
    await nextTick()

    expect(selectedWeekEndDate.value).toBe('2026-06-06')
    expect(selectedWeekId.value).toBe('week-submitted')
  })

  it('attempts draft backfill when the subscribed job document changes', async () => {
    const {
      job,
      maybeBackfillSelectedDraftWeek,
    } = mountWorkspaceSync({
      job: makeJob({ id: 'job-1' }),
    })

    job.value = makeJob({ id: 'job-2' })
    await nextTick()

    expect(maybeBackfillSelectedDraftWeek).toHaveBeenCalledTimes(1)
  })

  it('refreshes cards after burden changes only when a week is selected', async () => {
    const withWeek = mountWorkspaceSync({
      burdenValue: 0.33,
      selectedWeek: makeWeek(),
    })

    withWeek.burdenValue.value = 0.42
    await nextTick()

    expect(withWeek.subscribeCardsForWeek).toHaveBeenCalledTimes(1)

    const withoutWeek = mountWorkspaceSync({
      burdenValue: 0.33,
      selectedWeek: null,
    })

    withoutWeek.burdenValue.value = 0.42
    await nextTick()

    expect(withoutWeek.subscribeCardsForWeek).not.toHaveBeenCalled()
  })

  it('syncs selected card state whenever the visible card id signature changes', async () => {
    const {
      filteredCards,
      syncSelectedCardFromVisibleCards,
    } = mountWorkspaceSync({
      filteredCards: [makeCard({ id: 'card-a' })],
    })
    const nextCards = [
      makeCard({ id: 'card-b' }),
      makeCard({ id: 'card-c' }),
    ]

    filteredCards.value = nextCards
    await nextTick()

    expect(syncSelectedCardFromVisibleCards).toHaveBeenCalledWith(nextCards)
  })

  it('does not sync selected card state when visible cards change without an id signature change', async () => {
    const {
      filteredCards,
      syncSelectedCardFromVisibleCards,
    } = mountWorkspaceSync({
      filteredCards: [makeCard({ id: 'card-a', notes: 'old' })],
    })

    filteredCards.value = [makeCard({ id: 'card-a', notes: 'new' })]
    await nextTick()

    expect(syncSelectedCardFromVisibleCards).not.toHaveBeenCalled()
  })
})
