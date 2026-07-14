import { computed } from 'vue'
import {
  getJobTimecardEmptyCanvasMessage,
  getJobTimecardSaveStateLabel,
  getJobTimecardWeekStatusLabel,
} from '@/features/timecards/jobViewHelpers'
import {
  buildAccountsSummary,
  formatWeekRange,
} from '@/features/timecards/workbook'
import type { JobRecord, TimecardCardRecord, TimecardWeekRecord } from '@/types/domain'

interface ReadonlyRef<T> {
  readonly value: T
}

interface UseJobTimecardSummaryOptions {
  activeSaveCount: ReadonlyRef<number>
  canEditWeek: ReadonlyRef<boolean>
  cards: ReadonlyRef<readonly TimecardCardRecord[]>
  ensuringWeek: ReadonlyRef<boolean>
  job: ReadonlyRef<JobRecord | null>
  lastSavedAt: ReadonlyRef<number | null>
  pendingSaveCount: ReadonlyRef<number>
  saveError: ReadonlyRef<string>
  selectedWeek: ReadonlyRef<TimecardWeekRecord | null>
  selectedWeekEndDate: ReadonlyRef<string>
  selectedWeekStartDate: ReadonlyRef<string>
}

export function useJobTimecardSummary({
  activeSaveCount,
  canEditWeek,
  cards,
  ensuringWeek,
  job,
  lastSavedAt,
  pendingSaveCount,
  saveError,
  selectedWeek,
  selectedWeekEndDate,
  selectedWeekStartDate,
}: UseJobTimecardSummaryOptions) {
  const accountsSummary = computed(() => buildAccountsSummary([...cards.value]))
  const totalHours = computed(() => cards.value.reduce((sum, card) => sum + Number(card.totals.hoursTotal ?? 0), 0))
  const totalProduction = computed(() => (
    cards.value.reduce((sum, card) => sum + Number(card.totals.productionTotal ?? 0), 0)
  ))
  const weekStatusLabel = computed(() => getJobTimecardWeekStatusLabel({
    ensuringWeek: ensuringWeek.value,
    hasSelectedWeekEndDate: !!selectedWeekEndDate.value,
    hasSelectedWeek: !!selectedWeek.value,
    selectedWeekStatus: selectedWeek.value?.status,
  }))
  const weekRangeLabel = computed(() => (
    selectedWeekEndDate.value
      ? formatWeekRange(selectedWeekStartDate.value, selectedWeekEndDate.value)
      : 'Choose Week'
  ))
  const displayJobCode = computed(() => job.value?.code || selectedWeek.value?.jobCode || 'No Job #')
  const displayJobName = computed(() => job.value?.name || selectedWeek.value?.jobName || 'Select a Job')
  const linkedJobNumber = computed(() => {
    const explicitWeekJobCode = String(selectedWeek.value?.jobCode ?? '').trim()
    if (explicitWeekJobCode) return explicitWeekJobCode
    return String(job.value?.code ?? '').trim()
  })
  const saveStateLabel = computed(() => getJobTimecardSaveStateLabel({
    saveError: saveError.value,
    hasPendingSave: !!(activeSaveCount.value || pendingSaveCount.value),
    canEditWeek: canEditWeek.value,
    hasRecentSave: !!lastSavedAt.value,
  }))
  const emptyCanvasMessage = computed(() => getJobTimecardEmptyCanvasMessage({
    hasSelectedWeekEndDate: !!selectedWeekEndDate.value,
    hasSelectedWeek: !!selectedWeek.value,
    cardCount: cards.value.length,
    canEditWeek: canEditWeek.value,
  }))

  return {
    accountsSummary,
    displayJobCode,
    displayJobName,
    emptyCanvasMessage,
    linkedJobNumber,
    saveStateLabel,
    totalHours,
    totalProduction,
    weekRangeLabel,
    weekStatusLabel,
  }
}
