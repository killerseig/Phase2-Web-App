import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { createEmployee, deleteEmployee, listEmployees, subscribeEmployees, updateEmployee } from '@/services'
import type { EmployeeDirectoryEmployee } from '@/types/models'
import { normalizeError } from '@/services/serviceUtils'
import { logError } from '@/utils'

export const useEmployeesStore = defineStore('employees', () => {
  const employees = ref<EmployeeDirectoryEmployee[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  let unsubscribeEmployees: (() => void) | null = null

  const activeEmployees = computed(() => employees.value.filter((employee) => employee.active))

  const setStoreError = (err: unknown, fallback: string) => {
    error.value = normalizeError(err, fallback)
  }

  const stopEmployeesSubscription = () => {
    if (!unsubscribeEmployees) return
    unsubscribeEmployees()
    unsubscribeEmployees = null
  }

  async function fetchAllEmployees() {
    loading.value = true
    error.value = null
    try {
      employees.value = await listEmployees()
    } catch (err) {
      setStoreError(err, 'Failed to load employees')
      logError('Employees Store', 'Error loading employees', err)
    } finally {
      loading.value = false
    }
  }

  function subscribeAllEmployees() {
    stopEmployeesSubscription()
    loading.value = true
    error.value = null

    unsubscribeEmployees = subscribeEmployees(
      (nextEmployees) => {
        employees.value = nextEmployees
        loading.value = false
      },
      (err) => {
        setStoreError(err, 'Failed to subscribe to employees')
        loading.value = false
        logError('Employees Store', 'Error subscribing to employees', err)
      },
    )
  }

  function clearError() {
    error.value = null
  }

  async function createEmployeeRecord(input: {
    employeeNumber: string
    firstName: string
    lastName: string
    occupation: string
    active?: boolean
    jobId?: string | null
    wageRate?: number | null
  }) {
    error.value = null
    try {
      const employeeId = await createEmployee(input)
      await fetchAllEmployees()
      return employeeId
    } catch (err) {
      setStoreError(err, 'Failed to create employee')
      logError('Employees Store', 'Error creating employee', err)
      throw err
    }
  }

  async function updateEmployeeRecord(
    employeeId: string,
    updates: Partial<{
      employeeNumber: string
      firstName: string
      lastName: string
      occupation: string
      active: boolean
      jobId: string | null
      wageRate: number | null
    }>,
  ) {
    error.value = null
    try {
      await updateEmployee(employeeId, updates)
      await fetchAllEmployees()
    } catch (err) {
      setStoreError(err, 'Failed to update employee')
      logError('Employees Store', 'Error updating employee', err)
      throw err
    }
  }

  async function deleteEmployeeRecord(employeeId: string) {
    error.value = null
    try {
      await deleteEmployee(employeeId)
      employees.value = employees.value.filter((employee) => employee.id !== employeeId)
    } catch (err) {
      setStoreError(err, 'Failed to delete employee')
      logError('Employees Store', 'Error deleting employee', err)
      throw err
    }
  }

  function $reset() {
    stopEmployeesSubscription()
    employees.value = []
    loading.value = false
    error.value = null
  }

  return {
    employees,
    activeEmployees,
    loading,
    error,
    fetchAllEmployees,
    subscribeAllEmployees,
    stopEmployeesSubscription,
    createEmployeeRecord,
    updateEmployeeRecord,
    deleteEmployeeRecord,
    clearError,
    $reset,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useEmployeesStore, import.meta.hot))
}
