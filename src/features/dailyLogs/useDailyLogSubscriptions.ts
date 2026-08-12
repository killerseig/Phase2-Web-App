import { useSubscribedRecords } from '@/composables/useSubscribedRecords'
import { useSubscribedValue } from '@/composables/useSubscribedValue'
import {
  getNextDailyLogSelectionId,
} from '@/features/dailyLogs/viewHelpers'
import { subscribeDailyLogsForDate } from '@/services/dailyLogs'
import { subscribeGlobalNotificationRecipients } from '@/services/jobs'
import type {
  DailyLogRecord,
  NotificationRecipients,
} from '@/types/domain'
import type { ReadonlyRef, WritableRef } from '@/types/reactivity'
import { normalizeError } from '@/utils/normalizeError'

interface UseDailyLogSubscriptionsOptions {
  currentUserId: ReadonlyRef<string | null>
  getCanViewAllDailyLogs: () => boolean
  jobId: ReadonlyRef<string | null>
  selectedDate: ReadonlyRef<string>
  selectedLogId: WritableRef<string | null>
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
  getCanViewAllDailyLogs,
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
      selectedLogId.value = getNextDailyLogSelectionId(nextLogs, {
        canViewAllDailyLogs: getCanViewAllDailyLogs(),
        currentSelectedLogId: selectedLogId.value,
        currentUserId: currentUserId.value,
      })
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
