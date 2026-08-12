import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createEmptyDailyLogPayload } from '@/features/dailyLogs/schema'
import { useDailyLogSubscriptions } from '@/features/dailyLogs/useDailyLogSubscriptions'
import { subscribeDailyLogsForDate } from '@/services/dailyLogs'
import { subscribeGlobalNotificationRecipients } from '@/services/jobs'
import type {
  DailyLogRecord,
  NotificationRecipients,
} from '@/types/domain'

vi.mock('@/services/dailyLogs', () => ({
  subscribeDailyLogsForDate: vi.fn(),
}))

vi.mock('@/services/jobs', () => ({
  subscribeGlobalNotificationRecipients: vi.fn(),
}))

const subscribeDailyLogsForDateMock = vi.mocked(subscribeDailyLogsForDate)
const subscribeGlobalNotificationRecipientsMock = vi.mocked(subscribeGlobalNotificationRecipients)

function makeNotificationRecipients(overrides: Partial<NotificationRecipients> = {}): NotificationRecipients {
  return {
    dailyLogs: [],
    shopOrders: [],
    timecards: [],
    ...overrides,
  }
}

function makeLog(overrides: Partial<DailyLogRecord> = {}): DailyLogRecord {
  return {
    id: 'daily-log-1',
    additionalRecipients: [],
    foremanName: 'Vince Hintz',
    foremanUserId: 'user-1',
    jobCode: '5229',
    jobId: 'job-1',
    jobName: 'Lucky 3 Ranch',
    logDate: '2026-07-15',
    payload: createEmptyDailyLogPayload(),
    sequenceNumber: 1,
    status: 'draft',
    ...overrides,
  }
}

function mountSubscriptions(options: {
  canViewAllDailyLogs?: boolean
  currentUserId?: string | null
  jobId?: string | null
  selectedDate?: string
  selectedLogId?: string | null
} = {}) {
  const canViewAllDailyLogs = ref(options.canViewAllDailyLogs ?? false)
  const currentUserId = ref<string | null>(
    options.currentUserId === undefined ? 'user-1' : options.currentUserId,
  )
  const jobId = ref<string | null>(options.jobId === undefined ? 'job-1' : options.jobId)
  const selectedDate = ref(options.selectedDate ?? '2026-07-15')
  const selectedLogId = ref<string | null>(options.selectedLogId ?? null)
  const actionErrors: string[] = []
  const actionInfos: string[] = []

  const subscriptions = useDailyLogSubscriptions({
    currentUserId: computed(() => currentUserId.value),
    getCanViewAllDailyLogs: () => canViewAllDailyLogs.value,
    jobId: computed(() => jobId.value),
    selectedDate: computed(() => selectedDate.value),
    selectedLogId,
    setActionError: (message) => {
      actionErrors.push(message)
    },
    setActionInfo: (message) => {
      actionInfos.push(message)
    },
  })

  return {
    actionErrors,
    actionInfos,
    canViewAllDailyLogs,
    currentUserId,
    jobId,
    selectedDate,
    selectedLogId,
    subscriptions,
  }
}

