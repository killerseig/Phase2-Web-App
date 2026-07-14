import { useSubscribedRecords } from '@/composables/useSubscribedRecords'
import { useSubscribedValue } from '@/composables/useSubscribedValue'
import {
  getPreferredDailyLog,
  getVisibleDailyLogs,
} from '@/features/dailyLogs/viewHelpers'
import { subscribeDailyLogsForDate } from '@/services/dailyLogs'
import { subscribeGlobalNotificationRecipients } from '@/services/jobs'
import type {
  DailyLogRecord,
  NotificationRecipients,
} from '@/types/domain'
import { normalizeError } from '@/utils/normalizeError'

interface Ref<T> {
  value: T
}

interface ReadonlyRef<T> {
  readonly value: T
}

interface UseDailyLogSubscriptionsOptions {
  currentUserId: ReadonlyRef<string | null>
  getIsAdmin: () => boolean
  jobId: ReadonlyRef<string | null>
  selectedDate: ReadonlyRef<string>
  selectedLogId: Ref<string | null>
  setActionError: (message: string) => void
  setActionInfo: (message: string) => void
}

const emptyNotificationRecipients: NotificationRecipients = {
  dailyLogs: [],
  timecards: [],
  shopOrders: [],
}

export function useDailyLogSubscriptions({
  currentUserId,
  getIsAdmin,
  jobId,
  selectedDate,
  selectedLogId,
  setActionError,
  setActionInfo,
}: UseDailyLogSubscriptionsOptions) {
  const {
    start: startGlobalNotificationRecipientsSubscription,
    stop: stopGlobalNotificationRecipientsSubscription,
    value: globalNotificationRecipients,
  } = useSubscribedValue<NotificationRecipients>(
    subscribeGlobalNotificationRecipients,
    emptyNotificationRecipients,
    {
      errorMessage: 'Failed to load daily log recipient defaults.',
      onError: (error) => {
        setActionError(normalizeError(error, 'Failed to load daily log recipient defaults.'))
        setActionInfo('')
      },
    },
  )

  function subscribeCurrentDateDailyLogs(
    onUpdate: (records: DailyLogRecord[]) => void,
    onError?: (error: unknown) => void,
  ) {
    if (!jobId.value) return () => {}
    return subscribeDailyLogsForDate(jobId.value, selectedDate.value, onUpdate, onError)
  }

  const {
    error: logsError,
    loading: logsLoading,
    records: logs,
    start: startLogsSubscription,
    stop: stopLogsSubscription,
  } = useSubscribedRecords<DailyLogRecord>(subscribeCurrentDateDailyLogs, {
    errorMessage: 'Failed to load daily logs.',
    onUpdate: (nextLogs) => {
      const nextVisibleLogs = getVisibleDailyLogs(nextLogs, {
        currentUserId: currentUserId.value,
        isAdmin: getIsAdmin(),
      })

      const selectedStillExists = selectedLogId.value
        ? nextVisibleLogs.some((log) => log.id === selectedLogId.value)
        : false

      if (!selectedStillExists) {
        selectedLogId.value = getPreferredDailyLog(nextVisibleLogs, currentUserId.value)?.id ?? null
      }
    },
  })

  function startRecipientDefaultsSubscription() {
    startGlobalNotificationRecipientsSubscription()
  }

  function stopRecipientDefaultsSubscription() {
    stopGlobalNotificationRecipientsSubscription()
  }

  function subscribeLogsForSelectedDate() {
    if (!jobId.value) return
    startLogsSubscription()
  }

  return {
    globalNotificationRecipients,
    logs,
    logsError,
    logsLoading,
    startRecipientDefaultsSubscription,
    stopLogsSubscription,
    stopRecipientDefaultsSubscription,
    subscribeLogsForSelectedDate,
  }
}
