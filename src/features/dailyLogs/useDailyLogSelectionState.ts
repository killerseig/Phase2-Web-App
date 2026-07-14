import { computed } from 'vue'
import {
  buildDailyLogSiteInfo,
  canCreateDailyLogForDate,
  canEditDailyLog,
  getDailyLogCreateButtonLabel,
  getDailyLogsTitle,
  getVisibleDailyLogs,
  hasSubmittedDailyLogForDate,
} from '@/features/dailyLogs/viewHelpers'
import type { DailyLogPayload, DailyLogRecord, JobRecord } from '@/types/domain'

interface ReadonlyRef<T> {
  readonly value: T
}

interface UseDailyLogSelectionStateOptions {
  form: ReadonlyRef<DailyLogPayload>
  getAuthDisplayName: () => string
  getIsAdmin: () => boolean
  getTodayDateString: () => string
  currentUserId: ReadonlyRef<string | null>
  job: ReadonlyRef<JobRecord | null>
  logs: ReadonlyRef<DailyLogRecord[]>
  selectedDate: ReadonlyRef<string>
  selectedLogId: ReadonlyRef<string | null>
}

export function useDailyLogSelectionState({
  form,
  getAuthDisplayName,
  getIsAdmin,
  getTodayDateString,
  currentUserId,
  job,
  logs,
  selectedDate,
  selectedLogId,
}: UseDailyLogSelectionStateOptions) {
  const selectedDateIsToday = computed(() => selectedDate.value === getTodayDateString())
  const visibleLogs = computed(() => getVisibleDailyLogs(logs.value, {
    currentUserId: currentUserId.value,
    isAdmin: getIsAdmin(),
  }))
  const selectedLog = computed(() => visibleLogs.value.find((log) => log.id === selectedLogId.value) ?? null)
  const dailyLogsTitle = computed(() => getDailyLogsTitle(job.value))
  const canEditSelectedLog = computed(() => canEditDailyLog(selectedLog.value, {
    currentUserId: currentUserId.value,
    todayDate: getTodayDateString(),
  }))
  const hasSubmittedLogForToday = computed(() => hasSubmittedDailyLogForDate(
    visibleLogs.value,
    selectedDate.value,
    getTodayDateString(),
  ))
  const canCreateDailyLogForToday = computed(() => canCreateDailyLogForDate({
    selectedDate: selectedDate.value,
    todayDate: getTodayDateString(),
    currentUserId: currentUserId.value,
    visibleLogs: visibleLogs.value,
  }))
  const createDailyLogButtonLabel = computed(() => getDailyLogCreateButtonLabel(hasSubmittedLogForToday.value))
  const siteInfo = computed(() => buildDailyLogSiteInfo({
    authDisplayName: getAuthDisplayName(),
    job: job.value,
    payload: form.value,
    selectedLog: selectedLog.value,
  }))

  return {
    canCreateDailyLogForToday,
    canEditSelectedLog,
    createDailyLogButtonLabel,
    dailyLogsTitle,
    hasSubmittedLogForToday,
    selectedDateIsToday,
    selectedLog,
    siteInfo,
    visibleLogs,
  }
}
