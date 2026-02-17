import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  assignForemanToJob as assignForemanToJobService,
  createJob as createJobService,
  deleteJob as deleteJobService,
  getJob as getJobService,
  listAllJobs as listAllJobsService,
  removeForemanFromJob as removeForemanFromJobService,
  setJobActive as setJobActiveService,
  setTimecardPeriodEndDate as setTimecardPeriodEndDateService,
  updateJob as updateJobService,
  updateTimecardStatus as updateTimecardStatusService,
} from '@/services'
import type { Job } from '@/types/models'

export const useJobsStore = defineStore('jobs', () => {
  const jobs = ref<Job[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const currentJob = ref<Job | null>(null)

  // Computed
  const allJobs = computed(() => jobs.value)
  const activeJobs = computed(() => jobs.value.filter(j => j.active !== false))
  const archivedJobs = computed(() => jobs.value.filter(j => j.active === false))
  const isLoading = computed(() => loading.value)
  const hasError = computed(() => error.value !== null)

  // Actions
  async function fetchAllJobs(includeArchived = true, options?: { assignedOnlyForUid?: string }) {
    loading.value = true
    error.value = null
    try {
      jobs.value = await listAllJobsService(includeArchived, options)
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to load jobs'
      console.error('[Jobs Store] Error loading jobs:', e)
    } finally {
      loading.value = false
    }
  }

  async function fetchJob(jobId: string) {
    loading.value = true
    error.value = null
    try {
      currentJob.value = await getJobService(jobId)
      // Also update in the jobs list if present
      const idx = jobs.value.findIndex(j => j.id === jobId)
      if (idx !== -1 && currentJob.value) {
        jobs.value[idx] = currentJob.value
      } else if (currentJob.value) {
        jobs.value.push(currentJob.value)
      }
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to load job'
      console.error('[Jobs Store] Error loading job:', e)
    } finally {
      loading.value = false
    }
  }

  async function createJob(name: string, options?: { code?: string; accountNumber?: string; type?: 'general' | 'subcontractor' }) {
    error.value = null
    try {
      const jobId = await createJobService(name, options)
      const newJob = await getJobService(jobId)
      if (newJob) {
        jobs.value.push(newJob)
        return newJob
      }
      throw new Error('Failed to retrieve created job')
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to create job'
      console.error('[Jobs Store] Error creating job:', e)
      throw e
    }
  }

  async function updateJob(
    jobId: string,
    updates: {
      name?: string
      code?: string | null
      accountNumber?: string | null
      type?: 'general' | 'subcontractor'
    }
  ) {
    error.value = null
    try {
      await updateJobService(jobId, updates)
      const idx = jobs.value.findIndex(j => j.id === jobId)
      if (idx !== -1) {
        jobs.value[idx] = { ...jobs.value[idx], ...updates }
      }
      if (currentJob.value?.id === jobId) {
        currentJob.value = { ...currentJob.value, ...updates }
      }
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to update job'
      console.error('[Jobs Store] Error updating job:', e)
      throw e
    }
  }

  async function setJobActive(jobId: string, active: boolean) {
    error.value = null
    try {
      await setJobActiveService(jobId, active)
      const idx = jobs.value.findIndex(j => j.id === jobId)
      if (idx !== -1) {
        jobs.value[idx] = { ...jobs.value[idx], active }
      }
      if (currentJob.value?.id === jobId) {
        currentJob.value = { ...currentJob.value, active }
      }
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to update job status'
      console.error('[Jobs Store] Error updating job status:', e)
      throw e
    }
  }

  async function deleteJob(jobId: string) {
    error.value = null
    try {
      await deleteJobService(jobId)
      const idx = jobs.value.findIndex(j => j.id === jobId)
      if (idx !== -1) {
        jobs.value.splice(idx, 1)
      }
      if (currentJob.value?.id === jobId) {
        currentJob.value = null
      }
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to delete job'
      console.error('[Jobs Store] Error deleting job:', e)
      throw e
    }
  }

  // Foreman Management
  async function assignForemanToJob(jobId: string, foremanId: string) {
    error.value = null
    try {
      await assignForemanToJobService(jobId, foremanId)
      const idx = jobs.value.findIndex(j => j.id === jobId)
      if (idx !== -1) {
        const updated = jobs.value[idx]
        if (!updated.assignedForemanIds) updated.assignedForemanIds = []
        if (!updated.assignedForemanIds.includes(foremanId)) {
          updated.assignedForemanIds.push(foremanId)
          jobs.value[idx] = { ...updated }
        }
      }
      if (currentJob.value?.id === jobId) {
        if (!currentJob.value.assignedForemanIds) currentJob.value.assignedForemanIds = []
        if (!currentJob.value.assignedForemanIds.includes(foremanId)) {
          currentJob.value.assignedForemanIds.push(foremanId)
        }
      }
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to assign foreman'
      console.error('[Jobs Store] Error assigning foreman:', e)
      throw e
    }
  }

  async function removeForemanFromJob(jobId: string, foremanId: string) {
    error.value = null
    try {
      await removeForemanFromJobService(jobId, foremanId)
      const idx = jobs.value.findIndex(j => j.id === jobId)
      if (idx !== -1) {
        const updated = jobs.value[idx]
        if (updated.assignedForemanIds) {
          updated.assignedForemanIds = updated.assignedForemanIds.filter(id => id !== foremanId)
          jobs.value[idx] = { ...updated }
        }
      }
      if (currentJob.value?.id === jobId) {
        if (currentJob.value.assignedForemanIds) {
          currentJob.value.assignedForemanIds = currentJob.value.assignedForemanIds.filter(id => id !== foremanId)
        }
      }
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to remove foreman'
      console.error('[Jobs Store] Error removing foreman:', e)
      throw e
    }
  }

  // Timecard Status Management
  async function setTimecardStatus(jobId: string, status: 'pending' | 'submitted' | 'archived') {
    error.value = null
    try {
      await updateTimecardStatusService(jobId, status)
      const idx = jobs.value.findIndex(j => j.id === jobId)
      if (idx !== -1) {
        jobs.value[idx] = { ...jobs.value[idx], timecardStatus: status }
      }
      if (currentJob.value?.id === jobId) {
        currentJob.value = { ...currentJob.value, timecardStatus: status }
      }
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to update timecard status'
      console.error('[Jobs Store] Error updating timecard status:', e)
      throw e
    }
  }

  async function setTimecardPeriodEndDate(jobId: string, date: string) {
    error.value = null
    try {
      await setTimecardPeriodEndDateService(jobId, date)
      const idx = jobs.value.findIndex(j => j.id === jobId)
      if (idx !== -1) {
        jobs.value[idx] = { ...jobs.value[idx], timecardPeriodEndDate: date }
      }
      if (currentJob.value?.id === jobId) {
        currentJob.value = { ...currentJob.value, timecardPeriodEndDate: date }
      }
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to update timecard period end date'
      console.error('[Jobs Store] Error updating timecard period end date:', e)
      throw e
    }
  }

  function clearError() {
    error.value = null
  }

  function resetStore() {
    jobs.value = []
    currentJob.value = null
    loading.value = false
    error.value = null
  }

  return {
    // State
    jobs,
    currentJob,
    loading,
    error,

    // Computed
    allJobs,
    activeJobs,
    archivedJobs,
    isLoading,
    hasError,

    // Actions
    fetchAllJobs,
    fetchJob,
    createJob,
    updateJob,
    deleteJob,
    setJobActive,
    assignForemanToJob,
    removeForemanFromJob,
    setTimecardStatus,
    setTimecardPeriodEndDate,
    clearError,
    resetStore,
  }
})
