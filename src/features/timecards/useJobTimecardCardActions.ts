import {
  sortJobTimecardCardsForMode,
  type JobTimecardConfirmAction,
  type JobTimecardSortMode,
} from '@/features/timecards/jobViewHelpers'
import { buildCardDisplayName } from '@/features/timecards/workbook'
import { deleteTimecardCard, submitTimecardWeek, updateTimecardCard } from '@/services/timecards'
import type { TimecardCardRecord, TimecardWeekRecord } from '@/types/domain'

interface Ref<T> {
  value: T
}

interface ReadonlyRef<T> {
  readonly value: T
}

interface UseJobTimecardCardActionsOptions {
  actionLoading: Ref<boolean>
  burdenValue: ReadonlyRef<number>
  canEditWeek: ReadonlyRef<boolean>
  cards: ReadonlyRef<TimecardCardRecord[]>
  closeTimecardConfirm: () => void
  flushPendingSaves: () => Promise<void>
  getSubmitActor: () => { userId: string | null; displayName: string | null }
  resetPageAndSaveMessages: () => void
  selectCard: (cardId: string) => void
  selectedWeek: ReadonlyRef<TimecardWeekRecord | null>
  selectedWeekEndDate: ReadonlyRef<string>
  selectedWeekStartDate: ReadonlyRef<string>
  setPageError: (error: unknown, fallback: string) => void
  setPageInfo: (message: string) => void
  sortMode: ReadonlyRef<JobTimecardSortMode>
  timecardConfirmAction: Ref<JobTimecardConfirmAction | null>
}

export function useJobTimecardCardActions({
  actionLoading,
  burdenValue,
  canEditWeek,
  cards,
  closeTimecardConfirm,
  flushPendingSaves,
  getSubmitActor,
  resetPageAndSaveMessages,
  selectCard,
  selectedWeek,
  selectedWeekEndDate,
  selectedWeekStartDate,
  setPageError,
  setPageInfo,
  sortMode,
  timecardConfirmAction,
}: UseJobTimecardCardActionsOptions) {
  function handleRemoveCard(card: TimecardCardRecord) {
    if (!selectedWeek.value || !canEditWeek.value) return

    timecardConfirmAction.value = {
      kind: 'remove-card',
      cardId: card.id,
      cardLabel: buildCardDisplayName(card),
      weekId: selectedWeek.value.id,
    }
  }

  async function confirmRemoveCard(action: Extract<JobTimecardConfirmAction, { kind: 'remove-card' }>) {
    actionLoading.value = true
    resetPageAndSaveMessages()
    try {
      selectCard(action.cardId)
      await flushPendingSaves()
      await deleteTimecardCard(action.weekId, action.cardId)
      setPageInfo('Removed the timecard.')
    } catch (error) {
      setPageError(error, 'Failed to remove the timecard.')
    } finally {
      actionLoading.value = false
      closeTimecardConfirm()
    }
  }

  async function handleSortCards() {
    if (!selectedWeek.value || !canEditWeek.value || cards.value.length < 2) return

    actionLoading.value = true
    resetPageAndSaveMessages()
    try {
      await flushPendingSaves()
      const sortedCards = sortJobTimecardCardsForMode(cards.value, sortMode.value)
      await Promise.all(sortedCards.map((card, index) => {
        card.sortIndex = index
        return updateTimecardCard(
          selectedWeek.value!.id,
          card.id,
          selectedWeekStartDate.value,
          card,
          burdenValue.value,
        )
      }))
      setPageInfo(`Sorted cards by ${sortMode.value === 'name' ? 'name' : 'number'}.`)
    } catch (error) {
      setPageError(error, 'Failed to sort the cards.')
    } finally {
      actionLoading.value = false
    }
  }

  function handleSubmitWeek() {
    if (!selectedWeek.value || !cards.value.length) return

    timecardConfirmAction.value = {
      kind: 'submit-week',
      weekId: selectedWeek.value.id,
      weekEndDate: selectedWeekEndDate.value,
    }
  }

  async function confirmSubmitWeek(action: Extract<JobTimecardConfirmAction, { kind: 'submit-week' }>) {
    actionLoading.value = true
    resetPageAndSaveMessages()
    try {
      await flushPendingSaves()
      const result = await submitTimecardWeek(action.weekId, getSubmitActor())
      setPageInfo(result.emailMessage || 'Week submitted.')
    } catch (error) {
      setPageError(error, 'Failed to submit the timecard week.')
    } finally {
      actionLoading.value = false
      closeTimecardConfirm()
    }
  }

  async function confirmTimecardAction() {
    const action = timecardConfirmAction.value
    if (!action) return

    if (action.kind === 'remove-card') {
      await confirmRemoveCard(action)
      return
    }

    await confirmSubmitWeek(action)
  }

  return {
    confirmRemoveCard,
    confirmSubmitWeek,
    confirmTimecardAction,
    handleRemoveCard,
    handleSortCards,
    handleSubmitWeek,
  }
}
