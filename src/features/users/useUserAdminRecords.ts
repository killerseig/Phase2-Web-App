import type { Ref } from 'vue'
import { useSubscribedRecords } from '@/composables/useSubscribedRecords'
import { subscribeVisibleJobs } from '@/services/jobs'
import { subscribeUsers } from '@/services/users'
import type { JobRecord, UserProfile } from '@/types/domain'

interface UseUserAdminRecordsOptions {
  selectedUserId: Ref<string | 'new' | null>
}

export function useUserAdminRecords({
  selectedUserId,
}: UseUserAdminRecordsOptions) {
  const subscribeAssignableJobs = (
    onUpdate: (records: JobRecord[]) => void,
    onError?: (error: unknown) => void,
  ) => subscribeVisibleJobs(undefined, onUpdate, onError)

  const {
    error: jobsError,
    loading: jobsLoading,
    records: jobs,
    start: startJobsSubscription,
    stop: stopJobsSubscription,
  } = useSubscribedRecords<JobRecord>(subscribeAssignableJobs, {
    errorMessage: 'Failed to load jobs.',
  })

  const {
    error: usersError,
    loading: usersLoading,
    records: users,
    start: startUsersSubscription,
    stop: stopUsersSubscription,
  } = useSubscribedRecords<UserProfile>(subscribeUsers, {
    errorMessage: 'Failed to load users.',
    onUpdate: (nextUsers) => {
      if (
        selectedUserId.value
        && selectedUserId.value !== 'new'
        && !nextUsers.some((user) => user.id === selectedUserId.value)
      ) {
        selectedUserId.value = null
      }
    },
  })

  return {
    jobs,
    jobsError,
    jobsLoading,
    startJobsSubscription,
    stopJobsSubscription,
    users,
    usersError,
    usersLoading,
    startUsersSubscription,
    stopUsersSubscription,
  }
}
