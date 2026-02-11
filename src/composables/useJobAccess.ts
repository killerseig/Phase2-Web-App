import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useJobsStore } from '@/stores/jobs'

export function useJobAccess() {
  const auth = useAuthStore()
  const jobsStore = useJobsStore()

  const isAdmin = computed(() => auth.role === 'admin')
  const isForeman = computed(() => auth.role === 'foreman')

  const visibleActiveJobs = computed(() => {
    const base = jobsStore.activeJobs
    if (isForeman.value) {
      return base.filter((j) => auth.assignedJobIds?.includes(j.id))
    }
    return base
  })

  const visibleArchivedJobs = computed(() => {
    if (!isAdmin.value) return []
    return jobsStore.archivedJobs
  })

  const loadJobsForCurrentUser = async () => {
    await jobsStore.fetchAllJobs(isAdmin.value, {
      assignedOnlyForUid: isForeman.value ? auth.user?.uid ?? undefined : undefined,
    })
  }

  const canAccessJob = (jobId: string): boolean => {
    if (!jobId) return false
    if (isForeman.value) {
      return auth.assignedJobIds?.includes(jobId) ?? false
    }
    return true
  }

  return {
    isAdmin,
    isForeman,
    visibleActiveJobs,
    visibleArchivedJobs,
    loadJobsForCurrentUser,
    canAccessJob,
  }
}