describe('useDailyLogSubscriptions', () => {
  beforeEach(() => {
    subscribeDailyLogsForDateMock.mockReset()
    subscribeGlobalNotificationRecipientsMock.mockReset()
    subscribeDailyLogsForDateMock.mockReturnValue(vi.fn())
    subscribeGlobalNotificationRecipientsMock.mockReturnValue(vi.fn())
  })

  it('starts and stops the global recipient defaults subscription', () => {
    const unsubscribe = vi.fn()
    subscribeGlobalNotificationRecipientsMock.mockReturnValueOnce(unsubscribe)
    const { subscriptions } = mountSubscriptions()

    expect(subscriptions.globalNotificationRecipients.value).toEqual(makeNotificationRecipients())

    subscriptions.startRecipientDefaultsSubscription()

    expect(subscribeGlobalNotificationRecipientsMock).toHaveBeenCalledTimes(1)

    const [onUpdate] = subscribeGlobalNotificationRecipientsMock.mock.calls[0]!
    onUpdate(makeNotificationRecipients({
      dailyLogs: ['daily@example.com'],
      shopOrders: ['shop@example.com'],
    }))

    expect(subscriptions.globalNotificationRecipients.value).toEqual({
      dailyLogs: ['daily@example.com'],
      shopOrders: ['shop@example.com'],
      timecards: [],
    })

    subscriptions.stopRecipientDefaultsSubscription()

    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('reports recipient default subscription errors through the Daily Log page messages', () => {
    const { actionErrors, actionInfos, subscriptions } = mountSubscriptions()
    subscriptions.startRecipientDefaultsSubscription()

    const [, onError] = subscribeGlobalNotificationRecipientsMock.mock.calls[0]!
    onError?.(new Error('Settings denied'))

    expect(actionErrors).toContain('Settings denied')
    expect(actionInfos).toContain('')
  })

  it('does not subscribe to logs until a job id exists', () => {
    const { subscriptions } = mountSubscriptions({ jobId: null })

    subscriptions.subscribeLogsForSelectedDate()

    expect(subscribeDailyLogsForDateMock).not.toHaveBeenCalled()
    expect(subscriptions.logs.value).toEqual([])
  })

  it('subscribes to the selected job/date and selects the current user draft when selection is missing', () => {
    const unsubscribe = vi.fn()
    subscribeDailyLogsForDateMock.mockReturnValueOnce(unsubscribe)
    const { selectedLogId, subscriptions } = mountSubscriptions()
    const submittedByOther = makeLog({
      id: 'submitted-other',
      foremanUserId: 'user-2',
      status: 'submitted',
    })
    const ownDraft = makeLog({
      id: 'own-draft',
      foremanUserId: 'user-1',
      status: 'draft',
    })
    const hiddenDraft = makeLog({
      id: 'hidden-draft',
      foremanUserId: 'user-2',
      status: 'draft',
    })

    subscriptions.subscribeLogsForSelectedDate()

    expect(subscribeDailyLogsForDateMock).toHaveBeenCalledWith(
      'job-1',
      '2026-07-15',
      expect.any(Function),
      expect.any(Function),
    )

    const [, , onUpdate] = subscribeDailyLogsForDateMock.mock.calls[0]!
    onUpdate([submittedByOther, ownDraft, hiddenDraft])

    expect(subscriptions.logs.value).toEqual([submittedByOther, ownDraft, hiddenDraft])
    expect(selectedLogId.value).toBe('own-draft')

    subscriptions.stopLogsSubscription()

    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('preserves an existing visible selection and falls back to submitted logs when the draft disappears', () => {
    const { selectedLogId, subscriptions } = mountSubscriptions({
      selectedLogId: 'submitted-other',
    })
    const submittedByOther = makeLog({
      id: 'submitted-other',
      foremanUserId: 'user-2',
      status: 'submitted',
    })
    const ownDraft = makeLog({
      id: 'own-draft',
      foremanUserId: 'user-1',
      status: 'draft',
    })

    subscriptions.subscribeLogsForSelectedDate()

    const [, , onUpdate] = subscribeDailyLogsForDateMock.mock.calls[0]!
    onUpdate([submittedByOther, ownDraft])
    expect(selectedLogId.value).toBe('submitted-other')

    selectedLogId.value = 'own-draft'
    onUpdate([submittedByOther])

    expect(selectedLogId.value).toBe('submitted-other')
  })

  it('allows all-log viewers to keep selections that foremen cannot see', () => {
    const { selectedLogId, subscriptions } = mountSubscriptions({
      canViewAllDailyLogs: true,
      selectedLogId: 'other-draft',
    })
    const otherDraft = makeLog({
      id: 'other-draft',
      foremanUserId: 'user-2',
      status: 'draft',
    })

    subscriptions.subscribeLogsForSelectedDate()

    const [, , onUpdate] = subscribeDailyLogsForDateMock.mock.calls[0]!
    onUpdate([otherDraft])

    expect(selectedLogId.value).toBe('other-draft')
  })

  it('clears selected log when no visible logs remain and exposes log subscription errors', () => {
    const { selectedLogId, subscriptions } = mountSubscriptions({
      selectedLogId: 'missing-log',
    })

    subscriptions.subscribeLogsForSelectedDate()

    const [, , onUpdate, onError] = subscribeDailyLogsForDateMock.mock.calls[0]!
    onUpdate([])
    expect(selectedLogId.value).toBeNull()

    onError?.(new Error('Daily log query denied'))
    expect(subscriptions.logsError.value).toBe('Daily log query denied')
    expect(subscriptions.logsLoading.value).toBe(false)
  })
})
