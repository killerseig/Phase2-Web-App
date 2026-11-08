import { useAdminRecords } from '@/features/admin/useAdminRecords'
import { watch } from 'vue'
import type { AdminRequestContext } from '@/features/admin/useAdminRequestContext'
import { subscribeEmployees } from '@/services/employees'
import type { EmployeeRecord } from '@/types/domain'
import type { ReadonlyRef, WritableRef } from '@/types/reactivity'

interface UseEmployeeAdminRecordsOptions {
  context?: AdminRequestContext
  deleting?: ReadonlyRef<boolean>
  selectedEmployeeId: WritableRef<string | 'new'>
}

export function useEmployeeAdminRecords({
  context,
  deleting,
  selectedEmployeeId,
}: UseEmployeeAdminRecordsOptions) {
  const {
    error: employeesError,
    loading: employeesLoading,
    records: employees,
    start: startEmployeesSubscription,
    stop: stopEmployeesSubscription,
  } = useAdminRecords<EmployeeRecord>(subscribeEmployees, {
    context,
    errorMessage: 'Failed to load employees.',
    onUpdate: reconcileSelection,
  })
  function reconcileSelection(nextEmployees: EmployeeRecord[]) {
    // Keep the pending deletion's owner until its response can report success.
    if (
      !deleting?.value &&
      selectedEmployeeId.value !== 'new' &&
      !nextEmployees.some((employee) => employee.id === selectedEmployeeId.value)
    ) {
      selectedEmployeeId.value = 'new'
    }
  }
  if (deleting) watch(() => deleting.value, () => reconcileSelection(employees.value), { flush: 'sync' })

  return {
    employees,
    employeesError,
    employeesLoading,
    startEmployeesSubscription,
    stopEmployeesSubscription,
  }
}
