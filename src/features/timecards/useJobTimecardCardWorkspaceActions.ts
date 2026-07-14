import { recalculateCardTotals } from '@/features/timecards/workbook'
import type { TimecardCardRecord } from '@/types/domain'

interface Ref<T> {
  value: T
}

interface ReadonlyRef<T> {
  readonly value: T
}

interface UseJobTimecardCardWorkspaceActionsOptions {
  burdenValue: ReadonlyRef<number>
  canEditWeek: ReadonlyRef<boolean>
  clearCardMeasurements: () => void
  pruneCardMeasurements: (validIds: Set<string>) => void
  pruneSaveQueueToIds: (validIds: Set<string>) => void
  resetCardSelectionState: () => void
  resetMessages: () => void
  resetSaveQueueState: (options?: { clearQueued?: boolean; clearSavedAt?: boolean }) => void
  saveError: Ref<string>
  scheduleCardSave: (card: TimecardCardRecord) => void
  selectCard: (cardId: string) => void
  selectedWeekStartDate: ReadonlyRef<string>
  syncCardSelectionState: (cards: TimecardCardRecord[]) => void
}

export function useJobTimecardCardWorkspaceActions({
  burdenValue,
  canEditWeek,
  clearCardMeasurements,
  pruneCardMeasurements,
  pruneSaveQueueToIds,
  resetCardSelectionState,
  resetMessages,
  resetSaveQueueState,
  saveError,
  scheduleCardSave,
  selectCard,
  selectedWeekStartDate,
  syncCardSelectionState,
}: UseJobTimecardCardWorkspaceActionsOptions) {
  function resetCardWorkspaceState() {
    resetSaveQueueState({ clearQueued: true })
    resetCardSelectionState()
    clearCardMeasurements()
  }

  function resetPageAndSaveMessages() {
    resetMessages()
    saveError.value = ''
  }

  function syncCardUiState(nextCards: TimecardCardRecord[]) {
    const validIds = new Set(nextCards.map((card) => card.id))

    pruneSaveQueueToIds(validIds)
    syncCardSelectionState(nextCards)
    pruneCardMeasurements(validIds)
  }

  function isCardReadOnly(_cardId: string) {
    return !canEditWeek.value
  }

  function scrollCardIntoView(cardId: string) {
    window.requestAnimationFrame(() => {
      document.getElementById(`timecard-card-${cardId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function handleWorkbookChanged(card: TimecardCardRecord) {
    selectCard(card.id)
    recalculateCardTotals(card, selectedWeekStartDate.value, burdenValue.value)
    scheduleCardSave(card)
  }

  return {
    handleWorkbookChanged,
    isCardReadOnly,
    resetCardWorkspaceState,
    resetPageAndSaveMessages,
    scrollCardIntoView,
    syncCardUiState,
  }
}
