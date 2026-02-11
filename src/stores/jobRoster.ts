/**
 * Job Roster Store (Phase 3)
 * Manages job-scoped employee rosters
 * Replaces the global employees store
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as JobRosterService from '../services/JobRoster'
import type { JobRosterEmployee } from '@/types/models'

export const useJobRosterStore = defineStore('jobRoster', () => {
  // State: by job ID
  const rosterByJob = ref<Map<string, JobRosterEmployee[]>>(new Map())
  const loading = ref(false)
  const error = ref<string | null>(null)
  const currentJobId = ref<string | null>(null)

  // Computed
  const currentJobRoster = computed(() => {
    if (!currentJobId.value) return []
    return rosterByJob.value.get(currentJobId.value) ?? []
  })

  const activeInCurrentJob = computed(() =>
    currentJobRoster.value.filter(e => e.active)
  )

  const inactiveInCurrentJob = computed(() =>
    currentJobRoster.value.filter(e => !e.active)
  )

  const isLoading = computed(() => loading.value)
  const hasError = computed(() => error.value !== null)

  // Actions: Roster Loading
  async function setCurrentJob(jobId: string) {
    currentJobId.value = jobId
  }

  /**
   * Load roster for a specific job
   */
  async function fetchJobRoster(jobId: string) {
    loading.value = true
    error.value = null
    try {
      const employees = await JobRosterService.listRosterEmployees(jobId)
      rosterByJob.value.set(jobId, employees)

      // If this becomes current job, update currentJobId
      if (currentJobId.value === jobId) {
        // Already set, just refreshed
      }

      return employees
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to load roster'
      console.error(`[JobRoster Store] Error loading roster for job ${jobId}:`, e)
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Get roster for a job (from cache if available, otherwise fetch)
   */
  async function getRoster(jobId: string): Promise<JobRosterEmployee[]> {
    const cached = rosterByJob.value.get(jobId)
    if (cached) return cached
    return await fetchJobRoster(jobId)
  }

  /**
   * Get a single employee from the roster
   */
  function getEmployee(jobId: string, employeeId: string): JobRosterEmployee | undefined {
    const roster = rosterByJob.value.get(jobId)
    return roster?.find(e => e.id === employeeId)
  }

  // Actions: CRUD
  async function addEmployee(jobId: string, employee: any) {
    error.value = null
    try {
      const employeeId = await JobRosterService.addRosterEmployee(jobId, employee)

      // Update local cache
      const roster = rosterByJob.value.get(jobId) ?? []
      const newEmployee = {
        ...employee,
        id: employeeId,
        jobId,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as JobRosterEmployee
      roster.push(newEmployee)
      rosterByJob.value.set(jobId, roster)

      return employeeId
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to add employee'
      console.error('[JobRoster Store] Error adding employee:', e)
      throw e
    }
  }

  /**
   * Update an employee in the roster
   */
  async function updateEmployee(jobId: string, employeeId: string, updates: Partial<JobRosterEmployee>) {
    error.value = null
    try {
      await JobRosterService.updateRosterEmployee(jobId, employeeId, updates)

      // Update local cache
      const roster = rosterByJob.value.get(jobId) ?? []
      const idx = roster.findIndex(e => e.id === employeeId)
      if (idx !== -1) {
        roster[idx] = { ...roster[idx], ...updates }
        rosterByJob.value.set(jobId, [...roster])
      }
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to update employee'
      console.error('[JobRoster Store] Error updating employee:', e)
      throw e
    }
  }

  /**
   * Remove an employee from the roster
   */
  async function removeEmployee(jobId: string, employeeId: string) {
    error.value = null
    try {
      await JobRosterService.removeRosterEmployee(jobId, employeeId)

      // Update local cache
      const roster = rosterByJob.value.get(jobId) ?? []
      const filtered = roster.filter(e => e.id !== employeeId)
      rosterByJob.value.set(jobId, filtered)
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to remove employee'
      console.error('[JobRoster Store] Error removing employee:', e)
      throw e
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
    const roster = rosterByJob.value.get(jobId) ?? []
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
    const roster = rosterByJob.value.get(jobId) ?? []
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
    rosterByJob.value.delete(jobId)
  }

  /**
   * Reset entire store
   */
  function resetStore() {
    rosterByJob.value.clear()
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
    isLoading,
    hasError,

    // Actions
    setCurrentJob,
    fetchJobRoster,
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
    resetStore,
  }
})
