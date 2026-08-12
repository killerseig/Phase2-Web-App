import { useSubscribedRecords } from '@/composables/useSubscribedRecords'
import { subscribeEmployees } from '@/services/employees'
import {
  subscribeTimecardCards,
  subscribeTimecardWeeks,
} from '@/services/timecards'
import { mergeJobTimecardRemoteCardsWithLocalState } from './jobViewHelpers'
import type { EmployeeRecord, TimecardCardRecord, TimecardWeekRecord } from '@/types/domain'
import type { ReadonlyRef } from '@/types/reactivity'
import { normalizeError } from '@/utils/normalizeError'

export type JobTimecardWeekSubscriptionMode = 'all' | 'current-user' | 'submitted-report'

type FirebaseLikeError = Error & {
  code?: string
}

interface UseJobTimecardRecordsOptions {
  getBurdenValue: () => number
  getCurrentUserId: () => string | null
  getCanManageJobTimecards: () => boolean
  getWeekSubscriptionMode?: () => JobTimecardWeekSubscriptionMode
  getPendingStateMaps: () => ReadonlyArray<Readonly<Record<string, boolean>>>
  getSelectedWeek: () => TimecardWeekRecord | null
  jobId: ReadonlyRef<string>
  onCardsUpdate: (cards: TimecardCardRecord[]) => void
  onRecordsError: (error: unknown, fallbackMessage: string) => void
  onWeeksUpdate: () => void
}

export function useJobTimecardRecords({
  getBurdenValue,
  getCurrentUserId,
  getCanManageJobTimecards,
  getWeekSubscriptionMode,
  getPendingStateMaps,
  getSelectedWeek,
  jobId,
  onCardsUpdate,
  onRecordsError,
  onWeeksUpdate,
}: UseJobTimecardRecordsOptions) {
  function isDeadlineExceededError(error: unknown) {
    if (!(error instanceof Error)) return false

    const firebaseError = error as FirebaseLikeError
    const code = firebaseError.code?.toLowerCase()
    const message = firebaseError.message?.toLowerCase() ?? ''

    return code === 'deadline-exceeded'
      || code === 'firestore/deadline-exceeded'
      || message.includes('deadline-exceeded')
  }

  function reportRecordsError(error: unknown, fallbackMessage: string) {
    const detail = normalizeError(error, fallbackMessage)
    onRecordsError(detail === fallbackMessage ? fallbackMessage : `${fallbackMessage} ${detail}`, fallbackMessage)
  }

  function reportCardsError(error: unknown) {
    if (isDeadlineExceededError(error)) {
      console.warn('[timecards] Timecard card listener deadline exceeded; keeping the workspace usable.', error)
      return
    }

    reportRecordsError(error, 'Failed to load timecard cards.')
  }

  function subscribeCurrentJobTimecardWeeks(
    onUpdate: (records: TimecardWeekRecord[]) => void,
    onError?: (error: unknown) => void,
  ) {
    if (!jobId.value) return () => {}

    const mode = getWeekSubscriptionMode?.() ?? (getCanManageJobTimecards() ? 'all' : 'all')

    if (mode === 'submitted-report') {
      return subscribeTimecardWeeks(
        jobId.value,
        onUpdate,
        onError,
        null,
        'submitted',
      )
    }

    const ownerForemanUserId = mode === 'all' ? null : getCurrentUserId()

    if (mode === 'current-user' && !ownerForemanUserId) {
      onUpdate([])
      return () => {}
    }

    return subscribeTimecardWeeks(
      jobId.value,
      onUpdate,
      onError,
      ownerForemanUserId,
    )
  }

  function subscribeCurrentWeekTimecardCards(
    onUpdate: (records: TimecardCardRecord[]) => void,
    onError?: (error: unknown) => void,
  ) {
    const week = getSelectedWeek()
    if (!week) return () => {}

    return subscribeTimecardCards(
      week.id,
      week.weekStartDate,
      getBurdenValue(),
      (nextCards) => {
        onUpdate(mergeJobTimecardRemoteCardsWithLocalState(
          nextCards,
          cardsSubscription.records.value,
          getPendingStateMaps(),
        ))
      },
      onError,
    )
  }

  const employeesSubscription = useSubscribedRecords<EmployeeRecord>(subscribeEmployees, {
    errorMessage: 'Failed to load employees.',
    onError: (error) => {
      reportRecordsError(error, 'Failed to load employees.')
    },
  })
  const weeksSubscription = useSubscribedRecords<TimecardWeekRecord>(subscribeCurrentJobTimecardWeeks, {
    errorMessage: 'Failed to load timecard weeks.',
    onUpdate: () => {
      onWeeksUpdate()
    },
    onError: (error) => {
      reportRecordsError(error, 'Failed to load timecard weeks.')
    },
  })
  const cardsSubscription = useSubscribedRecords<TimecardCardRecord>(subscribeCurrentWeekTimecardCards, {
    errorMessage: 'Failed to load timecard cards.',
    initialLoading: false,
    onUpdate: onCardsUpdate,
    onError: (error) => {
      reportCardsError(error)
    },
  })

  return {
    cards: cardsSubscription.records,
    cardsLoading: cardsSubscription.loading,
    employees: employeesSubscription.records,
    employeesLoading: employeesSubscription.loading,
    startCardsRecordsSubscription: cardsSubscription.start,
    startEmployeesSubscription: employeesSubscription.start,
    startWeeksRecordsSubscription: weeksSubscription.start,
    stopCardsRecordsSubscription: cardsSubscription.stop,
    stopEmployeesSubscription: employeesSubscription.stop,
    stopWeeksRecordsSubscription: weeksSubscription.stop,
    weeks: weeksSubscription.records,
    weeksLoading: weeksSubscription.loading,
  }
}
