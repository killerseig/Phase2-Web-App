import { computed } from 'vue'
import type { ReadonlyRef } from '@/types/reactivity'
import type { EmployeeRecord } from '@/types/domain'
import { filterDirectoryRecords, type DirectoryStatusFilter } from '@/utils/directoryFilters'
import {
  buildEmployeeOccupationSuggestions,
  buildEmployeeSearchTokens,
  getEmployeeDisplayName,
  getEmployeeStatusCounts,
} from './employeeViewHelpers'

interface UseEmployeeAdminViewStateOptions {
  employees: ReadonlyRef<EmployeeRecord[]>
  searchTerm: ReadonlyRef<string>
  selectedEmployeeId: ReadonlyRef<string | 'new'>
  statusFilter: ReadonlyRef<DirectoryStatusFilter>
}

const passiveEmployeeDetailMessages = new Set([
  'Changes save when you leave a field.',
  'Saving changes...',
  'All changes saved.',
])

export function shouldShowEmployeeDetailSuccessToast(message: string) {
  return !passiveEmployeeDetailMessages.has(message)
}

export function useEmployeeAdminViewState({
  employees,
  searchTerm,
  selectedEmployeeId,
  statusFilter,
}: UseEmployeeAdminViewStateOptions) {
  const filteredEmployees = computed(() => {
    return filterDirectoryRecords(employees.value, statusFilter.value, searchTerm.value, buildEmployeeSearchTokens)
  })

  const selectedEmployee = computed(() =>
    employees.value.find((employee) => employee.id === selectedEmployeeId.value) ?? null,
  )

  const deleteEmployeeConfirmMessage = computed(() => (
    selectedEmployee.value
      ? `Delete ${getEmployeeDisplayName(selectedEmployee.value)} from the employee directory? This will not remove them from historical records.`
      : ''
  ))

  const isCreateMode = computed(() => selectedEmployeeId.value === 'new')
  const employeeStatusCounts = computed(() => getEmployeeStatusCounts(employees.value))
  const activeEmployeesCount = computed(() => employeeStatusCounts.value.active)
  const inactiveEmployeesCount = computed(() => employeeStatusCounts.value.inactive)
  const occupationSuggestions = computed(() => buildEmployeeOccupationSuggestions(employees.value))

  return {
    activeEmployeesCount,
    deleteEmployeeConfirmMessage,
    employeeStatusCounts,
    filteredEmployees,
    inactiveEmployeesCount,
    isCreateMode,
    occupationSuggestions,
    selectedEmployee,
  }
}
