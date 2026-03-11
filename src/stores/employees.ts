import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  createEmployee as createEmployeeService,
  deleteEmployee as deleteEmployeeService,
  listAllEmployees as listAllEmployeesService,
  listEmployeesByJob as listEmployeesByJobService,
  subscribeAllEmployees as subscribeAllEmployeesService,
  subscribeEmployeesByJob as subscribeEmployeesByJobService,
  updateEmployee as updateEmployeeService,
  type Employee,
  type EmployeeInput,
} from '@/services'
import { normalizeError } from '@/services/serviceUtils'

export const useEmployeesStore = defineStore('employees', () => {
  const employees = ref<Employee[]>([])
  const employeesByJob = ref<Record<string, Employee[]>>({})
  const loading = ref(false)
  const error = ref<string | null>(null)
  let unsubscribeAllEmployees: (() => void) | null = null
  const employeesByJobSubscriptions = new Map<string, () => void>()

  // Computed
  const activeEmployees = computed(() => employees.value.filter(e => e.active !== false))

  const setStoreError = (err: unknown, fallback: string) => {
    error.value = normalizeError(err, fallback)
  }

  const stopAllEmployeesSubscription = () => {
    if (!unsubscribeAllEmployees) return
    unsubscribeAllEmployees()
    unsubscribeAllEmployees = null
  }

  const stopEmployeesByJobSubscription = (jobId?: string) => {
    if (jobId) {
      const unsubscribe = employeesByJobSubscriptions.get(jobId)
      if (unsubscribe) {
        unsubscribe()
        employeesByJobSubscriptions.delete(jobId)
      }
      return
    }

    employeesByJobSubscriptions.forEach((unsubscribe) => unsubscribe())
    employeesByJobSubscriptions.clear()
  }

  // Actions
  async function fetchAllEmployees() {
    loading.value = true
    error.value = null
    try {
      employees.value = await listAllEmployeesService()
    } catch (err) {
      setStoreError(err, 'Failed to load employees')
      console.error('[Employees Store] Error loading employees:', err)
    } finally {
      loading.value = false
    }
  }

  function subscribeAllEmployees() {
    stopAllEmployeesSubscription()
    loading.value = true
    error.value = null

    unsubscribeAllEmployees = subscribeAllEmployeesService(
      (nextEmployees) => {
        employees.value = nextEmployees
        loading.value = false
      },
      (err) => {
        setStoreError(err, 'Failed to subscribe to employees')
        loading.value = false
        console.error('[Employees Store] Error subscribing to employees:', err)
      }
    )
  }

  async function fetchEmployeesByJob(jobId: string) {
    loading.value = true
    error.value = null
    try {
      const jobEmployees = await listEmployeesByJobService(jobId)
      employeesByJob.value[jobId] = jobEmployees
      return jobEmployees
    } catch (err) {
      setStoreError(err, 'Failed to load employees for job')
      console.error('[Employees Store] Error loading employees by job:', err)
      return []
    } finally {
      loading.value = false
    }
  }

  function getEmployeesByJob(jobId: string): Employee[] {
    return employeesByJob.value[jobId] ?? []
  }

  async function createEmployee(jobId: string | null, input: Omit<EmployeeInput, 'jobId'>) {
    loading.value = true
    error.value = null
    try {
      const employeeId = await createEmployeeService(jobId, input)
      // Re-fetch to get the full employee object
      if (jobId) {
        await fetchEmployeesByJob(jobId)
      } else {
        await fetchAllEmployees()
      }
      const newEmployee = employees.value.find(e => e.id === employeeId)
      if (!newEmployee) throw new Error('Failed to retrieve created employee')
      return newEmployee
    } catch (err) {
      setStoreError(err, 'Failed to create employee')
      console.error('[Employees Store] Error creating employee:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  function subscribeEmployeesByJob(jobId: string) {
    stopEmployeesByJobSubscription(jobId)
    loading.value = true
    error.value = null

    const unsubscribe = subscribeEmployeesByJobService(
      jobId,
      (jobEmployees) => {
        employeesByJob.value[jobId] = jobEmployees
        loading.value = false
      },
      (err) => {
        setStoreError(err, 'Failed to subscribe to employees for job')
        loading.value = false
        console.error('[Employees Store] Error subscribing to employees by job:', err)
      }
    )

    employeesByJobSubscriptions.set(jobId, unsubscribe)
  }

  async function updateEmployee(employeeId: string, updates: Partial<Omit<EmployeeInput, 'jobId'>>) {
    error.value = null
    try {
      await updateEmployeeService(employeeId, updates)
      
      // Update in main list
      const idx = employees.value.findIndex(e => e.id === employeeId)
      if (idx !== -1) {
        const employee = employees.value[idx]
        if (employee) Object.assign(employee, updates)
      }
    } catch (err) {
      setStoreError(err, 'Failed to update employee')
      console.error('[Employees Store] Error updating employee:', err)
      throw err
    }
  }

  async function deleteEmployee(employeeId: string) {
    error.value = null
    try {
      // Get employee before deletion to know which job to update
      const emp = employees.value.find(e => e.id === employeeId)
      
      await deleteEmployeeService(employeeId)
      
      // Remove from main list
      employees.value = employees.value.filter(e => e.id !== employeeId)
      
      // Remove from job-specific list
      if (emp?.jobId) {
        const jobList = employeesByJob.value[emp.jobId] ?? []
        employeesByJob.value[emp.jobId] = jobList.filter(e => e.id !== employeeId)
      }
    } catch (err) {
      setStoreError(err, 'Failed to delete employee')
      console.error('[Employees Store] Error deleting employee:', err)
      throw err
    }
  }

  function clearError() {
    error.value = null
  }

  function $reset() {
    stopAllEmployeesSubscription()
    stopEmployeesByJobSubscription()
    employees.value = []
    employeesByJob.value = {}
    loading.value = false
    error.value = null
  }

  return {
    // State
    employees,
    employeesByJob,
    loading,
    error,

    // Computed
    activeEmployees,

    // Actions
    fetchAllEmployees,
    subscribeAllEmployees,
    fetchEmployeesByJob,
    subscribeEmployeesByJob,
    getEmployeesByJob,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    stopAllEmployeesSubscription,
    stopEmployeesByJobSubscription,
    clearError,
    $reset,
  }
})

