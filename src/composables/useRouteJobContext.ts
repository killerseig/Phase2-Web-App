import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useJobsStore } from '@/stores/jobs'
import type { JobRecord } from '@/types/domain'

export function useRouteJobContext() {
  const route = useRoute()
  const jobsStore = useJobsStore()

  const jobId = computed(() => String(route.params.jobId ?? ''))
  const job = computed<JobRecord | null>(() => {
    if (jobsStore.currentJob?.id === jobId.value) return jobsStore.currentJob
    return jobsStore.jobs.find((entry) => entry.id === jobId.value) ?? null
  })

  function subscribeRouteJob() {
    if (!jobId.value) return
    jobsStore.subscribeJob(jobId.value)
  }

  function stopRouteJobSubscription() {
    jobsStore.stopCurrentJobSubscription()
  }

  return {
    job,
    jobId,
    subscribeRouteJob,
    stopRouteJobSubscription,
  }
}
