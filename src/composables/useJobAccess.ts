import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useJobsStore } from '@/stores/jobs'
import { ROLES } from '@/constants/app'

export function useJobAccess() {
  const auth = useAuthStore()
  const jobsStore = useJobsStore()

  const isAdmin = computed(() => auth.role === ROLES.ADMIN)
  const isForeman = computed(() => auth.role === ROLES.FOREMAN)

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
      const assignedJobIds = auth.assignedJobIds ?? []
      return assignedJobIds.includes(jobId)
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
