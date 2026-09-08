import {
  formatTimecardExportDate,
  formatTimecardExportWeekRowSubtitle,
  type TimecardExportArchiveCardRecord,
  type TimecardExportConfirmAction,
} from '@/features/timecards/exportViewHelpers'
import {
  findTimecardSubmissionValidationIssues,
  formatTimecardSubmissionValidationMessage,
} from '@/features/timecards/submissionValidation'
import { buildCardDisplayName } from '@/features/timecards/workbook'
import {
  deleteTimecardCard,
  deleteTimecardWeek,
  reopenTimecardWeek,
  submitTimecardWeek,
} from '@/services/timecards'
import type { TimecardWeekRecord } from '@/types/domain'
import type { ReadonlyRef, WritableRef } from '@/types/reactivity'

interface UseTimecardExportMutationActionsOptions {
  actionLoading: WritableRef<boolean>
  canEditWeek: ReadonlyRef<boolean>
  cards: ReadonlyRef<TimecardExportArchiveCardRecord[]>
  deleteWeekCache: (weekId: string) => void
  flushPendingSaves: () => Promise<void>
  getCanReopenSubmittedWeeks: () => boolean
  getCanUseTimecardExport: () => boolean
  resetPageAndSaveMessages: () => void
  revealCard: (cardId: string) => void
  selectCard: (cardId: string) => void
  setPageError: (error: unknown, fallback: string) => void
  setPageErrorMessage: (message: string) => void
  setPageInfo: (message: string) => void
  timecardExportConfirmAction: WritableRef<TimecardExportConfirmAction | null>
}

export function useTimecardExportMutationActions({
  actionLoading,
  canEditWeek,
  cards,
  deleteWeekCache,
  flushPendingSaves,
  getCanReopenSubmittedWeeks,
  getCanUseTimecardExport,
  resetPageAndSaveMessages,
  revealCard,
  selectCard,
  setPageError,
  setPageErrorMessage,
  setPageInfo,
  timecardExportConfirmAction,
}: UseTimecardExportMutationActionsOptions) {
  function validateWeekForSubmission(weekId: string) {
    const issues = findTimecardSubmissionValidationIssues(
      cards.value.filter((card) => card.archiveWeekId === weekId),
    )
    if (!issues.length) return true

    revealCard(issues[0]!.cardId)
    setPageErrorMessage(formatTimecardSubmissionValidationMessage(issues))
    return false
  }

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
    if (!getCanUseTimecardExport() || week.status !== 'draft') return

    timecardExportConfirmAction.value = {
      kind: 'delete-week',
      weekId: week.id,
      weekLabel: formatTimecardExportWeekRowSubtitle(week),
      weekEndDate: formatTimecardExportDate(week.weekEndDate),
    }
  }

  function handleSubmitWeek(week: TimecardWeekRecord) {
    if (!getCanUseTimecardExport() || week.status !== 'draft') return
    resetPageAndSaveMessages()
    if (!validateWeekForSubmission(week.id)) return

    timecardExportConfirmAction.value = {
      kind: 'submit-week',
      weekId: week.id,
      weekLabel: formatTimecardExportWeekRowSubtitle(week),
      weekEndDate: formatTimecardExportDate(week.weekEndDate),
    }
  }

  function handleReopenWeek(week: TimecardWeekRecord) {
    if (!getCanReopenSubmittedWeeks() || week.status !== 'submitted') return

    timecardExportConfirmAction.value = {
      kind: 'reopen-week',
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

  async function confirmSubmitWeek(action: Extract<TimecardExportConfirmAction, { kind: 'submit-week' }>) {
    actionLoading.value = true
    resetPageAndSaveMessages()
    try {
      await flushPendingSaves()
      if (!validateWeekForSubmission(action.weekId)) return
      await submitTimecardWeek(action.weekId)
      setPageInfo('Week submitted.')
    } catch (error) {
      setPageError(error, 'Failed to submit the draft week.')
    } finally {
      actionLoading.value = false
      timecardExportConfirmAction.value = null
    }
  }

  async function confirmReopenWeek(action: Extract<TimecardExportConfirmAction, { kind: 'reopen-week' }>) {
    if (!getCanReopenSubmittedWeeks()) {
      timecardExportConfirmAction.value = null
      return
    }

    actionLoading.value = true
    resetPageAndSaveMessages()
    try {
      await flushPendingSaves()
      await reopenTimecardWeek(action.weekId)
      setPageInfo('Week re-opened for corrections.')
    } catch (error) {
      setPageError(error, 'Failed to re-open the submitted week for corrections.')
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

    if (action.kind === 'delete-week') {
      await confirmDeleteWeek(action)
      return
    }

    if (action.kind === 'submit-week') {
      await confirmSubmitWeek(action)
      return
    }

    await confirmReopenWeek(action)
  }

  return {
    confirmDeleteWeek,
    confirmRemoveCard,
    confirmReopenWeek,
    confirmSubmitWeek,
    confirmTimecardExportAction,
    handleDeleteWeek,
    handleRemoveCard,
    handleReopenWeek,
    handleSubmitWeek,
  }
}
