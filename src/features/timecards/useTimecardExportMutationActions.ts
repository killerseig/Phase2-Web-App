import {
  formatTimecardExportDate,
  formatTimecardExportWeekRowSubtitle,
  type TimecardExportArchiveCardRecord,
  type TimecardExportConfirmAction,
} from '@/features/timecards/exportViewHelpers'
import { buildCardDisplayName } from '@/features/timecards/workbook'
import { deleteTimecardCard, deleteTimecardWeek } from '@/services/timecards'
import type { TimecardWeekRecord } from '@/types/domain'

interface Ref<T> {
  value: T
}

interface ReadonlyRef<T> {
  readonly value: T
}

interface UseTimecardExportMutationActionsOptions {
  actionLoading: Ref<boolean>
  canEditWeek: ReadonlyRef<boolean>
  deleteWeekCache: (weekId: string) => void
  flushPendingSaves: () => Promise<void>
  getIsAdmin: () => boolean
  resetPageAndSaveMessages: () => void
  selectCard: (cardId: string) => void
  setPageError: (error: unknown, fallback: string) => void
  setPageInfo: (message: string) => void
  timecardExportConfirmAction: Ref<TimecardExportConfirmAction | null>
}

export function useTimecardExportMutationActions({
  actionLoading,
  canEditWeek,
  deleteWeekCache,
  flushPendingSaves,
  getIsAdmin,
  resetPageAndSaveMessages,
  selectCard,
  setPageError,
  setPageInfo,
  timecardExportConfirmAction,
}: UseTimecardExportMutationActionsOptions) {
  function handleRemoveCard(card: TimecardExportArchiveCardRecord) {
    if (!canEditWeek.value) return

    timecardExportConfirmAction.value = {
      kind: 'remove-card',
      cardId: card.id,
      cardLabel: buildCardDisplayName(card),
      weekId: card.archiveWeekId,
      weekEndDate: formatTimecardExportDate(card.archiveWeekEndDate),
    }
  }

  async function confirmRemoveCard(action: Extract<TimecardExportConfirmAction, { kind: 'remove-card' }>) {
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
      timecardExportConfirmAction.value = null
    }
  }

  function handleDeleteWeek(week: TimecardWeekRecord) {
    if (!getIsAdmin() || week.status !== 'draft') return

    timecardExportConfirmAction.value = {
      kind: 'delete-week',
      weekId: week.id,
      weekLabel: formatTimecardExportWeekRowSubtitle(week),
      weekEndDate: formatTimecardExportDate(week.weekEndDate),
    }
  }

  async function confirmDeleteWeek(action: Extract<TimecardExportConfirmAction, { kind: 'delete-week' }>) {
    actionLoading.value = true
    resetPageAndSaveMessages()
    try {
      await flushPendingSaves()
      await deleteTimecardWeek(action.weekId)
      deleteWeekCache(action.weekId)
      setPageInfo('Draft week deleted.')
    } catch (error) {
      setPageError(error, 'Failed to delete the draft week.')
    } finally {
      actionLoading.value = false
      timecardExportConfirmAction.value = null
    }
  }

  async function confirmTimecardExportAction() {
    const action = timecardExportConfirmAction.value
    if (!action) return

    if (action.kind === 'remove-card') {
      await confirmRemoveCard(action)
      return
    }

    await confirmDeleteWeek(action)
  }

  return {
    confirmDeleteWeek,
    confirmRemoveCard,
    confirmTimecardExportAction,
    handleDeleteWeek,
    handleRemoveCard,
  }
}
