import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useJobsStore } from '@/stores/jobs'
import { ROLES } from '@/constants/app'

export function useJobAccess() {
  const auth = useAuthStore()
  const jobsStore = useJobsStore()

  const isAdmin = computed(() => auth.role === ROLES.ADMIN)
  const isController = computed(() => auth.role === ROLES.CONTROLLER)
  const isForeman = computed(() => auth.role === ROLES.FOREMAN)

  const visibleActiveJobs = computed(() => {
    if (!auth.user || auth.active === false || !auth.role || auth.role === ROLES.NONE) return []
    if (isController.value) return []
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
    if (isController.value) {
      if (typeof jobsStore.stopJobsSubscription === 'function') {
        jobsStore.stopJobsSubscription()
      }
      return
    }
    const includeArchived = isAdmin.value
    const options = {
      assignedOnlyForUid: isForeman.value ? auth.user?.uid ?? undefined : undefined,
    }

    if (typeof jobsStore.subscribeAllJobs === 'function') {
      jobsStore.subscribeAllJobs(includeArchived, options)
      return
    }

    if (typeof jobsStore.fetchAllJobs === 'function') {
      await jobsStore.fetchAllJobs(includeArchived, options)
    }
  }

  const stopJobsForCurrentUser = () => {
    if (typeof jobsStore.stopJobsSubscription === 'function') {
      jobsStore.stopJobsSubscription()
    }
  }

  const canAccessJob = (jobId: string): boolean => {
    if (!jobId) return false
    if (!auth.user || auth.active === false || !auth.role || auth.role === ROLES.NONE) return false
    if (isController.value) return false
    if (isForeman.value) {
      const assignedJobIds = auth.assignedJobIds ?? []
      return assignedJobIds.includes(jobId)
    }
    return true
  }

  return {
    isAdmin,
    isController,
    isForeman,
    visibleActiveJobs,
    visibleArchivedJobs,
    loadJobsForCurrentUser,
    stopJobsForCurrentUser,
    canAccessJob,
  }
}
