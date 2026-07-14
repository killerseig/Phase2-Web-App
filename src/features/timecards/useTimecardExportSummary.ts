import { computed } from 'vue'
import {
  buildTimecardExportCsvFilename,
  buildTimecardExportPdfSubtitle,
  buildTimecardExportStatusSignals,
  formatTimecardExportForemenLabel,
  formatTimecardExportJobsLabel,
  formatTimecardExportPackageCountLabel,
  formatTimecardExportVisibleWeekHeading,
  formatTimecardExportWeekStatusLabel,
  getTimecardExportCompactSaveStateLabel,
  getTimecardExportEmptyCanvasMessage,
  getTimecardExportSaveStateLabel,
  type TimecardExportArchiveCardRecord,
} from '@/features/timecards/exportViewHelpers'
import { buildAccountsSummary } from '@/features/timecards/workbook'
import type { TimecardWeekRecord } from '@/types/domain'

interface ReadonlyRef<T> {
  readonly value: T
}

interface TimecardExportWeekFilterBounds {
  startDate: string
  endDate: string
}

interface UseTimecardExportSummaryOptions {
  activeSaveCount: ReadonlyRef<number>
  activeWeekFilterBounds: ReadonlyRef<TimecardExportWeekFilterBounds>
  cards: ReadonlyRef<readonly TimecardExportArchiveCardRecord[]>
  cardsLoading: ReadonlyRef<boolean>
  currentWeekEndDate: string
  filteredCards: ReadonlyRef<readonly TimecardExportArchiveCardRecord[]>
  filteredWeeks: ReadonlyRef<readonly TimecardWeekRecord[]>
  lastSavedAt: ReadonlyRef<number | null>
  orderedCards: ReadonlyRef<readonly TimecardExportArchiveCardRecord[]>
  pendingSaveCount: ReadonlyRef<number>
  saveError: ReadonlyRef<string>
}

export function useTimecardExportSummary({
  activeSaveCount,
  activeWeekFilterBounds,
  cards,
  cardsLoading,
  currentWeekEndDate,
  filteredCards,
  filteredWeeks,
  lastSavedAt,
  orderedCards,
  pendingSaveCount,
  saveError,
}: UseTimecardExportSummaryOptions) {
  const accountsSummary = computed(() => buildAccountsSummary([...cards.value]))
  const totalHours = computed(() => cards.value.reduce((sum, card) => sum + Number(card.totals.hoursTotal ?? 0), 0))
  const totalProduction = computed(() => (
    cards.value.reduce((sum, card) => sum + Number(card.totals.productionTotal ?? 0), 0)
  ))
  const visibleWeekHeading = computed(() => (
    formatTimecardExportVisibleWeekHeading(activeWeekFilterBounds.value, currentWeekEndDate)
  ))
  const matchingPackageCountLabel = computed(() => formatTimecardExportPackageCountLabel(filteredWeeks.value))
  const matchingJobsLabel = computed(() => formatTimecardExportJobsLabel(filteredWeeks.value))
  const matchingForemenLabel = computed(() => formatTimecardExportForemenLabel(filteredWeeks.value))
  const weekStatusLabel = computed(() => formatTimecardExportWeekStatusLabel(filteredWeeks.value))
  const saveStateLabel = computed(() => getTimecardExportSaveStateLabel({
    saveError: saveError.value,
    hasPendingSave: !!(activeSaveCount.value || pendingSaveCount.value),
    isLoading: cardsLoading.value,
    hasFilteredWeeks: !!filteredWeeks.value.length,
    hasRecentSave: !!lastSavedAt.value,
  }))
  const compactWeekStatusLabel = computed(() => formatTimecardExportWeekStatusLabel(filteredWeeks.value, 'None'))
  const compactSaveStateLabel = computed(() => getTimecardExportCompactSaveStateLabel({
    saveError: saveError.value,
    hasPendingSave: !!(activeSaveCount.value || pendingSaveCount.value),
    isLoading: cardsLoading.value,
    hasFilteredWeeks: !!filteredWeeks.value.length,
    hasRecentSave: !!lastSavedAt.value,
  }))
  const statusSignals = computed(() => buildTimecardExportStatusSignals({
    compactWeekStatusLabel: compactWeekStatusLabel.value,
    weekStatusLabel: weekStatusLabel.value,
    compactSaveStateLabel: compactSaveStateLabel.value,
    hasSaveError: !!saveError.value,
    weekCount: filteredWeeks.value.length,
    cardCount: orderedCards.value.length,
  }))
  const emptyCanvasMessage = computed(() => getTimecardExportEmptyCanvasMessage({
    filteredWeekCount: filteredWeeks.value.length,
    cardCount: cards.value.length,
    filteredCardCount: filteredCards.value.length,
  }))

  function buildPdfExportSubtitle() {
    return buildTimecardExportPdfSubtitle([
      visibleWeekHeading.value,
      matchingPackageCountLabel.value,
      `${orderedCards.value.length} cards`,
    ])
  }

  function buildCsvExportFilename() {
    return buildTimecardExportCsvFilename(activeWeekFilterBounds.value, currentWeekEndDate)
  }

  return {
    accountsSummary,
    buildCsvExportFilename,
    buildPdfExportSubtitle,
    emptyCanvasMessage,
    matchingForemenLabel,
    matchingJobsLabel,
    matchingPackageCountLabel,
    saveStateLabel,
    statusSignals,
    totalHours,
    totalProduction,
    visibleWeekHeading,
    weekStatusLabel,
  }
}
