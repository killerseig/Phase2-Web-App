import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { subscribeJob as subscribeJobService, subscribeVisibleJobs as subscribeVisibleJobsService } from '@/services/jobs'
import { useAuthStore } from '@/stores/auth'
import type { JobRecord } from '@/types/domain'
import { normalizeError } from '@/utils/normalizeError'

export const useJobsStore = defineStore('jobs', () => {
  const jobs = ref<JobRecord[]>([])
  const currentJob = ref<JobRecord | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  let unsubscribeJobs: (() => void) | null = null
  let unsubscribeCurrentJob: (() => void) | null = null
  let stopVisibilityWatcher: (() => void) | null = null

  const activeJobs = computed(() => jobs.value.filter((job) => job.active !== false))
  const archivedJobs = computed(() => jobs.value.filter((job) => job.active === false))

  function stopJobsSubscription() {
    if (!unsubscribeJobs) return
    unsubscribeJobs()
    unsubscribeJobs = null
  }

  function stopVisibilitySubscriptionWatcher() {
    if (!stopVisibilityWatcher) return
    stopVisibilityWatcher()
    stopVisibilityWatcher = null
  }

  function stopCurrentJobSubscription() {
    if (!unsubscribeCurrentJob) return
    unsubscribeCurrentJob()
    unsubscribeCurrentJob = null
  }

  function subscribeVisibleJobs() {
    const auth = useAuthStore()
    stopVisibilitySubscriptionWatcher()

    const applyVisibleJobsSubscription = () => {
      stopJobsSubscription()
      loading.value = true
      error.value = null

      if (!auth.currentUser) {
        jobs.value = []
        loading.value = false
        return
      }

      const assignedJobIds = auth.assignedJobIds.slice()
      const options = auth.isAdmin
        ? undefined
        : assignedJobIds.length
          ? { assignedJobIds }
          : { assignedOnlyForUid: auth.currentUser.uid }

      unsubscribeJobs = subscribeVisibleJobsService(
        options,
        (nextJobs) => {
          jobs.value = nextJobs
          loading.value = false
        },
        (nextError) => {
          error.value = normalizeError(nextError, 'Failed to load jobs.')
          loading.value = false
        },
      )
    }

    applyVisibleJobsSubscription()

    stopVisibilityWatcher = watch(
      () => ({
        uid: auth.currentUser?.uid ?? '',
        isAdmin: auth.isAdmin,
        assignedJobIds: auth.assignedJobIds.slice().sort().join('|'),
      }),
      () => {
        applyVisibleJobsSubscription()
      },
    )
  }

  function subscribeJob(jobId: string) {
    stopCurrentJobSubscription()
    loading.value = true
    error.value = null

    unsubscribeCurrentJob = subscribeJobService(
      jobId,
      (job) => {
        currentJob.value = job

        if (job) {
          const index = jobs.value.findIndex((entry) => entry.id === job.id)
          if (index === -1) {
            jobs.value.push(job)
          } else {
            jobs.value[index] = job
          }
        }

        loading.value = false
      },
      (nextError) => {
        error.value = normalizeError(nextError, 'Failed to load job.')
        loading.value = false
      },
    )
  }

  function $reset() {
    stopJobsSubscription()
    stopVisibilitySubscriptionWatcher()
    stopCurrentJobSubscription()
    jobs.value = []
    currentJob.value = null
    loading.value = false
    error.value = null
  }

  return {
    jobs,
    currentJob,
    loading,
    error,
    activeJobs,
    archivedJobs,
    subscribeVisibleJobs,
    subscribeJob,
    stopJobsSubscription,
    stopCurrentJobSubscription,
    $reset,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useJobsStore, import.meta.hot))
}
