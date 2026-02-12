import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  createEmployee as createEmployeeService,
  deleteEmployee as deleteEmployeeService,
  listAllEmployees as listAllEmployeesService,
  listEmployeesByJob as listEmployeesByJobService,
  updateEmployee as updateEmployeeService,
  type Employee,
} from '@/services'

export const useEmployeesStore = defineStore('employees', () => {
  const employees = ref<Employee[]>([])
  const employeesByJob = ref<Map<string, Employee[]>>(new Map())
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const allEmployees = computed(() => employees.value)
  const activeEmployees = computed(() => employees.value.filter(e => e.active !== false))
  const isLoading = computed(() => loading.value)
  const hasError = computed(() => error.value !== null)

  // Actions
  async function fetchAllEmployees() {
    loading.value = true
    error.value = null
    try {
      employees.value = await listAllEmployeesService()
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to load employees'
      console.error('[Employees Store] Error loading employees:', e)
    } finally {
      loading.value = false
    }
  }

  async function fetchEmployeesByJob(jobId: string) {
    loading.value = true
    error.value = null
    try {
      const jobEmployees = await listEmployeesByJobService(jobId)
      employeesByJob.value.set(jobId, jobEmployees)
      return jobEmployees
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to load employees for job'
      console.error('[Employees Store] Error loading employees by job:', e)
      return []
    } finally {
      loading.value = false
    }
  }

  function getEmployeesByJob(jobId: string): Employee[] {
    return employeesByJob.value.get(jobId) ?? []
  }

  async function createEmployee(jobId: string | null, input: any) {
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
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to create employee'
      console.error('[Employees Store] Error creating employee:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateEmployee(employeeId: string, updates: any) {
    error.value = null
    try {
      await updateEmployeeService(employeeId, updates)
      
      // Update in main list
      const idx = employees.value.findIndex(e => e.id === employeeId)
      if (idx !== -1) {
        const old = employees.value[idx]
        const updated = { ...old, ...updates }
        employees.value[idx] = updated
        
        // Update job-specific list if job changed
        if (old.jobId && old.jobId !== updates.jobId) {
          const oldList = employeesByJob.value.get(old.jobId) ?? []
          employeesByJob.value.set(old.jobId, oldList.filter(e => e.id !== employeeId))
        }
        if (updates.jobId) {
          const newList = employeesByJob.value.get(updates.jobId) ?? []
          employeesByJob.value.set(updates.jobId, [...newList, updated])
        }
      }
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to update employee'
      console.error('[Employees Store] Error updating employee:', e)
      throw e
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
        const jobList = employeesByJob.value.get(emp.jobId) ?? []
        employeesByJob.value.set(emp.jobId, jobList.filter(e => e.id !== employeeId))
      }
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to delete employee'
      console.error('[Employees Store] Error deleting employee:', e)
      throw e
    }
  }

  function clearError() {
    error.value = null
  }

  function resetStore() {
    employees.value = []
    employeesByJob.value.clear()
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
    allEmployees,
    activeEmployees,
    isLoading,
    hasError,

    // Actions
    fetchAllEmployees,
    fetchEmployeesByJob,
    getEmployeesByJob,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    clearError,
    resetStore,
  }
})
