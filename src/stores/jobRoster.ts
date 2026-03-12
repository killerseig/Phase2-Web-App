/**
 * Job Roster Store (Phase 3)
 * Manages job-scoped employee rosters
 * Replaces the global employees store
 */

import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  addRosterEmployee,
  listRosterEmployees,
  removeRosterEmployee,
  subscribeRosterEmployees,
  updateRosterEmployee,
} from '@/services'
import { normalizeError } from '@/services/serviceUtils'
import type { JobRosterEmployee, JobRosterEmployeeInput } from '@/types/models'

export const useJobRosterStore = defineStore('jobRoster', () => {
  // State: by job ID
  const rosterByJob = ref<Record<string, JobRosterEmployee[]>>({})
  const loading = ref(false)
  const error = ref<string | null>(null)
  const currentJobId = ref<string | null>(null)
  const rosterSubscriptions = new Map<string, () => void>()

  // Computed
  const currentJobRoster = computed(() => {
    if (!currentJobId.value) return []
    return rosterByJob.value[currentJobId.value] ?? []
  })

  const activeInCurrentJob = computed(() =>
    currentJobRoster.value.filter(e => e.active)
  )

  const inactiveInCurrentJob = computed(() =>
    currentJobRoster.value.filter(e => !e.active)
  )

  const setStoreError = (err: unknown, fallback: string) => {
    error.value = normalizeError(err, fallback)
  }

  const stopJobRosterSubscription = (jobId?: string) => {
    if (jobId) {
      const unsubscribe = rosterSubscriptions.get(jobId)
      if (unsubscribe) {
        unsubscribe()
        rosterSubscriptions.delete(jobId)
      }
      return
    }

    rosterSubscriptions.forEach((unsubscribe) => unsubscribe())
    rosterSubscriptions.clear()
  }

  // Actions: Roster Loading
  function setCurrentJob(jobId: string) {
    currentJobId.value = jobId
  }

  /**
   * Load roster for a specific job
   */
  async function fetchJobRoster(jobId: string) {
    loading.value = true
    error.value = null
    try {
      const employees = await listRosterEmployees(jobId)
      rosterByJob.value[jobId] = employees

      // If this becomes current job, update currentJobId
      if (currentJobId.value === jobId) {
        // Already set, just refreshed
      }

      return employees
    } catch (err) {
      setStoreError(err, 'Failed to load roster')
      console.error(`[JobRoster Store] Error loading roster for job ${jobId}:`, err)
      throw err
    } finally {
      loading.value = false
    }
  }

  function subscribeJobRoster(jobId: string) {
    stopJobRosterSubscription(jobId)
    loading.value = true
    error.value = null

    const unsubscribe = subscribeRosterEmployees(
      jobId,
      (employees) => {
        rosterByJob.value[jobId] = employees
        if (currentJobId.value === jobId) {
          currentJobId.value = jobId
        }
        loading.value = false
      },
      (err) => {
        setStoreError(err, 'Failed to subscribe to roster')
        loading.value = false
        console.error(`[JobRoster Store] Error subscribing to roster for job ${jobId}:`, err)
      }
    )

    rosterSubscriptions.set(jobId, unsubscribe)
  }

  /**
   * Get roster for a job (from cache if available, otherwise fetch)
   */
  async function getRoster(jobId: string): Promise<JobRosterEmployee[]> {
    const cached = rosterByJob.value[jobId]
    if (cached) return cached
    return fetchJobRoster(jobId)
  }

  /**
   * Get a single employee from the roster
   */
  function getEmployee(jobId: string, employeeId: string): JobRosterEmployee | undefined {
    const roster = rosterByJob.value[jobId]
    return roster?.find(e => e.id === employeeId)
  }

  // Actions: CRUD
  async function addEmployee(jobId: string, employee: JobRosterEmployeeInput) {
    error.value = null
    try {
      const employeeId = await addRosterEmployee(jobId, employee)

      // Update local cache
      const roster = rosterByJob.value[jobId] ?? []
      const newEmployee = {
        ...employee,
        id: employeeId,
        jobId,
      } as JobRosterEmployee
      roster.push(newEmployee)
      rosterByJob.value[jobId] = roster

      return employeeId
    } catch (err) {
      setStoreError(err, 'Failed to add employee')
      console.error('[JobRoster Store] Error adding employee:', err)
      throw err
    }
  }

  /**
   * Update an employee in the roster
   */
  async function updateEmployee(jobId: string, employeeId: string, updates: Partial<JobRosterEmployee>) {
    error.value = null
    try {
      await updateRosterEmployee(jobId, employeeId, updates)

      // Update local cache
      const roster = rosterByJob.value[jobId] ?? []
      const idx = roster.findIndex(e => e.id === employeeId)
      if (idx !== -1) {
        const existing = roster[idx]
        if (existing) Object.assign(existing, updates)
        rosterByJob.value[jobId] = [...roster]
      }
    } catch (err) {
      setStoreError(err, 'Failed to update employee')
      console.error('[JobRoster Store] Error updating employee:', err)
      throw err
    }
  }

  /**
   * Remove an employee from the roster
   */
  async function removeEmployee(jobId: string, employeeId: string) {
    error.value = null
    try {
      await removeRosterEmployee(jobId, employeeId)

      // Update local cache
      const roster = rosterByJob.value[jobId] ?? []
      const filtered = roster.filter(e => e.id !== employeeId)
      rosterByJob.value[jobId] = filtered
    } catch (err) {
      setStoreError(err, 'Failed to remove employee')
      console.error('[JobRoster Store] Error removing employee:', err)
      throw err
    }
  }

  /**
   * Toggle employee active status
   */
  async function toggleEmployeeStatus(jobId: string, employeeId: string) {
    const employee = getEmployee(jobId, employeeId)
    if (!employee) throw new Error('Employee not found')

    await updateEmployee(jobId, employeeId, {
      active: !employee.active,
    })
  }

  // Actions: Search & Filter
  /**
   * Search roster by name, number, or occupation
   */
  function searchRoster(jobId: string, term: string): JobRosterEmployee[] {
    const roster = rosterByJob.value[jobId] ?? []
    if (!term.trim()) return roster

    const lower = term.toLowerCase()
    return roster.filter(
      e =>
        e.firstName.toLowerCase().includes(lower) ||
        e.lastName.toLowerCase().includes(lower) ||
        e.employeeNumber.includes(term) ||
        e.occupation.toLowerCase().includes(lower)
    )
  }

  /**
   * Get employees by contractor
   */
  function getEmployeesByContractor(jobId: string, contractorName: string): JobRosterEmployee[] {
    const roster = rosterByJob.value[jobId] ?? []
    return roster.filter(e => e.contractor?.name === contractorName)
  }

  // Actions: Utility
  /**
   * Clear error
   */
  function clearError() {
    error.value = null
  }

  /**
   * Clear cache for a job (forces reload on next fetch)
   */
  function clearJobCache(jobId: string) {
    stopJobRosterSubscription(jobId)
    delete rosterByJob.value[jobId]
  }

  /**
   * Reset entire store
   */
  function $reset() {
    stopJobRosterSubscription()
    rosterByJob.value = {}
    currentJobId.value = null
    loading.value = false
    error.value = null
  }

  return {
    // State
    rosterByJob,
    loading,
    error,
    currentJobId,

    // Computed
    currentJobRoster,
    activeInCurrentJob,
    inactiveInCurrentJob,

    // Actions
    setCurrentJob,
    fetchJobRoster,
    subscribeJobRoster,
    getRoster,
    getEmployee,
    addEmployee,
    updateEmployee,
    removeEmployee,
    toggleEmployeeStatus,
    searchRoster,
    getEmployeesByContractor,
    clearError,
    clearJobCache,
    stopJobRosterSubscription,
    $reset,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useJobRosterStore, import.meta.hot))
}

