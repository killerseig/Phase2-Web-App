import {
  sortTimecardExportCardsForMode,
  type TimecardExportArchiveCardRecord,
  type TimecardExportSortMode,
} from '@/features/timecards/exportViewHelpers'
import { recalculateCardTotals } from '@/features/timecards/workbook'
import type { ReadonlyRef, WritableRef } from '@/types/reactivity'

interface UseTimecardExportCardWorkspaceActionsOptions {
  clearCardMeasurements: () => void
  collator: Intl.Collator
  pruneCardEditStates: (validIds: Set<string>) => void
  pruneCardMeasurements: (validIds: Set<string>) => void
  pruneSaveQueueToIds: (validIds: Set<string>) => void
  resetCardEditStates: () => void
  resetCardSelectionState: () => void
  resetMessages: () => void
  resetSaveQueueState: () => void
  saveError: WritableRef<string>
  scheduleCardSave: (card: TimecardExportArchiveCardRecord) => void
  selectCard: (cardId: string) => void
  sortMode: ReadonlyRef<TimecardExportSortMode>
  syncCardSelectionState: (
    cards: TimecardExportArchiveCardRecord[],
    sortedCards?: TimecardExportArchiveCardRecord[],
  ) => void
}

export function useTimecardExportCardWorkspaceActions({
  clearCardMeasurements,
  collator,
  pruneCardEditStates,
  pruneCardMeasurements,
  pruneSaveQueueToIds,
  resetCardEditStates,
  resetCardSelectionState,
  resetMessages,
  resetSaveQueueState,
  saveError,
  scheduleCardSave,
  selectCard,
  sortMode,
  syncCardSelectionState,
}: UseTimecardExportCardWorkspaceActionsOptions) {
  function resetCardWorkspaceState() {
    resetSaveQueueState()
    resetCardSelectionState()
    resetCardEditStates()
    clearCardMeasurements()
  }

  function resetPageAndSaveMessages() {
    resetMessages()
    saveError.value = ''
  }

  function syncCardUiState(nextCards: TimecardExportArchiveCardRecord[]) {
    const validIds = new Set(nextCards.map((card) => card.id))
    const sortedCards = sortTimecardExportCardsForMode(nextCards, sortMode.value, collator)

    pruneSaveQueueToIds(validIds)
    pruneCardEditStates(validIds)
    syncCardSelectionState(nextCards, sortedCards)

    pruneCardMeasurements(validIds)
  }

  function handleWorkbookChanged(card: TimecardExportArchiveCardRecord) {
    selectCard(card.id)
    recalculateCardTotals(card, card.archiveWeekStartDate, card.archiveBurden)
    scheduleCardSave(card)
  }

  function scrollCardIntoView(cardId: string) {
    window.requestAnimationFrame(() => {
      document.getElementById(`timecard-export-card-${cardId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  return {
    handleWorkbookChanged,
    resetCardWorkspaceState,
    resetPageAndSaveMessages,
    scrollCardIntoView,
    syncCardUiState,
  }
}
