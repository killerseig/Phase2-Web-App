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
  subscribeAllJobs as subscribeAllJobsService,
  subscribeJob as subscribeJobService,
  updateJob as updateJobService,
  updateTimecardStatus as updateTimecardStatusService,
} from '@/services'
import { normalizeError } from '@/services/serviceUtils'
import type { Job } from '@/types/models'

export const useJobsStore = defineStore('jobs', () => {
  const jobs = ref<Job[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const currentJob = ref<Job | null>(null)
  let unsubscribeJobs: (() => void) | null = null
  let unsubscribeCurrentJob: (() => void) | null = null

  // Computed
  const activeJobs = computed(() => jobs.value.filter(j => j.active !== false))
  const archivedJobs = computed(() => jobs.value.filter(j => j.active === false))

  const setStoreError = (err: unknown, fallback: string) => {
    error.value = normalizeError(err, fallback)
  }

  const updateCachedJob = (jobId: string, updater: (job: Job) => void) => {
    const cachedJob = jobs.value.find((job) => job.id === jobId)
    if (cachedJob) updater(cachedJob)
    if (currentJob.value?.id === jobId) updater(currentJob.value)
  }

  const stopJobsSubscription = () => {
    if (!unsubscribeJobs) return
    unsubscribeJobs()
    unsubscribeJobs = null
  }

  const stopCurrentJobSubscription = () => {
    if (!unsubscribeCurrentJob) return
    unsubscribeCurrentJob()
    unsubscribeCurrentJob = null
  }

  // Actions
  async function fetchAllJobs(includeArchived = true, options?: { assignedOnlyForUid?: string }) {
    loading.value = true
    error.value = null
    try {
      jobs.value = await listAllJobsService(includeArchived, options)
    } catch (err) {
      setStoreError(err, 'Failed to load jobs')
      console.error('[Jobs Store] Error loading jobs:', err)
    } finally {
      loading.value = false
    }
  }

  function subscribeAllJobs(includeArchived = true, options?: { assignedOnlyForUid?: string }) {
    stopJobsSubscription()
    loading.value = true
    error.value = null

    unsubscribeJobs = subscribeAllJobsService(
      includeArchived,
      options,
      (nextJobs) => {
        jobs.value = nextJobs
        loading.value = false
      },
      (err) => {
        setStoreError(err, 'Failed to subscribe to jobs')
        loading.value = false
        console.error('[Jobs Store] Error subscribing to jobs:', err)
      }
    )
  }

  async function fetchJob(jobId: string) {
    loading.value = true
    error.value = null
    try {
      currentJob.value = await getJobService(jobId)
      // Also update in the jobs list if present
      const idx = jobs.value.findIndex((job) => job.id === jobId)
      if (idx !== -1 && currentJob.value) {
        const cachedJob = jobs.value[idx]
        if (cachedJob) Object.assign(cachedJob, currentJob.value)
      } else if (currentJob.value) {
        jobs.value.push(currentJob.value)
      }
    } catch (err) {
      setStoreError(err, 'Failed to load job')
      console.error('[Jobs Store] Error loading job:', err)
    } finally {
      loading.value = false
    }
  }

  function subscribeJob(jobId: string) {
    stopCurrentJobSubscription()
    loading.value = true
    error.value = null

    unsubscribeCurrentJob = subscribeJobService(
      jobId,
      (job) => {
        currentJob.value = job
        const idx = jobs.value.findIndex((entry) => entry.id === jobId)
        if (!job) {
          if (idx !== -1) jobs.value.splice(idx, 1)
          loading.value = false
          return
        }
        if (idx === -1) {
          jobs.value.push(job)
        } else {
          jobs.value[idx] = job
        }
        loading.value = false
      },
      (err) => {
        setStoreError(err, 'Failed to subscribe to job')
        loading.value = false
        console.error('[Jobs Store] Error subscribing to job:', err)
      }
    )
  }

  async function createJob(
    name: string,
    options?: {
      header?: string
      code?: string
      projectManager?: string
      foreman?: string
      gc?: string
      jobAddress?: string
      startDate?: string
      finishDate?: string
      taxExempt?: string
      certified?: string
      cip?: string
      kjic?: string
      accountNumber?: string
      type?: 'general' | 'subcontractor'
    }
  ) {
    error.value = null
    try {
      const jobId = await createJobService(name, options)
      const newJob = await getJobService(jobId)
      if (newJob) {
        jobs.value.push(newJob)
        return newJob
      }
      throw new Error('Failed to retrieve created job')
    } catch (err) {
      setStoreError(err, 'Failed to create job')
      console.error('[Jobs Store] Error creating job:', err)
      throw err
    }
  }

  async function updateJob(
    jobId: string,
    updates: {
      header?: string | null
      name?: string
      code?: string | null
      projectManager?: string | null
      foreman?: string | null
      gc?: string | null
      jobAddress?: string | null
      startDate?: string | null
      finishDate?: string | null
      taxExempt?: string | null
      certified?: string | null
      cip?: string | null
      kjic?: string | null
      accountNumber?: string | null
      type?: 'general' | 'subcontractor'
    }
  ) {
    error.value = null
    try {
      await updateJobService(jobId, updates)
      updateCachedJob(jobId, (job) => Object.assign(job, updates))
    } catch (err) {
      setStoreError(err, 'Failed to update job')
      console.error('[Jobs Store] Error updating job:', err)
      throw err
    }
  }

  async function setJobActive(jobId: string, active: boolean) {
    error.value = null
    try {
      await setJobActiveService(jobId, active)
      updateCachedJob(jobId, (job) => {
        job.active = active
      })
    } catch (err) {
      setStoreError(err, 'Failed to update job status')
      console.error('[Jobs Store] Error updating job status:', err)
      throw err
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
    } catch (err) {
      setStoreError(err, 'Failed to delete job')
      console.error('[Jobs Store] Error deleting job:', err)
      throw err
    }
  }

  // Foreman Management
  async function assignForemanToJob(jobId: string, foremanId: string) {
    error.value = null
    try {
      await assignForemanToJobService(jobId, foremanId)
      updateCachedJob(jobId, (job) => {
        if (!job.assignedForemanIds) job.assignedForemanIds = []
        if (!job.assignedForemanIds.includes(foremanId)) {
          job.assignedForemanIds.push(foremanId)
        }
      })
    } catch (err) {
      setStoreError(err, 'Failed to assign foreman')
      console.error('[Jobs Store] Error assigning foreman:', err)
      throw err
    }
  }

  async function removeForemanFromJob(jobId: string, foremanId: string) {
    error.value = null
    try {
      await removeForemanFromJobService(jobId, foremanId)
      updateCachedJob(jobId, (job) => {
        if (job.assignedForemanIds) {
          job.assignedForemanIds = job.assignedForemanIds.filter(id => id !== foremanId)
        }
      })
    } catch (err) {
      setStoreError(err, 'Failed to remove foreman')
      console.error('[Jobs Store] Error removing foreman:', err)
      throw err
    }
  }

  // Timecard Status Management
  async function setTimecardStatus(jobId: string, status: 'pending' | 'submitted' | 'archived') {
    error.value = null
    try {
      await updateTimecardStatusService(jobId, status)
      updateCachedJob(jobId, (job) => {
        job.timecardStatus = status
      })
    } catch (err) {
      setStoreError(err, 'Failed to update timecard status')
      console.error('[Jobs Store] Error updating timecard status:', err)
      throw err
    }
  }

  async function setTimecardPeriodEndDate(jobId: string, date: string) {
    error.value = null
    try {
      await setTimecardPeriodEndDateService(jobId, date)
      updateCachedJob(jobId, (job) => {
        job.timecardPeriodEndDate = date
      })
    } catch (err) {
      setStoreError(err, 'Failed to update timecard period end date')
      console.error('[Jobs Store] Error updating timecard period end date:', err)
      throw err
    }
  }

  function clearError() {
    error.value = null
  }

  function $reset() {
    stopJobsSubscription()
    stopCurrentJobSubscription()
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
    activeJobs,
    archivedJobs,

    // Actions
    fetchAllJobs,
    subscribeAllJobs,
    fetchJob,
    subscribeJob,
    createJob,
    updateJob,
    deleteJob,
    setJobActive,
    assignForemanToJob,
    removeForemanFromJob,
    setTimecardStatus,
    setTimecardPeriodEndDate,
    clearError,
    stopJobsSubscription,
    stopCurrentJobSubscription,
    $reset,
  }
})

