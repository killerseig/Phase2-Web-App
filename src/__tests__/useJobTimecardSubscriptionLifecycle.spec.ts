import { defineComponent, ref, type Ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useJobTimecardSubscriptionLifecycle } from '@/features/timecards/useJobTimecardSubscriptionLifecycle'
import type { TimecardCardRecord, TimecardWeekRecord } from '@/types/domain'

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

let activeWrapper: VueWrapper | null = null

function mountLifecycle(options: {
  cards?: TimecardCardRecord[]
  cardsLoading?: boolean
  jobId?: string | null
  selectedWeek?: TimecardWeekRecord | null
} = {}) {
  activeWrapper?.unmount()

  const cards = ref<TimecardCardRecord[]>(options.cards ?? [makeCard()])
  const cardsLoading = ref(options.cardsLoading ?? false)
  const jobId = ref<string | null>(options.jobId === undefined ? 'job-1' : options.jobId)
  const selectedWeek = ref<TimecardWeekRecord | null>(
    options.selectedWeek === undefined ? makeWeek() : options.selectedWeek,
  )
  const calls: string[] = []
  const disconnectCardMeasurements = vi.fn(() => {
    calls.push('disconnect-measurements')
  })
  const disposeSaveQueue = vi.fn(() => {
    calls.push('dispose-save-queue')
  })
  const startCardsRecordsSubscription = vi.fn(() => {
    calls.push('start-cards')
  })
  const startEmployeesSubscription = vi.fn(() => {
    calls.push('start-employees')
  })
  const startWeeksRecordsSubscription = vi.fn(() => {
    calls.push('start-weeks')
  })
  const stopCardsRecordsSubscription = vi.fn(() => {
    calls.push('stop-cards')
  })
  const stopEmployeesSubscription = vi.fn(() => {
    calls.push('stop-employees')
  })
  const stopRouteJobSubscription = vi.fn(() => {
    calls.push('stop-route-job')
  })
  const stopWeeksRecordsSubscription = vi.fn(() => {
    calls.push('stop-weeks')
  })
  const subscribeRouteJob = vi.fn(() => {
    calls.push('subscribe-route-job')
  })

  let lifecycle!: ReturnType<typeof useJobTimecardSubscriptionLifecycle>
  const Harness = defineComponent({
    name: 'JobTimecardSubscriptionLifecycleHarness',
    setup() {
      lifecycle = useJobTimecardSubscriptionLifecycle({
        cards,
        cardsLoading,
        disconnectCardMeasurements,
        disposeSaveQueue,
        jobId: jobId as Ref<string | null>,
        selectedWeek: selectedWeek as Ref<TimecardWeekRecord | null>,
        startCardsRecordsSubscription,
        startEmployeesSubscription,
        startWeeksRecordsSubscription,
        stopCardsRecordsSubscription,
        stopEmployeesSubscription,
        stopRouteJobSubscription,
        stopWeeksRecordsSubscription,
        subscribeRouteJob,
      })

      return () => null
    },
  })

  activeWrapper = mount(Harness)

  return {
    calls,
    cards,
    cardsLoading,
    disconnectCardMeasurements,
    disposeSaveQueue,
    jobId,
    lifecycle,
    selectedWeek,
    startCardsRecordsSubscription,
    startEmployeesSubscription,
    startWeeksRecordsSubscription,
    stopCardsRecordsSubscription,
    stopEmployeesSubscription,
    stopRouteJobSubscription,
    stopWeeksRecordsSubscription,
    subscribeRouteJob,
    wrapper: activeWrapper,
  }
}

afterEach(() => {
  activeWrapper?.unmount()
  activeWrapper = null
})

