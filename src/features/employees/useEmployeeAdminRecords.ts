import { useSubscribedRecords } from '@/composables/useSubscribedRecords'
import { subscribeEmployees } from '@/services/employees'
import type { EmployeeRecord } from '@/types/domain'
import type { WritableRef } from '@/types/reactivity'

interface UseEmployeeAdminRecordsOptions {
  selectedEmployeeId: WritableRef<string | 'new'>
}

export function useEmployeeAdminRecords({
  selectedEmployeeId,
}: UseEmployeeAdminRecordsOptions) {
  const {
    error: employeesError,
    loading: employeesLoading,
    records: employees,
    start: startEmployeesSubscription,
    stop: stopEmployeesSubscription,
  } = useSubscribedRecords<EmployeeRecord>(subscribeEmployees, {
    errorMessage: 'Failed to load employees.',
    onUpdate: (nextEmployees) => {
      if (
        selectedEmployeeId.value !== 'new'
        && !nextEmployees.some((employee) => employee.id === selectedEmployeeId.value)
      ) {
        selectedEmployeeId.value = 'new'
      }
    },
  })

  return {
    employees,
    employeesError,
    employeesLoading,
    startEmployeesSubscription,
    stopEmployeesSubscription,
  }
}
