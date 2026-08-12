import { computed } from 'vue'
import {
  buildDailyLogSiteInfo,
  canCreateDailyLogForDate,
  canDeleteDailyLogDraft,
  canEditDailyLog,
  getDailyLogCreateButtonLabel,
  getDailyLogsTitle,
  getVisibleDailyLogs,
  hasSubmittedDailyLogForDate,
} from '@/features/dailyLogs/viewHelpers'
import type { DailyLogPayload, DailyLogRecord, JobRecord } from '@/types/domain'
import type { ReadonlyRef } from '@/types/reactivity'

interface UseDailyLogSelectionStateOptions {
  form: ReadonlyRef<DailyLogPayload>
  getAuthDisplayName: () => string
  getCanViewAllDailyLogs: () => boolean
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
  getCanViewAllDailyLogs,
  getTodayDateString,
  currentUserId,
  job,
  logs,
  selectedDate,
  selectedLogId,
}: UseDailyLogSelectionStateOptions) {
  const selectedDateIsToday = computed(() => selectedDate.value === getTodayDateString())
  const selectedDateIsFuture = computed(() => selectedDate.value > getTodayDateString())
  const visibleLogs = computed(() => getVisibleDailyLogs(logs.value, {
    currentUserId: currentUserId.value,
    canViewAllDailyLogs: getCanViewAllDailyLogs(),
  }))
  const selectedLog = computed(() => visibleLogs.value.find((log) => log.id === selectedLogId.value) ?? null)
  const dailyLogsTitle = computed(() => getDailyLogsTitle(job.value))
  const canEditSelectedLog = computed(() => canEditDailyLog(selectedLog.value, {
    currentUserId: currentUserId.value,
    todayDate: getTodayDateString(),
  }))
  const canDeleteSelectedLog = computed(() => canDeleteDailyLogDraft(selectedLog.value, {
    currentUserId: currentUserId.value,
    todayDate: getTodayDateString(),
    canViewAllDailyLogs: getCanViewAllDailyLogs(),
  }))
  const hasSubmittedLogForToday = computed(() => hasSubmittedDailyLogForDate(
    visibleLogs.value,
    selectedDate.value,
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
    canDeleteSelectedLog,
    canEditSelectedLog,
    createDailyLogButtonLabel,
    dailyLogsTitle,
    hasSubmittedLogForToday,
    selectedDateIsFuture,
    selectedDateIsToday,
    selectedLog,
    siteInfo,
    visibleLogs,
  }
}
