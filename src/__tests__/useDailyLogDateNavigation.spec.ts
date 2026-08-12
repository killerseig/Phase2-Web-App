import { effectScope, nextTick, ref, type EffectScope } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useDailyLogDateNavigation } from '@/features/dailyLogs/useDailyLogDateNavigation'
import { createEmptyDailyLogPayload } from '@/features/dailyLogs/schema'
import type { DailyLogRecord } from '@/types/domain'

function makeLog(overrides: Partial<DailyLogRecord> = {}): DailyLogRecord {
  return {
    id: 'daily-log-1',
    jobId: 'job-1',
    jobCode: '5229',
    jobName: 'Lucky 3 Ranch',
    logDate: '2026-07-15',
    sequenceNumber: 1,
    status: 'draft',
    foremanUserId: 'user-1',
    foremanName: 'Vince Hintz',
    additionalRecipients: [],
    payload: createEmptyDailyLogPayload(),
    ...overrides,
  }
}

let activeScope: EffectScope | null = null

function mountDateNavigation(options: {
  jobId?: string | null
  logs?: DailyLogRecord[]
  selectedDate?: string
  selectedLogId?: string | null
  todayDate?: string
} = {}) {
  activeScope?.stop()
  activeScope = effectScope()

  const jobId = ref<string | null>(options.jobId === undefined ? 'job-1' : options.jobId)
  const logs = ref<DailyLogRecord[]>(options.logs ?? [makeLog()])
  const selectedDate = ref(options.selectedDate ?? '2026-07-15')
  const selectedLogId = ref<string | null>(
    options.selectedLogId === undefined ? 'daily-log-1' : options.selectedLogId,
  )
  const resetForm = vi.fn()
  const stopLogsSubscription = vi.fn()
  const subscribeLogsForSelectedDate = vi.fn()
  const subscribeRouteJob = vi.fn()

  let navigation!: ReturnType<typeof useDailyLogDateNavigation>
  activeScope.run(() => {
    navigation = useDailyLogDateNavigation({
      getTodayDateString: () => options.todayDate ?? '2026-07-15',
      jobId,
      logs,
      resetForm,
      selectedDate,
      selectedLogId,
      stopLogsSubscription,
      subscribeLogsForSelectedDate,
      subscribeRouteJob,
    })
  })

  return {
    jobId,
    logs,
    navigation,
    resetForm,
    selectedDate,
    selectedLogId,
    stopLogsSubscription,
    subscribeLogsForSelectedDate,
    subscribeRouteJob,
  }
}

afterEach(() => {
  activeScope?.stop()
  activeScope = null
})

describe('useDailyLogDateNavigation', () => {
  it('resets selected log, loaded logs, form state, and log subscription when the date changes', async () => {
    const {
      logs,
      resetForm,
      selectedDate,
      selectedLogId,
      stopLogsSubscription,
      subscribeLogsForSelectedDate,
      subscribeRouteJob,
    } = mountDateNavigation()

    selectedDate.value = '2026-07-14'
    await nextTick()

    expect(selectedLogId.value).toBeNull()
    expect(logs.value).toEqual([])
    expect(resetForm).toHaveBeenCalledTimes(1)
    expect(subscribeLogsForSelectedDate).toHaveBeenCalledTimes(1)
    expect(stopLogsSubscription).not.toHaveBeenCalled()
    expect(subscribeRouteJob).not.toHaveBeenCalled()
  })

  it('resets to today and resubscribes exactly once when the job changes', async () => {
    const {
      jobId,
      resetForm,
      selectedDate,
      selectedLogId,
      stopLogsSubscription,
      subscribeLogsForSelectedDate,
      subscribeRouteJob,
    } = mountDateNavigation({
      selectedDate: '2026-07-14',
      todayDate: '2026-07-15',
    })

    jobId.value = 'job-2'
    await nextTick()

    expect(selectedDate.value).toBe('2026-07-15')
    expect(selectedLogId.value).toBeNull()
    expect(stopLogsSubscription).toHaveBeenCalledTimes(1)
    expect(subscribeRouteJob).toHaveBeenCalledTimes(1)
    expect(resetForm).toHaveBeenCalledTimes(1)
    expect(subscribeLogsForSelectedDate).toHaveBeenCalledTimes(1)
  })

  it('ignores empty or unchanged job ids', async () => {
    const {
      jobId,
      resetForm,
      stopLogsSubscription,
      subscribeLogsForSelectedDate,
      subscribeRouteJob,
    } = mountDateNavigation()

    jobId.value = 'job-1'
    await nextTick()

    jobId.value = null
    await nextTick()

    expect(stopLogsSubscription).not.toHaveBeenCalled()
    expect(subscribeRouteJob).not.toHaveBeenCalled()
    expect(resetForm).not.toHaveBeenCalled()
    expect(subscribeLogsForSelectedDate).not.toHaveBeenCalled()
  })

  it('selects today through the exposed action without resetting if already on today', async () => {
    const {
      navigation,
      resetForm,
      selectedDate,
      subscribeLogsForSelectedDate,
    } = mountDateNavigation({
      selectedDate: '2026-07-14',
      todayDate: '2026-07-15',
    })

    navigation.setSelectedDateToToday()
    await nextTick()

    expect(selectedDate.value).toBe('2026-07-15')
    expect(resetForm).toHaveBeenCalledTimes(1)
    expect(subscribeLogsForSelectedDate).toHaveBeenCalledTimes(1)

    vi.clearAllMocks()

    navigation.setSelectedDateToToday()
    await nextTick()

    expect(resetForm).not.toHaveBeenCalled()
    expect(subscribeLogsForSelectedDate).not.toHaveBeenCalled()
  })
})
