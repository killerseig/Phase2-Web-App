import { useSubscribedRecords } from '@/composables/useSubscribedRecords'
import { subscribeEmployees } from '@/services/employees'
import {
  subscribeTimecardCards,
  subscribeTimecardWeeks,
} from '@/services/timecards'
import type { EmployeeRecord, TimecardCardRecord, TimecardWeekRecord } from '@/types/domain'

interface ReadonlyRef<T> {
  readonly value: T
}

interface UseJobTimecardRecordsOptions {
  getBurdenValue: () => number
  getCurrentUserId: () => string | null
  getIsAdmin: () => boolean
  getSelectedWeek: () => TimecardWeekRecord | null
  jobId: ReadonlyRef<string>
  mergeRemoteCardsWithLocalState: (cards: TimecardCardRecord[]) => TimecardCardRecord[]
  onCardsUpdate: (cards: TimecardCardRecord[]) => void
  onRecordsError: (error: unknown, fallbackMessage: string) => void
  onWeeksUpdate: () => void
}

export function useJobTimecardRecords({
  getBurdenValue,
  getCurrentUserId,
  getIsAdmin,
  getSelectedWeek,
  jobId,
  mergeRemoteCardsWithLocalState,
  onCardsUpdate,
  onRecordsError,
  onWeeksUpdate,
}: UseJobTimecardRecordsOptions) {
  function subscribeCurrentJobTimecardWeeks(
    onUpdate: (records: TimecardWeekRecord[]) => void,
    onError?: (error: unknown) => void,
  ) {
    if (!jobId.value) return () => {}

    return subscribeTimecardWeeks(
      jobId.value,
      onUpdate,
      onError,
      getIsAdmin() ? null : getCurrentUserId(),
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
        onUpdate(mergeRemoteCardsWithLocalState(nextCards))
      },
      onError,
    )
  }

  const employeesSubscription = useSubscribedRecords<EmployeeRecord>(subscribeEmployees, {
    errorMessage: 'Failed to load employees.',
    onError: (error) => {
      onRecordsError(error, 'Failed to load employees.')
    },
  })
  const weeksSubscription = useSubscribedRecords<TimecardWeekRecord>(subscribeCurrentJobTimecardWeeks, {
    errorMessage: 'Failed to load timecard weeks.',
    onUpdate: () => {
      onWeeksUpdate()
    },
    onError: (error) => {
      onRecordsError(error, 'Failed to load timecard weeks.')
    },
  })
  const cardsSubscription = useSubscribedRecords<TimecardCardRecord>(subscribeCurrentWeekTimecardCards, {
    errorMessage: 'Failed to load timecard cards.',
    initialLoading: false,
    onUpdate: onCardsUpdate,
    onError: (error) => {
      onRecordsError(error, 'Failed to load timecard cards.')
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
