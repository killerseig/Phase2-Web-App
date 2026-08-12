import { watch } from 'vue'
import type { DailyLogRecord } from '@/types/domain'
import type { ReadonlyRef, WritableRef } from '@/types/reactivity'

interface UseDailyLogDateNavigationOptions {
  getTodayDateString: () => string
  jobId: ReadonlyRef<string | null>
  logs: WritableRef<DailyLogRecord[]>
  resetForm: () => void
  selectedDate: WritableRef<string>
  selectedLogId: WritableRef<string | null>
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
  let dateResetByJobChange: string | null = null

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
      const todayDate = getTodayDateString()
      dateResetByJobChange = selectedDate.value === todayDate ? null : todayDate
      selectedDate.value = todayDate
      resetLogSelectionForDate()
    },
  )

  watch(
    () => selectedDate.value,
    (nextDate, previousDate) => {
      if (nextDate === previousDate) return
      if (dateResetByJobChange === nextDate) {
        dateResetByJobChange = null
        return
      }
      resetLogSelectionForDate()
    },
  )

  return {
    setSelectedDateToToday,
  }
}