describe('useJobTimecardSubscriptionLifecycle', () => {
  it('starts route-job, week, and employee subscriptions on mount when a job is selected', () => {
    const lifecycle = mountLifecycle({ jobId: 'job-1' })

    expect(lifecycle.subscribeRouteJob).toHaveBeenCalledTimes(1)
    expect(lifecycle.startWeeksRecordsSubscription).toHaveBeenCalledTimes(1)
    expect(lifecycle.startEmployeesSubscription).toHaveBeenCalledTimes(1)
  })

  it('starts route-job and employees on mount but skips weeks when no job is selected', () => {
    const lifecycle = mountLifecycle({ jobId: null })

    expect(lifecycle.subscribeRouteJob).toHaveBeenCalledTimes(1)
    expect(lifecycle.startWeeksRecordsSubscription).not.toHaveBeenCalled()
    expect(lifecycle.startEmployeesSubscription).toHaveBeenCalledTimes(1)
  })

  it('does not watch later job-id changes because workspace sync owns job-change resubscription', async () => {
    const lifecycle = mountLifecycle({ jobId: null })

    lifecycle.jobId.value = 'job-1'
    await lifecycle.wrapper.vm.$nextTick()

    expect(lifecycle.subscribeRouteJob).toHaveBeenCalledTimes(1)
    expect(lifecycle.startWeeksRecordsSubscription).not.toHaveBeenCalled()
    expect(lifecycle.startEmployeesSubscription).toHaveBeenCalledTimes(1)
  })

  it('exposes subscribeJob as a direct route-job subscription wrapper', () => {
    const lifecycle = mountLifecycle()
    vi.clearAllMocks()

    lifecycle.lifecycle.subscribeJob()

    expect(lifecycle.subscribeRouteJob).toHaveBeenCalledTimes(1)
  })

  it('starts week records only when a job id exists', () => {
    const withJob = mountLifecycle({ jobId: 'job-1' })
    vi.clearAllMocks()

    withJob.lifecycle.subscribeWeeksForJob()

    expect(withJob.startWeeksRecordsSubscription).toHaveBeenCalledTimes(1)

    const withoutJob = mountLifecycle({ jobId: null })
    vi.clearAllMocks()

    withoutJob.lifecycle.subscribeWeeksForJob()

    expect(withoutJob.startWeeksRecordsSubscription).not.toHaveBeenCalled()
  })

  it('restarts card subscription for a selected week and marks cards loading', () => {
    const lifecycle = mountLifecycle({
      cardsLoading: false,
      selectedWeek: makeWeek({ id: 'week-1' }),
    })
    vi.clearAllMocks()

    lifecycle.lifecycle.subscribeCardsForWeek()

    expect(lifecycle.stopCardsRecordsSubscription).toHaveBeenCalledTimes(1)
    expect(lifecycle.cardsLoading.value).toBe(true)
    expect(lifecycle.startCardsRecordsSubscription).toHaveBeenCalledTimes(1)
  })

  it('clears cards and loading state when subscribing without a selected week', () => {
    const lifecycle = mountLifecycle({
      cards: [makeCard({ id: 'card-a' })],
      cardsLoading: true,
      selectedWeek: null,
    })
    vi.clearAllMocks()

    lifecycle.lifecycle.subscribeCardsForWeek()

    expect(lifecycle.stopCardsRecordsSubscription).toHaveBeenCalledTimes(1)
    expect(lifecycle.cards.value).toEqual([])
    expect(lifecycle.cardsLoading.value).toBe(false)
    expect(lifecycle.startCardsRecordsSubscription).not.toHaveBeenCalled()
  })

  it('disposes save queue, measurements, and all subscriptions on unmount', () => {
    const lifecycle = mountLifecycle()
    vi.clearAllMocks()
    lifecycle.calls.length = 0

    lifecycle.wrapper.unmount()

    expect(lifecycle.disposeSaveQueue).toHaveBeenCalledTimes(1)
    expect(lifecycle.disconnectCardMeasurements).toHaveBeenCalledTimes(1)
    expect(lifecycle.stopWeeksRecordsSubscription).toHaveBeenCalledTimes(1)
    expect(lifecycle.stopCardsRecordsSubscription).toHaveBeenCalledTimes(1)
    expect(lifecycle.stopEmployeesSubscription).toHaveBeenCalledTimes(1)
    expect(lifecycle.stopRouteJobSubscription).toHaveBeenCalledTimes(1)
    expect(lifecycle.calls).toEqual([
      'dispose-save-queue',
      'disconnect-measurements',
      'stop-weeks',
      'stop-cards',
      'stop-employees',
      'stop-route-job',
    ])
  })
})
