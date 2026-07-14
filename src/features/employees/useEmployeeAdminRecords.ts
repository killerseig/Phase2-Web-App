import type { Ref } from 'vue'
import { useSubscribedRecords } from '@/composables/useSubscribedRecords'
import { subscribeEmployees } from '@/services/employees'
import type { EmployeeRecord } from '@/types/domain'

interface UseEmployeeAdminRecordsOptions {
  selectedEmployeeId: Ref<string | 'new'>
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
