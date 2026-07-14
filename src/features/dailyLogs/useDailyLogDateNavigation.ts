import { watch } from 'vue'
import type { DailyLogRecord } from '@/types/domain'

interface Ref<T> {
  value: T
}

interface ReadonlyRef<T> {
  readonly value: T
}

interface UseDailyLogDateNavigationOptions {
  getTodayDateString: () => string
  jobId: ReadonlyRef<string | null>
  logs: Ref<DailyLogRecord[]>
  resetForm: () => void
  selectedDate: Ref<string>
  selectedLogId: Ref<string | null>
  stopLogsSubscription: () => void
  subscribeLogsForSelectedDate: () => void
  subscribeRouteJob: () => void
}

export function useDailyLogDateNavigation({
  getTodayDateString,
  jobId,
  logs,
  resetForm,
  selectedDate,
  selectedLogId,
  stopLogsSubscription,
  subscribeLogsForSelectedDate,
  subscribeRouteJob,
}: UseDailyLogDateNavigationOptions) {
  function resetLogSelectionForDate() {
    selectedLogId.value = null
    logs.value = []
    resetForm()
    void subscribeLogsForSelectedDate()
  }

  function setSelectedDateToToday() {
    selectedDate.value = getTodayDateString()
  }

  watch(
    () => jobId.value,
    (nextJobId, previousJobId) => {
      if (!nextJobId || nextJobId === previousJobId) return
      stopLogsSubscription()
      subscribeRouteJob()
      selectedDate.value = getTodayDateString()
      resetLogSelectionForDate()
    },
  )

  watch(
    () => selectedDate.value,
    (nextDate, previousDate) => {
      if (nextDate === previousDate) return
      resetLogSelectionForDate()
    },
  )

  return {
    setSelectedDateToToday,
  }
}
