import { useSubscribedRecords } from '@/composables/useSubscribedRecords'
import { subscribeEmployees } from '@/services/employees'
import { subscribeAllTimecardWeeks } from '@/services/timecards'
import { subscribeUsers } from '@/services/users'
import type { EmployeeRecord, TimecardWeekRecord, UserProfile } from '@/types/domain'

interface UseTimecardExportSubscriptionsOptions {
  getIsAdmin: () => boolean
  setPageError: (error: unknown, fallbackMessage: string) => void
}

export function useTimecardExportSubscriptions({
  getIsAdmin,
  setPageError,
}: UseTimecardExportSubscriptionsOptions) {
  const {
    loading: weeksLoading,
    records: weeks,
    start: startWeeksRecordsSubscription,
    stop: stopWeeksRecordsSubscription,
  } = useSubscribedRecords<TimecardWeekRecord>(subscribeAllTimecardWeeks, {
    errorMessage: 'Failed to load saved timecard weeks.',
    onError: (error) => {
      setPageError(error, 'Failed to load saved timecard weeks.')
    },
  })
  const {
    loading: employeesLoading,
    records: employees,
    start: startEmployeesSubscription,
    stop: stopEmployeesSubscription,
  } = useSubscribedRecords<EmployeeRecord>(subscribeEmployees, {
    errorMessage: 'Failed to load employees.',
    onError: (error) => {
      setPageError(error, 'Failed to load employees.')
    },
  })
  const {
    records: users,
    start: startUsersSubscription,
    stop: stopUsersSubscription,
  } = useSubscribedRecords<UserProfile>(subscribeUsers, {
    errorMessage: 'Failed to load foremen.',
    onError: (error) => {
      setPageError(error, 'Failed to load foremen.')
    },
  })

  function stopWeeksSubscription() {
    stopWeeksRecordsSubscription()
  }

  function subscribeWeeksForArchive() {
    startWeeksRecordsSubscription()
  }

  function subscribeEmployeesForExport() {
    if (!getIsAdmin()) {
      stopEmployeesSubscription()
      employees.value = []
      employeesLoading.value = false
      return
    }

    startEmployeesSubscription()
  }

  function subscribeUsersForExport() {
    if (!getIsAdmin()) {
      stopUsersSubscription()
      users.value = []
      return
    }

    startUsersSubscription()
  }

  return {
    employees,
    employeesLoading,
    stopEmployeesSubscription,
    subscribeEmployeesForExport,
    stopUsersSubscription,
    subscribeUsersForExport,
    stopWeeksSubscription,
    subscribeWeeksForArchive,
    users,
    weeks,
    weeksLoading,
  }
}
